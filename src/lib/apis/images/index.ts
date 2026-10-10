import { requestJSON } from '$lib/utils/airis/request_json';
import { IMAGES_API_BASE_URL } from '$lib/constants';

export type ImageWorkflowNode = { type: string; key: string; node_ids: string[] };
export type ImageModel = { id: string; name: string };
export type ImageConfig = {
	ENABLE_IMAGE_GENERATION: boolean;
	ENABLE_IMAGE_PROMPT_GENERATION: boolean;
	IMAGE_GENERATION_ENGINE: string;
	IMAGE_GENERATION_MODEL: string;
	IMAGE_SIZE: string | null;
	IMAGE_STEPS: number | null;
	IMAGES_OPENAI_API_BASE_URL: string;
	IMAGES_OPENAI_API_KEY: string;
	IMAGES_OPENAI_API_VERSION: string;
	IMAGES_OPENAI_API_PARAMS: Record<string, unknown> | string | null;
	AUTOMATIC1111_BASE_URL: string;
	AUTOMATIC1111_API_AUTH: Record<string, unknown> | string | null;
	AUTOMATIC1111_PARAMS: Record<string, unknown> | string | null;
	COMFYUI_BASE_URL: string;
	COMFYUI_API_KEY: string;
	COMFYUI_WORKFLOW: string;
	COMFYUI_WORKFLOW_NODES: ImageWorkflowNode[];
	IMAGES_GEMINI_API_BASE_URL: string;
	IMAGES_GEMINI_API_KEY: string;
	IMAGES_GEMINI_ENDPOINT_METHOD: string;
	ENABLE_IMAGE_EDIT: boolean;
	IMAGE_EDIT_ENGINE: string;
	IMAGE_EDIT_MODEL: string;
	IMAGE_EDIT_SIZE: string | null;
	IMAGES_EDIT_OPENAI_API_BASE_URL: string;
	IMAGES_EDIT_OPENAI_API_KEY: string;
	IMAGES_EDIT_OPENAI_API_VERSION: string;
	IMAGES_EDIT_GEMINI_API_BASE_URL: string;
	IMAGES_EDIT_GEMINI_API_KEY: string;
	IMAGES_EDIT_COMFYUI_BASE_URL: string;
	IMAGES_EDIT_COMFYUI_API_KEY: string;
	IMAGES_EDIT_COMFYUI_WORKFLOW: string;
	IMAGES_EDIT_COMFYUI_WORKFLOW_NODES: ImageWorkflowNode[];
};

export const getConfig = (token = '', signal?: AbortSignal): Promise<ImageConfig> =>
	requestJSON(`${IMAGES_API_BASE_URL}/config`, token, undefined, signal, 'Image request');

export const updateConfig = (
	token: string,
	config: ImageConfig,
	signal?: AbortSignal
): Promise<ImageConfig> =>
	requestJSON(`${IMAGES_API_BASE_URL}/config/update`, token, config, signal, 'Image request');

export const verifyConfigUrl = (token = '', signal?: AbortSignal): Promise<boolean> =>
	requestJSON(
		`${IMAGES_API_BASE_URL}/config/url/verify`,
		token,
		undefined,
		signal,
		'Image request'
	);

export const getImageGenerationConfig = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${IMAGES_API_BASE_URL}/image/config`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			if ('detail' in err) {
				error = err.detail;
			} else {
				error = 'Server connection failed';
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateImageGenerationConfig = async (token: string = '', config: object) => {
	let error = null;

	const res = await fetch(`${IMAGES_API_BASE_URL}/image/config/update`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		},
		body: JSON.stringify({ ...config })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			if ('detail' in err) {
				error = err.detail;
			} else {
				error = 'Server connection failed';
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getImageGenerationModels = (
	token = '',
	signal?: AbortSignal
): Promise<ImageModel[] | null> =>
	requestJSON(`${IMAGES_API_BASE_URL}/models`, token, undefined, signal, 'Image request');

export const imageGenerations = async (token: string = '', prompt: string) => {
	let error = null;

	const res = await fetch(`${IMAGES_API_BASE_URL}/generations`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		},
		body: JSON.stringify({
			prompt: prompt
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			if ('detail' in err) {
				if (Array.isArray(err.detail)) {
					error = err.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join(', ');
				} else {
					error = err.detail;
				}
			} else {
				error = 'Server connection failed';
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const imageEdits = async (
	token: string = '',
	images: string | string[],
	prompt: string,
	model?: string,
	size?: string,
	n?: number,
	background?: string
) => {
	let error = null;

	const res = await fetch(`${IMAGES_API_BASE_URL}/edit`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		},
		body: JSON.stringify({
			form_data: {
				image: images,
				prompt,
				...(model && { model }),
				...(size && { size }),
				...(n && { n }),
				...(background && { background })
			}
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			if ('detail' in err) {
				if (Array.isArray(err.detail)) {
					error = err.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join(', ');
				} else {
					error = err.detail;
				}
			} else {
				error = 'Server connection failed';
			}
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};
