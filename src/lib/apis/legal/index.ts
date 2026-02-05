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

export const getLegalStatus = async (token: string): Promise<LegalStatusResponse> => {
	let error: string | null = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/legal/status`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail ?? 'Failed to load legal status';
			return null;
		});

	if (error) {
		throw error;
	}

	return res as LegalStatusResponse;
};

export const getLegalRequirements = async (): Promise<LegalRequirementsResponse> => {
	let error: string | null = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/legal/requirements`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail ?? 'Failed to load legal requirements';
			return null;
		});

	if (error) {
		throw error;
	}

	return res as LegalRequirementsResponse;
};

export const acceptLegalDocs = async (
	token: string,
	keys: string[],
	method: string = 'ui_gate'
): Promise<AcceptLegalDocsResponse> => {
	let error: string | null = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/legal/accept`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			keys,
			method
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail ?? 'Failed to accept legal documents';
			return null;
		});

	if (error) {
		throw error;
	}

	return res as AcceptLegalDocsResponse;
};
