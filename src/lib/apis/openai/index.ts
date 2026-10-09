import type { ModelConnection, ModelConnectionConfig } from '$lib/utils/airis/frontend-contracts';
import { requestModelConnection } from '$lib/utils/airis/model_connection_request';
import type { DirectProviderModelsResponse } from '$lib/utils/airis/model-types';
import { OPENAI_API_BASE_URL, WEBUI_BASE_URL } from '$lib/constants';
import { enhanceOpenAIChatCompletionBody } from '$lib/utils/airis/openai';

export type OpenAIConfig = {
	ENABLE_OPENAI_API: boolean | null;
	OPENAI_API_BASE_URLS: string[];
	OPENAI_API_KEYS: string[];
	OPENAI_API_CONFIGS: Record<string, ModelConnectionConfig | null>;
};
export const getOpenAIConfig = (token = '', signal?: AbortSignal): Promise<OpenAIConfig> =>
	requestModelConnection(
		`${OPENAI_API_BASE_URL}/config`,
		{
			method: 'GET',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
		},
		signal
	);
export const updateOpenAIConfig = (
	token: string,
	config: OpenAIConfig,
	signal?: AbortSignal
): Promise<OpenAIConfig> =>
	requestModelConnection(
		`${OPENAI_API_BASE_URL}/config/update`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(config)
		},
		signal
	);

export const getOpenAIModelsDirect = async (
	url: string,
	key: string
): Promise<DirectProviderModelsResponse> => {
	let error = null;

	const res = await fetch(`${url}/models`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...(key && { authorization: `Bearer ${key}` })
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json() as Promise<DirectProviderModelsResponse>;
		})
		.catch((err) => {
			error = `OpenAI: ${err?.error?.message ?? 'Network Problem'}`;
			return [];
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getOpenAIModels = async (token: string, urlIdx?: number) => {
	let error = null;

	const res = await fetch(
		`${OPENAI_API_BASE_URL}/models${typeof urlIdx === 'number' ? `/${urlIdx}` : ''}`,
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				...(token && { authorization: `Bearer ${token}` })
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = `OpenAI: ${err?.error?.message ?? 'Network Problem'}`;
			return [];
		});

	if (error) {
		throw error;
	}

	return res;
};

export const verifyOpenAIConnection = (
	token: string,
	connection: Pick<ModelConnection, 'url' | 'key'> & { config?: ModelConnectionConfig },
	direct = false,
	signal?: AbortSignal
): Promise<unknown> => {
	const { url, key, config } = connection;
	if (!url) return Promise.reject(new Error('OpenAI: URL is required'));
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (direct) {
		const auth = config?.auth_type ?? 'bearer';
		if (auth === 'session') headers.Authorization = `Bearer ${token}`;
		else if (auth !== 'none' && key) headers.Authorization = `Bearer ${key}`;
		Object.assign(headers, config?.headers);
	} else headers.Authorization = `Bearer ${token}`;
	return requestModelConnection(
		direct ? `${url}/models` : `${OPENAI_API_BASE_URL}/verify`,
		{
			method: direct ? 'GET' : 'POST',
			headers,
			...(direct ? {} : { body: JSON.stringify(connection) })
		},
		signal
	);
};

export const chatCompletion = async (
	token: string = '',
	body: object,
	url: string = `${WEBUI_BASE_URL}/api`
): Promise<[Response | null, AbortController]> => {
	const controller = new AbortController();
	let error = null;

	const res = await fetch(`${url}/chat/completions`, {
		signal: controller.signal,
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	}).catch((err) => {
		console.error(err);
		error = err;
		return null;
	});

	if (error) {
		throw error;
	}

	return [res, controller];
};

export const generateOpenAIChatCompletion = async (
	token: string = '',
	body: object,
	url: string = `${WEBUI_BASE_URL}/api`
) => {
	let error = null;

	const res = await fetch(`${url}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		body: JSON.stringify(enhanceOpenAIChatCompletionBody(body))
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err?.detail ?? err;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const synthesizeOpenAISpeech = async (
	token: string = '',
	speaker: string = 'alloy',
	text: string = '',
	model: string = 'tts-1'
) => {
	let error = null;

	const res = await fetch(`${OPENAI_API_BASE_URL}/audio/speech`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: model,
			input: text,
			voice: speaker
		})
	}).catch((err) => {
		console.error(err);
		error = err;
		return null;
	});

	if (error) {
		throw error;
	}

	return res;
};
