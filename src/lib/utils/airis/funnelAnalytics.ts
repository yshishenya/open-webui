import { WEBUI_API_BASE_URL } from '$lib/constants';
import { FUNNEL_REVOKE_KEY, getAnalyticsConsent } from './analyticsConsent';
export { FUNNEL_REVOKE_KEY } from './analyticsConsent';

export const FUNNEL_STORAGE_KEY = 'airis.analytics.funnel.v1';
type Touch = { occurred_at: number } & Partial<Record<(typeof CAMPAIGN_KEYS)[number], string>>;
type FunnelState = { anonymous_id: string; first_touch: Touch; last_touch: Touch };
type ContextResult = {
	analytics_user_id: string | null;
	first_prompt_at: number | null;
	first_response_at: number | null;
	server_payment_tracking: boolean;
	server_signup_tracking: boolean;
	signup_completed_at: number | null;
};
const CAMPAIGN_KEYS = [
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_content',
	'utm_term',
	'yclid',
	'gclid',
	'ymclid'
] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENTS = new Set([
	'product_first_visit',
	'landing_cta_click',
	'signup_form_viewed',
	'signup_started',
	'onboarding_completed',
	'billing_wallet_view',
	'billing_wallet_topup_package_click',
	'billing_wallet_topup_custom_submit',
	'first_prompt_submitted',
	'first_response_received'
]);
let state: FunnelState | null = null;
let account: string | null = null;
let identity: ContextResult | null = null;
let revision = 0;
let contextFingerprint = '';
let queue: Promise<unknown> = Promise.resolve();
let providerIdentity: ((id: string | null) => void) | null = null;
let deliverSignup: (() => void) | null = null;
const signupMarkers = new Set<string>();
let clientId: (() => Promise<string | null>) | null = null;
let pendingRevoke: string | null = null;

const device = (): 'phone' | 'tablet' | 'desktop' => {
	const agent = navigator.userAgent;
	if (/iPad|Tablet|Android(?!.*Mobile)/i.test(agent)) return 'tablet';
	return /Mobi|iPhone|Android/i.test(agent) ? 'phone' : 'desktop';
};
const now = (): number => Math.floor(Date.now() / 1000);
const headers = (): Record<string, string> => ({
	'Content-Type': 'application/json',
	...(localStorage.token ? { Authorization: `Bearer ${localStorage.token}` } : {})
});
const post = async (path: string, body: object): Promise<Response> => {
	const response = await fetch(`${WEBUI_API_BASE_URL}/analytics/${path}`, {
		method: 'POST',
		headers: headers(),
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(8000)
	});
	if (!response.ok) throw new Error('Analytics request failed');
	return response;
};
const persist = (): void => {
	try {
		if (state) localStorage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* optional storage */
	}
};
const readStoredTouch = (value: unknown, timestamp: number): Touch | null => {
	if (!value || typeof value !== 'object') return null;
	const raw = value as Record<string, unknown>;
	if (
		typeof raw.occurred_at !== 'number' ||
		!Number.isInteger(raw.occurred_at) ||
		raw.occurred_at < timestamp - 90 * 86400 ||
		raw.occurred_at > timestamp
	)
		return null;
	const touch: Touch = { occurred_at: raw.occurred_at };
	for (const key of CAMPAIGN_KEYS) {
		if (typeof raw[key] === 'string') {
			const safe = (raw[key] as string)
				.replace(/[\r\n]/g, ' ')
				.trim()
				.slice(0, 80);
			if (safe) touch[key] = safe;
		}
	}
	return touch;
};
export const captureFunnelTouch = (): void => {
	if (typeof window === 'undefined' || getAnalyticsConsent() !== 'granted') return;
	const timestamp = now();
	if (!state) {
		try {
			const raw = JSON.parse(
				localStorage.getItem(FUNNEL_STORAGE_KEY) || 'null'
			) as FunnelState | null;
			const first = readStoredTouch(raw?.first_touch, timestamp);
			const last = readStoredTouch(raw?.last_touch, timestamp);
			if (raw && UUID.test(raw.anonymous_id) && first && last) {
				state = { anonymous_id: raw.anonymous_id, first_touch: first, last_touch: last };
			}
		} catch {
			/* corrupt or unavailable storage */
		}
	}
	const touch: Touch = { occurred_at: timestamp };
	const params = new URLSearchParams(window.location.search);
	for (const key of CAMPAIGN_KEYS) {
		const value = params
			.get(key)
			?.replace(/[\r\n]/g, ' ')
			.trim()
			.slice(0, 80);
		if (value) touch[key] = value;
	}
	if (!state) state = { anonymous_id: crypto.randomUUID(), first_touch: touch, last_touch: touch };
	else if (Object.keys(touch).length > 1) {
		const previous = { ...state.last_touch, occurred_at: 0 };
		if (JSON.stringify(previous) !== JSON.stringify({ ...touch, occurred_at: 0 }))
			state.last_touch = touch;
	}
	persist();
};
export const configureFunnelProviders = (
	identify: (id: string | null) => void,
	getClientId: () => Promise<string | null>,
	signupCompleted?: () => void
): void => {
	providerIdentity = identify;
	clientId = getClientId;
	deliverSignup = signupCompleted ?? null;
};
const syncContext = async (): Promise<void> => {
	if (getAnalyticsConsent() !== 'granted' || localStorage.getItem(FUNNEL_REVOKE_KEY)) return;
	captureFunnelTouch();
	if (!state) return;
	const currentRevision = revision;
	const id = await clientId?.();
	if (currentRevision !== revision || getAnalyticsConsent() !== 'granted') return;
	const body = { ...state, consent: 'granted', device: device(), ...(id ? { client_id: id } : {}) };
	const fingerprint = JSON.stringify([account, body]);
	if (identity && fingerprint === contextFingerprint) return;
	const response = await post('context', body);
	const result = (await response.json()) as ContextResult;
	if (currentRevision !== revision || getAnalyticsConsent() !== 'granted') return;
	identity = result;
	contextFingerprint = fingerprint;
	providerIdentity?.(result.analytics_user_id);
	const signupAt = result.signup_completed_at;
	if (
		result.analytics_user_id &&
		typeof signupAt === 'number' &&
		signupAt >= state.first_touch.occurred_at &&
		typeof result.server_signup_tracking === 'boolean'
	) {
		const marker = `airis.analytics.signup.${result.analytics_user_id}.${signupAt}`;
		let alreadyRecorded = signupMarkers.has(marker);
		try {
			alreadyRecorded ||= localStorage.getItem(marker) === '1';
		} catch {
			/* optional storage */
		}
		if (!alreadyRecorded) {
			signupMarkers.add(marker);
			try {
				localStorage.setItem(marker, '1');
			} catch {
				/* in-memory dedup remains */
			}
			if (result.server_signup_tracking === false) deliverSignup?.();
		}
	}
};
export const syncFunnelIdentity = (userId: string | null): void => {
	if (account !== null && account !== userId) {
		revision++;
		identity = null;
		contextFingerprint = '';
		state = null;
		try {
			localStorage.removeItem(FUNNEL_STORAGE_KEY);
		} catch {
			/* optional storage */
		}
		providerIdentity?.(null);
	}
	account = userId;
	queue = queue
		.catch(() => undefined)
		.then(syncContext)
		.catch(() => undefined);
};
export const serverTracksPayments = (): boolean =>
	identity?.server_payment_tracking === true && getAnalyticsConsent() === 'granted';
export const browserTracksPayments = async (): Promise<boolean> => {
	if (getAnalyticsConsent() !== 'granted') return false;
	try {
		await queue.catch(() => undefined);
		// Payment routing must recheck destination readiness after a server configuration change.
		contextFingerprint = '';
		await syncContext();
		return identity?.server_payment_tracking === false;
	} catch {
		return false;
	}
};
export const trackFunnelEvent = (event: string, hasContent?: boolean): Promise<boolean> => {
	if (typeof window === 'undefined' || getAnalyticsConsent() !== 'granted' || !EVENTS.has(event))
		return Promise.resolve(false);
	if (event === 'first_response_received' && hasContent !== true) return Promise.resolve(false);
	captureFunnelTouch();
	if (!state || localStorage.getItem(FUNNEL_REVOKE_KEY)) return Promise.resolve(false);
	const eventId = crypto.randomUUID();
	const anonymousId = state.anonymous_id;
	const currentRevision = revision;
	const request = queue
		.catch(() => undefined)
		.then(async (): Promise<boolean> => {
			if (currentRevision !== revision || getAnalyticsConsent() !== 'granted') return false;
			await syncContext();
			if (currentRevision !== revision || getAnalyticsConsent() !== 'granted' || !identity)
				return false;
			const response = await post('events', {
				anonymous_id: anonymousId,
				event_id: eventId,
				event_name: event,
				...(hasContent !== undefined ? { has_content: hasContent } : {})
			});
			const result = (await response.json()) as { accepted: boolean };
			return (
				currentRevision === revision &&
				getAnalyticsConsent() === 'granted' &&
				result.accepted === true
			);
		})
		.catch(() => false);
	queue = request;
	return request;
};
export const revokeFunnelConsent = async (): Promise<void> => {
	revision++;
	identity = null;
	contextFingerprint = '';
	signupMarkers.clear();
	providerIdentity?.(null);
	pendingRevoke ??= state?.anonymous_id ?? null;
	try {
		const stored = JSON.parse(
			localStorage.getItem(FUNNEL_STORAGE_KEY) || 'null'
		) as FunnelState | null;
		pendingRevoke ??= stored?.anonymous_id ?? localStorage.getItem(FUNNEL_REVOKE_KEY);
		for (const key of Object.keys(localStorage)) {
			if (key.startsWith('airis.analytics.signup.')) localStorage.removeItem(key);
		}
		localStorage.removeItem(FUNNEL_STORAGE_KEY);
		if (pendingRevoke) localStorage.setItem(FUNNEL_REVOKE_KEY, pendingRevoke);
	} catch {
		// Storage failure must not prevent the server purge; retain the visitor in memory for retry.
	}
	state = null;
	if (!pendingRevoke) return;
	// Finish any already-started consent request before revoking, so its late response cannot restore server consent.
	await queue.catch(() => undefined);
	await post('context', { consent: 'denied', anonymous_id: pendingRevoke });
	localStorage.removeItem(FUNNEL_REVOKE_KEY);
	pendingRevoke = null;
};
