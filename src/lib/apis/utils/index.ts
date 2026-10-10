import { requestJSON } from '$lib/utils/airis/request_json';
import { WEBUI_API_BASE_URL } from '$lib/constants';

export const getGravatarUrl = async (
	token: string,
	email: string,
	signal?: AbortSignal
): Promise<string> => {
	const query = new URLSearchParams({ email });
	const url = await requestJSON<string>(
		`${WEBUI_API_BASE_URL}/utils/gravatar?${query}`,
		token,
		undefined,
		signal,
		'Profile photo'
	);
	if (typeof url !== 'string' || !url.trim()) throw new Error('Invalid profile photo response');
	return url;
};

export type CodeExecutionOutput = {
	stdout: string | null;
	stderr: string | null;
	result: string | null;
};

export const executeCode = async (
	token: string,
	code: string
): Promise<CodeExecutionOutput | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/utils/code/execute`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			code: code
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);

			error = err;
			if (err.detail) {
				error = err.detail;
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const formatPythonCode = async (token: string, code: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/utils/code/format`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			code: code
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);

			error = err;
			if (err.detail) {
				error = err.detail;
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const downloadChatAsPDF = async (token: string, title: string, messages: object[]) => {
	const blob = await fetch(`${WEBUI_API_BASE_URL}/utils/pdf`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			title: title,
			messages: messages
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.blob();
		})
		.catch((err) => {
			console.error(err);
			return null;
		});

	return blob;
};

export const downloadDatabase = async (token: string) => {
	let error = null;

	await fetch(`${WEBUI_API_BASE_URL}/utils/db/download`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (response) => {
			if (!response.ok) {
				throw await response.json();
			}
			return response.blob();
		})
		.then((blob) => {
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'webui.db';
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}
};
