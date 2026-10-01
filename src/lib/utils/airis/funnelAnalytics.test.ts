// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
import { setAnalyticsConsent } from './analyticsConsent';

describe('consent-bound product funnel', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
		window.history.replaceState({}, '', '/welcome');
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
	const settle = async (): Promise<void> => {
		await new Promise((resolve) => setTimeout(resolve, 25));
	};
	const successfulFetch = () =>
		vi.fn().mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						analytics_user_id: 'opaque',
						first_prompt_at: null,
						first_response_at: null,
						server_payment_tracking: true,
						accepted: true
					}),
					{ status: 200 }
				)
		);

	it('does not store identifiers or send events before consent', async () => {
		const fetchMock = successfulFetch();
		vi.stubGlobal('fetch', fetchMock);
		const api = await import('./funnelAnalytics');
		api.captureFunnelTouch();
		api.trackFunnelEvent('product_first_visit');
		await settle();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(localStorage.getItem(api.FUNNEL_STORAGE_KEY)).toBeNull();
	});
	it('preserves first campaign while updating last campaign and keeps it through direct return', async () => {
		const api = await import('./funnelAnalytics');
		setAnalyticsConsent('granted');
		window.history.replaceState({}, '', '/welcome?utm_source=first&token=secret');
		api.captureFunnelTouch();
		window.history.replaceState({}, '', '/pricing?utm_source=last');
		api.captureFunnelTouch();
		window.history.replaceState({}, '', '/auth');
		api.captureFunnelTouch();
		const stored = JSON.parse(localStorage.getItem(api.FUNNEL_STORAGE_KEY) || '{}');
		expect(stored.first_touch.utm_source).toBe('first');
		expect(stored.last_touch.utm_source).toBe('last');
		expect(JSON.stringify(stored)).not.toContain('secret');
		expect(stored.first_touch.occurred_at).toBeLessThan(1e11);
	});
	it('links identity and records only a successful response with a bounded payload', async () => {
		const fetchMock = successfulFetch();
		vi.stubGlobal('fetch', fetchMock);
		const api = await import('./funnelAnalytics');
		setAnalyticsConsent('granted');
		const identify = vi.fn();
		api.configureFunnelProviders(identify, async () => '123');
		api.syncFunnelIdentity('internal-user');
		api.trackFunnelEvent('first_response_received', false);
		api.trackFunnelEvent('first_response_received', true);
		await settle();
		expect(identify).toHaveBeenCalledWith('opaque');
		expect(api.serverTracksPayments()).toBe(true);
		const eventBodies = fetchMock.mock.calls
			.filter(([url]) => String(url).endsWith('/events'))
			.map(([, options]) => JSON.parse(options.body));
		expect(eventBodies).toHaveLength(1);
		expect(eventBodies[0]).toEqual({
			anonymous_id: expect.any(String),
			event_id: expect.any(String),
			event_name: 'first_response_received',
			has_content: true
		});
		expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('internal-user');
	});
	it('rotates visitor identity and clears provider identification on logout', async () => {
		vi.stubGlobal('fetch', successfulFetch());
		const api = await import('./funnelAnalytics');
		setAnalyticsConsent('granted');
		const identify = vi.fn();
		api.configureFunnelProviders(identify, async () => null);
		api.syncFunnelIdentity('one');
		await settle();
		const previous = JSON.parse(localStorage.getItem(api.FUNNEL_STORAGE_KEY) || '{}').anonymous_id;
		api.syncFunnelIdentity(null);
		await settle();
		expect(identify).toHaveBeenCalledWith(null);
		expect(JSON.parse(localStorage.getItem(api.FUNNEL_STORAGE_KEY) || '{}').anonymous_id).not.toBe(
			previous
		);
	});
	it('keeps denied after failed revoke and retries the same visitor without events', async () => {
		const api = await import('./funnelAnalytics');
		setAnalyticsConsent('granted');
		api.captureFunnelTouch();
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue(new Response('{}'));
		vi.stubGlobal('fetch', fetchMock);
		setAnalyticsConsent('denied');
		await expect(api.revokeFunnelConsent()).rejects.toThrow();
		expect(localStorage.getItem(api.FUNNEL_STORAGE_KEY)).toBeNull();
		expect(localStorage.getItem(api.FUNNEL_REVOKE_KEY)).not.toBeNull();
		api.trackFunnelEvent('product_first_visit');
		await api.revokeFunnelConsent();
		expect(localStorage.getItem(api.FUNNEL_REVOKE_KEY)).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(
			JSON.parse(fetchMock.mock.calls[1][1].body)
		);
	});
	it('rejects duplicate lifetime acknowledgement and keeps browser purchases disabled for server transport', async () => {
		const fetchMock = vi.fn().mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						analytics_user_id: 'opaque',
						server_payment_tracking: true,
						accepted: false
					})
				)
		);
		vi.stubGlobal('fetch', fetchMock);
		const api = await import('./funnelAnalytics');
		setAnalyticsConsent('granted');
		expect(await api.trackFunnelEvent('first_response_received', true)).toBe(false);
		expect(await api.browserTracksPayments()).toBe(false);
	});

	it('refreshes payment routing when server delivery is enabled in an open tab', async () => {
		let serverTracking = false;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				async () =>
					new Response(
						JSON.stringify({
							analytics_user_id: 'opaque',
							server_payment_tracking: serverTracking
						})
					)
			)
		);
		const api = await import('./funnelAnalytics');
		setAnalyticsConsent('granted');
		expect(await api.browserTracksPayments()).toBe(true);
		serverTracking = true;
		expect(await api.browserTracksPayments()).toBe(false);
	});

	it('purges unknown stored properties before linking the context', async () => {
		const api = await import('./funnelAnalytics');
		setAnalyticsConsent('granted');
		api.captureFunnelTouch();
		const stored = JSON.parse(localStorage.getItem(api.FUNNEL_STORAGE_KEY) || '{}');
		stored.first_touch.email = 'private@example.com';
		stored.token = 'secret';
		localStorage.setItem(api.FUNNEL_STORAGE_KEY, JSON.stringify(stored));
		vi.resetModules();
		const fresh = await import('./funnelAnalytics');
		const fetchMock = successfulFetch();
		vi.stubGlobal('fetch', fetchMock);
		await fresh.trackFunnelEvent('product_first_visit');
		expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('private@example.com');
		expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('secret');
	});
	it('emits only server-proven signup once and suppresses server transport and revoked history', async () => {
		let serverTracking = false;
		let signupAt = Math.floor(Date.now() / 1000);
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				async () =>
					new Response(
						JSON.stringify({
							analytics_user_id: 'opaque',
							server_payment_tracking: false,
							server_signup_tracking: serverTracking,
							signup_completed_at: signupAt,
							accepted: true
						})
					)
			)
		);
		const api = await import('./funnelAnalytics');
		setAnalyticsConsent('granted');
		const signup = vi.fn();
		api.configureFunnelProviders(vi.fn(), async () => null, signup);
		api.syncFunnelIdentity('one');
		await settle();
		api.syncFunnelIdentity('one');
		await settle();
		expect(signup).toHaveBeenCalledTimes(1);
		setAnalyticsConsent('denied');
		await api.revokeFunnelConsent();
		signupAt -= 60;
		setAnalyticsConsent('granted');
		api.syncFunnelIdentity('one');
		await settle();
		expect(signup).toHaveBeenCalledTimes(1);
		setAnalyticsConsent('denied');
		await api.revokeFunnelConsent();
		serverTracking = true;
		signupAt = Math.floor(Date.now() / 1000);
		setAnalyticsConsent('granted');
		api.syncFunnelIdentity('one');
		await settle();
		expect(signup).toHaveBeenCalledTimes(1);
	});
});
