import { WEBUI_API_BASE_URL } from '$lib/constants';

export type LegalDocStatus = {
	key: string;
	title: string;
	url: string;
	version: string;
	required: boolean;
	accepted_at?: number | null;
	accepted_version?: string | null;
};

export type LegalStatusResponse = {
	docs: LegalDocStatus[];
	needs_accept: boolean;
	server_time: number;
};

export type LegalRequirementsResponse = {
	docs: Array<{
		key: string;
		title: string;
		url: string;
		version: string;
		required: boolean;
	}>;
	server_time: number;
};

export type AcceptLegalDocsResponse = {
	accepted: Array<{
		id: string;
		user_id: string;
		doc_key: string;
		doc_version: string;
		accepted_at: number;
		ip?: string | null;
		user_agent?: string | null;
		method?: string | null;
	}>;
	status: LegalStatusResponse;
};

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

export class LegalApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'LegalApiError';
		this.status = status;
	}
}

const requestLegalJson = async <ResponseBody>(
	url: string,
	init: RequestInit,
	fallbackMessage: string
): Promise<ResponseBody> => {
	let response = await fetch(url, init);
	if (init.method === 'GET' && RETRYABLE_STATUS_CODES.has(response.status)) {
		response = await fetch(url, init);
	}

	if (!response.ok) {
		let message = fallbackMessage;
		if (response.headers.get('content-type')?.includes('application/json')) {
			try {
				const payload = (await response.json()) as { detail?: unknown };
				message =
					typeof payload.detail === 'string' && payload.detail.trim()
						? payload.detail
						: fallbackMessage;
			} catch {
				// Keep the user-safe fallback when an upstream proxy returns malformed JSON.
			}
		}
		console.error(`Legal API request failed with status ${response.status}`);
		throw new LegalApiError(response.status, message);
	}

	try {
		return (await response.json()) as ResponseBody;
	} catch (error) {
		console.error('Legal API returned an invalid response', error);
		throw new Error(fallbackMessage);
	}
};

export const getLegalStatus = async (token: string): Promise<LegalStatusResponse> => {
	return requestLegalJson<LegalStatusResponse>(
		`${WEBUI_API_BASE_URL}/legal/status`,
		{
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			}
		},
		'Не удалось проверить юридические документы. Попробуйте ещё раз.'
	);
};

export const getLegalRequirements = async (): Promise<LegalRequirementsResponse> => {
	return requestLegalJson<LegalRequirementsResponse>(
		`${WEBUI_API_BASE_URL}/legal/requirements`,
		{
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		},
		'Не удалось загрузить юридические документы. Попробуйте ещё раз.'
	);
};

export const acceptLegalDocs = async (
	token: string,
	keys: string[],
	method: string = 'ui_gate'
): Promise<AcceptLegalDocsResponse> => {
	return requestLegalJson<AcceptLegalDocsResponse>(
		`${WEBUI_API_BASE_URL}/legal/accept`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify({
				keys,
				method
			})
		},
		'Не удалось принять документы. Попробуйте ещё раз.'
	);
};
