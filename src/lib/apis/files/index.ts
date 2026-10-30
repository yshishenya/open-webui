import { WEBUI_API_BASE_URL } from '$lib/constants';
import { splitStream } from '$lib/utils';
import { getErrorMessage } from '$lib/utils/airis/error_message';
import type { KnowledgeFile } from '$lib/utils/airis/knowledge-types';

export const uploadFile = async (
	token: string,
	file: File,
	metadata?: object | null,
	process?: boolean | null,
	stream: boolean = true,
	onUploaded?: (uploadedFile: { id: string }) => void
): Promise<KnowledgeFile | null> => {
	const data = new FormData();
	data.append('file', file);
	if (metadata) {
		data.append('metadata', JSON.stringify(metadata));
	}

	const searchParams = new URLSearchParams();
	if (process !== undefined && process !== null) {
		searchParams.append('process', String(process));
	}

	let error = null;

	const res: KnowledgeFile | null = await fetch(
		`${WEBUI_API_BASE_URL}/files/?${searchParams.toString()}`,
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				authorization: `Bearer ${token}`
			},
			body: data
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = getErrorMessage(err);
			console.warn('File upload request failed');
			return null;
		});

	if (error) {
		throw error;
	}

	if (res) {
		onUploaded?.(res);
	}

	if (res && stream) {
		const status = await getFileProcessStatus(token, res.id);

		if (!status.body) throw new Error('Failed to read file processing status.');
		const reader = status.body
			.pipeThrough(new TextDecoderStream())
			.pipeThrough(splitStream('\n'))
			.getReader();
		try {
			processing: for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				for (const line of value.split('\n')) {
					if (line === 'data: [DONE]') break processing;
					if (!line) continue;
					try {
						const data: unknown = JSON.parse(line.replace(/^data: /, ''));
						if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
						const event = data as NonNullable<KnowledgeFile['data']>;
						if (
							typeof event.status !== 'string' ||
							(event.content != null && typeof event.content !== 'string')
						)
							continue;
						if (event.error) res.error = getErrorMessage(event.error);
						if (event.status === 'failed' && !res.error) res.error = 'File processing failed.';
						res.data = event;
						if (event.status === 'completed' || event.status === 'failed') return res;
					} catch {
						console.warn('Invalid file processing event');
					}
				}
			}
		} catch {
			throw new Error('Failed to read file processing status.');
		} finally {
			try {
				await reader.cancel();
			} catch {
				console.warn('Unable to cancel file processing stream');
			}
			reader.releaseLock();
		}
		if (res.data?.status && !['completed', 'failed'].includes(res.data.status)) {
			throw new Error('Failed to read file processing status.');
		}
	}

	if (error) {
		throw error;
	}

	return res;
};

export const getFileProcessStatus = async (token: string, id: string): Promise<Response> => {
	const queryParams = new URLSearchParams();
	queryParams.append('stream', 'true');
	const controller = new AbortController();
	// Only bound the connection: processing may legitimately take longer than a minute.
	const timeout = setTimeout(() => controller.abort(), 60_000);
	try {
		const res = await fetch(`${WEBUI_API_BASE_URL}/files/${id}/process/status?${queryParams}`, {
			method: 'GET',
			signal: controller.signal,
			headers: { Accept: 'application/json', authorization: `Bearer ${token}` }
		});
		if (!res.ok) throw new Error('Failed to read file processing status.');
		return res;
	} catch {
		console.warn('File processing status request failed');
		throw new Error('Failed to read file processing status.');
	} finally {
		clearTimeout(timeout);
	}
};

export const uploadDir = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/files/upload/dir`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getFiles = async (token: string = '', content: boolean = false) => {
	let error = null;

	const searchParams = new URLSearchParams();
	searchParams.append('content', String(content));

	const res = await fetch(`${WEBUI_API_BASE_URL}/files/?${searchParams.toString()}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

const searchFilesByPath = async (
	path: string,
	token: string,
	filename: string,
	skip: number,
	limit: number,
	content: boolean
) => {
	const searchParams = new URLSearchParams({
		filename,
		skip: String(skip),
		limit: String(limit),
		content: String(content)
	});
	const res = await fetch(`${WEBUI_API_BASE_URL}/files/${path}?${searchParams}`, {
		headers: { Accept: 'application/json', authorization: `Bearer ${token}` }
	});
	if (!res.ok) {
		const error = await res.json();
		throw error.detail ?? error;
	}
	return res.json();
};

export const searchFiles = (
	token: string,
	filename: string = '*',
	skip: number = 0,
	limit: number = 50,
	content: boolean = false
): Promise<KnowledgeFile[]> => searchFilesByPath('search', token, filename, skip, limit, content);

export const searchUserFiles = (
	token: string,
	filename: string = '*',
	skip: number = 0,
	limit: number = 50,
	content: boolean = false
) => searchFilesByPath('user/search', token, filename, skip, limit, content);

const getFileCountByPath = async (path: string, token: string) => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/files/${path}`, {
		headers: { Accept: 'application/json', authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const getFileCount = (token: string = '') => getFileCountByPath('count', token);
export const getUserFileCount = (token: string = '') => getFileCountByPath('user/count', token);

export const getFileById = async (token: string, id: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/files/${id}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateFileDataContentById = async (token: string, id: string, content: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/files/${id}/data/content/update`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			content: content
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getFileContentById = async (
	id: string,
	signal?: AbortSignal
): Promise<ArrayBuffer> => {
	const response = await fetch(`${WEBUI_API_BASE_URL}/files/${id}/content`, {
		method: 'GET',
		headers: { Accept: 'application/json' },
		credentials: 'include',
		signal: signal ?? AbortSignal.timeout(60000)
	});
	if (!response.ok) throw new Error('Failed to load file content.');
	return await response.arrayBuffer();
};

export const renameFileById = async (token: string, id: string, filename: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/files/${id}/rename`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ filename })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const deleteFileById = async (token: string, id: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/files/${id}`, {
		method: 'DELETE',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail ?? err;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const deleteAllFiles = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/files/all`, {
		method: 'DELETE',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export class FileContentError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
	}
}

export const getFileBlobById = async (
	token: string,
	id: string,
	{
		signal,
		attachment = false,
		filename
	}: { signal?: AbortSignal; attachment?: boolean; filename?: string } = {}
): Promise<Blob> => {
	const suffix = filename ? `/${encodeURIComponent(filename)}` : `?attachment=${attachment}`;
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/files/${encodeURIComponent(id)}/content${suffix}`,
		{
			headers: { authorization: `Bearer ${token}` },
			signal
		}
	);
	if (!response.ok) {
		const error = await response.json().catch(() => null);
		throw new FileContentError(
			error?.detail || `Unable to load file (${response.status})`,
			response.status
		);
	}
	return response.blob();
};

export const getFileIndexedText = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<string> => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/files/${encodeURIComponent(id)}/data/content`,
		{
			headers: { authorization: `Bearer ${token}` },
			signal
		}
	);
	if (!response.ok) {
		const error = await response.json().catch(() => null);
		throw new Error(error?.detail || 'Unable to load indexed text');
	}
	return (await response.json()).content ?? '';
};
