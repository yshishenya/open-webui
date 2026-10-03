import { WEBUI_API_BASE_URL } from '$lib/constants';

export interface DiagnosticRun {
	id: string;
	started_at: number;
	finished_at: number | null;
	status: 'running' | 'completed' | 'failed';
	cursor: number;
	upper_ordinal: number;
	scanned_members: number;
	scanned_scenarios: number;
	missing_source_members: number;
	failure_reason: string | null;
	lease_until: number | null;
}

export interface DiagnosticScope {
	id: string;
	purpose: 'diagnostic';
	administrative: boolean;
	declared_at: number;
	observed_from: number | null;
	closed_at: number | null;
	registrations_from: number;
	registrations_until: number;
	payments_from: number;
	payments_until: number;
	member_count: number;
	last_run: DiagnosticRun | null;
}

export interface DiagnosticDeclaration {
	request_key: string;
	user_ids: string[];
	registrations_from: number;
	registrations_until: number;
	payments_from: number;
	payments_until: number;
}

export interface DiagnosticStart {
	request_key: string;
	expected_run_id: string | null;
}

export interface DiagnosticLease {
	scope: DiagnosticScope;
	run_id: string;
	claim_id: string | null;
}

export interface DiagnosticPage {
	run_id: string;
	claim_id: string;
	expected_cursor: number;
}

export interface DiagnosticScopes {
	items: DiagnosticScope[];
	next_cursor: string | null;
}

export class DiagnosticRequestError extends Error {
	constructor(
		public status: number,
		public code: string
	) {
		super(code);
	}
}

export interface ObservationApi {
	read(id: string): Promise<DiagnosticScope>;
	start(id: string, form: DiagnosticStart): Promise<DiagnosticLease>;
	page(id: string, form: DiagnosticPage): Promise<DiagnosticScope>;
}

async function request<T>(token: string, path: string, body?: object): Promise<T> {
	const response = await fetch(`${WEBUI_API_BASE_URL}/admin/email-observations${path}`, {
		method: body === undefined ? 'GET' : 'POST',
		cache: 'no-store',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(70000)
	});
	if (!response.ok) {
		const payload: unknown = await response.json().catch(() => null);
		const detail =
			payload && typeof payload === 'object' && 'detail' in payload ? payload.detail : null;
		const code =
			typeof detail === 'string' && /^[a-z_]{1,64}$/.test(detail) ? detail : 'unavailable';
		throw new DiagnosticRequestError(response.status, code);
	}
	return (await response.json()) as T;
}

export const observationApi = (token: string): ObservationApi => ({
	read: (id) => request(token, `/${encodeURIComponent(id)}`),
	start: (id, form) => request(token, `/${encodeURIComponent(id)}/runs`, form),
	page: (id, form) => request(token, `/${encodeURIComponent(id)}/pages`, form)
});

export const listDiagnosticScopes = (
	token: string,
	after: string | null = null
): Promise<DiagnosticScopes> => request(token, after ? `?after=${encodeURIComponent(after)}` : '');

export const declareDiagnosticScope = (
	token: string,
	form: DiagnosticDeclaration
): Promise<DiagnosticScope> => request(token, '', form);

export const closeDiagnosticScope = (token: string, id: string): Promise<DiagnosticScope> =>
	request(token, `/${encodeURIComponent(id)}/closure`, {});
