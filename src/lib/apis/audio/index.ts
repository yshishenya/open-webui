import { AUDIO_API_BASE_URL } from '$lib/constants';
import { requestJSON } from '$lib/utils/airis/request_json';
import { getErrorMessage } from '$lib/utils/airis/error_message';

export type AudioConfigForm = {
	tts: {
		OPENAI_API_BASE_URL: string;
		OPENAI_API_KEY: string;
		OPENAI_PARAMS?: Record<string, unknown> | null;
		API_KEY: string;
		ENGINE: string;
		MODEL: string;
		VOICE: string;
		SPLIT_ON: string;
		AZURE_SPEECH_REGION: string;
		AZURE_SPEECH_BASE_URL: string;
		AZURE_SPEECH_OUTPUT_FORMAT: string;
		MISTRAL_API_KEY: string;
		MISTRAL_API_BASE_URL: string;
	};
	stt: {
		OPENAI_API_BASE_URL: string;
		OPENAI_API_KEY: string;
		OPENAI_API_REQUEST_FORMAT?: string;
		ENGINE: string;
		MODEL: string;
		SUPPORTED_CONTENT_TYPES?: string[];
		ALLOWED_EXTENSIONS?: string[];
		WHISPER_MODEL: string;
		DEEPGRAM_API_KEY: string;
		AZURE_API_KEY: string;
		AZURE_REGION: string;
		AZURE_LOCALES: string;
		AZURE_BASE_URL: string;
		AZURE_MAX_SPEAKERS: string;
		MISTRAL_API_KEY: string;
		MISTRAL_API_BASE_URL: string;
		MISTRAL_USE_CHAT_COMPLETIONS: boolean;
	};
};
// Config.get_many omits absent keys; the form keeps its defaults for them.
export type AudioConfigResponse = {
	tts: Partial<AudioConfigForm['tts']>;
	stt: Partial<AudioConfigForm['stt']>;
};
export type AudioVoice = { id: string; name: string };

export const getAudioConfig = (token: string, signal?: AbortSignal): Promise<AudioConfigResponse> =>
	requestJSON(`${AUDIO_API_BASE_URL}/config`, token, undefined, signal, 'Audio request');

export const updateAudioConfig = (
	token: string,
	payload: AudioConfigForm,
	signal?: AbortSignal
): Promise<AudioConfigResponse> =>
	requestJSON(`${AUDIO_API_BASE_URL}/config/update`, token, payload, signal, 'Audio request');

export const transcribeAudio = async (token: string, file: File, language?: string) => {
	const data = new FormData();
	data.append('file', file);
	if (language) {
		data.append('language', language);
	}

	let error = null;
	const res = await fetch(`${AUDIO_API_BASE_URL}/transcriptions`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			authorization: `Bearer ${token}`
		},
		body: data
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

export const synthesizeOpenAISpeech = async (
	token: string = '',
	speaker: string = 'alloy',
	text: string = '',
	model?: string,
	signal?: AbortSignal
): Promise<Blob> => {
	signal?.throwIfAborted();
	const controller = new AbortController();
	const abort = (): void => controller.abort(signal?.reason);
	signal?.addEventListener('abort', abort, { once: true });
	const timeout = setTimeout(
		() => controller.abort(new DOMException('Speech synthesis timed out.', 'TimeoutError')),
		60_000
	);
	try {
		const res = await fetch(`${AUDIO_API_BASE_URL}/speech`, {
			method: 'POST',
			signal: controller.signal,
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ input: text, voice: speaker, ...(model && { model }) })
		});
		if (!res.ok) {
			const detail: unknown = await res.json().catch(() => null);
			controller.signal.throwIfAborted();
			throw new Error(
				detail ? getErrorMessage(detail) : `Speech synthesis failed (${res.status}).`
			);
		}
		// Read inside the deadline: response headers alone do not finish the request.
		const blob = await res.blob();
		controller.signal.throwIfAborted();
		return blob;
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener('abort', abort);
	}
};

interface AvailableModelsResponse {
	models: { id: string; name?: string }[];
}

export const getModels = (
	token: string = '',
	signal?: AbortSignal
): Promise<AvailableModelsResponse> =>
	requestJSON(`${AUDIO_API_BASE_URL}/models`, token, undefined, signal, 'Audio request');

export const getVoices = (
	token: string = '',
	signal?: AbortSignal
): Promise<{ voices: AudioVoice[] }> =>
	requestJSON<{ voices: { id: string; name: unknown }[] }>(
		`${AUDIO_API_BASE_URL}/voices`,
		token,
		undefined,
		signal,
		'Audio request'
	).then(({ voices }) => ({
		voices: voices.map(({ id, name }) => ({ id, name: typeof name === 'string' ? name : id }))
	}));
