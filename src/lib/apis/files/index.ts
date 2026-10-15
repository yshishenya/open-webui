import { WEBUI_API_BASE_URL } from '$lib/constants';
import { splitStream } from '$lib/utils';
import { getErrorMessage } from '$lib/utils/airis/error_message';
import type { KnowledgeFile } from '$lib/utils/airis/knowledge-types';

export const uploadFile = async (
	token: string,
	file: File,
	metadata?: object | null,
	process?: boolean | null,
	stream: boolean = true
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

export const searchFiles = async (
	token: string,
	filename: string = '*',
	skip: number = 0,
	limit: number = 50,
	content: boolean = false
): Promise<KnowledgeFile[]> => {
	let error = null;

	const searchParams = new URLSearchParams();
	searchParams.append('filename', filename);
	searchParams.append('skip', String(skip));
	searchParams.append('limit', String(limit));
	searchParams.append('content', String(content));

	const res = await fetch(`${WEBUI_API_BASE_URL}/files/search?${searchParams.toString()}`, {
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
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return [];
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getFileCount = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/files/count`, {
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
		.catch((err) => {
			error = err;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

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
			error = err.detail;
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
