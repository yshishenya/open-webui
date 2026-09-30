// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_YANDEX_METRICA_ID: 'test-counter',
		PUBLIC_GA_MEASUREMENT_ID: ''
	}
}));

import { ANALYTICS_ATTRIBUTION_KEY, setAnalyticsConsent } from '$lib/utils/airis/analyticsConsent';
import { captureAttribution, trackEcommercePurchase, trackEvent, trackPageView } from './analytics';

const YANDEX_METRICA_ID = 'test-counter';

describe('analytics adapter', () => {
	beforeEach(() => {
		setAnalyticsConsent('denied');
		captureAttribution();
		localStorage.clear();
		sessionStorage.clear();
		document.head.innerHTML = '';
		window.history.replaceState({}, '', '/welcome');
		const analyticsWindow = window as Window & {
			ym?: unknown;
			dataLayer?: unknown;
			__airisAnalyticsInitialized?: boolean;
			__airisAnalyticsScripts?: { yandex?: boolean; google?: boolean };
		};
		delete analyticsWindow.ym;
		delete analyticsWindow.dataLayer;
		delete analyticsWindow.__airisAnalyticsInitialized;
		delete analyticsWindow.__airisAnalyticsScripts;
	});

	it('sends explicit views after consent with campaign tags and without private URL data', () => {
		window.history.replaceState({}, '', '/auth?token=private&utm_source=telegram#private');
		const ym = vi.fn();
		Object.assign(window, { ym });

		trackPageView();
		expect(ym).not.toHaveBeenCalled();
		expect(document.querySelector('#airis-yandex-metrica')).toBeNull();

		setAnalyticsConsent('granted');
		trackPageView();
		expect(ym.mock.calls).toEqual([
			[
				YANDEX_METRICA_ID,
				'init',
				expect.objectContaining({
					defer: true,
					sendTitle: false,
					webvisor: false,
					trackLinks: false,
					trackHash: false
				})
			],
			[YANDEX_METRICA_ID, 'hit', '/auth?utm_source=telegram', { referer: '' }]
		]);

		window.history.replaceState({}, '', '/billing/balance?payment_id=private');
		trackPageView();
		expect(ym).toHaveBeenLastCalledWith(
			YANDEX_METRICA_ID,
			'hit',
			'/billing/balance?utm_source=telegram',
			{ referer: `${window.location.origin}/auth?utm_source=telegram` }
		);
		expect(ym.mock.calls.filter((args) => args[1] === 'init')).toHaveLength(1);
	});

	it('preserves campaign tags through a redirect before consent without persisting them', () => {
		window.history.replaceState({}, '', '/?utm_source=telegram&yclid=123&token=private');
		captureAttribution();
		expect(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)).toBeNull();
		window.history.replaceState({}, '', '/auth');
		captureAttribution();
		const ym = vi.fn();
		Object.assign(window, { ym });
		setAnalyticsConsent('granted');
		trackPageView();
		expect(ym).toHaveBeenLastCalledWith(
			YANDEX_METRICA_ID,
			'hit',
			'/auth?utm_source=telegram&yclid=123',
			{ referer: '' }
		);
		expect(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)).toContain('telegram');
	});

	it('does not load providers before consent and removes sensitive payload keys', () => {
		window.history.replaceState({}, '', '/welcome?utm_source=telegram');
		captureAttribution();
		const received: CustomEvent[] = [];
		window.addEventListener('analytics', (event) => received.push(event as CustomEvent));

		trackEvent('landing_cta_click', {
			source: 'hero',
			email: 'hidden@example.com',
			prompt: 'private text'
		});

		expect(document.querySelectorAll('script').length).toBe(0);
		expect(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)).toBeNull();
		expect(received[0]?.detail).toEqual({ event: 'landing_cta_click', source: 'hero' });
	});

	it('loads configured providers only after explicit consent', () => {
		setAnalyticsConsent('granted');
		trackEvent('page_view', { source: 'welcome' });

		const yandexScript = document.querySelector('#airis-yandex-metrica');
		if (YANDEX_METRICA_ID) {
			expect(yandexScript).toBeTruthy();
		} else {
			expect(yandexScript).toBeNull();
		}
	});

	it('pushes a safe Yandex purchase payload after a credited top-up', () => {
		setAnalyticsConsent('granted');
		trackEcommercePurchase({ id: 'payment_test_123', revenue: 100, currency: 'RUB' });
		trackEcommercePurchase({ id: 'payment_test_123', revenue: 100, currency: 'RUB' });

		const analyticsWindow = window as Window & {
			dataLayer?: Array<Record<string, unknown>>;
		};
		const purchase = analyticsWindow.dataLayer?.find((entry) => entry.ecommerce);
		const purchases = analyticsWindow.dataLayer?.filter((entry) => entry.ecommerce) ?? [];

		if (YANDEX_METRICA_ID) {
			expect(purchases).toHaveLength(1);
			expect(purchase).toEqual({
				ecommerce: {
					currencyCode: 'RUB',
					purchase: {
						actionField: { id: 'payment_test_123', revenue: 100 },
						products: [
							{
								id: 'airis_wallet_topup',
								name: 'Airis wallet top-up',
								price: 100,
								quantity: 1
							}
						]
					}
				}
			});
		} else {
			expect(purchase).toBeUndefined();
		}
	});

	it('keeps campaign attribution bounded and emits normalized lead goals', () => {
		window.history.replaceState(
			{},
			'',
			'/welcome?utm_source=telegram&utm_campaign=summer&email=must_not_track'
		);
		setAnalyticsConsent('granted');
		captureAttribution();
		trackEvent('signup_completed', { method: 'email' });

		const received: CustomEvent[] = [];
		window.addEventListener('analytics', (event) => received.push(event as CustomEvent));
		trackEvent('first_prompt_submitted', { prompt: 'private text' });

		expect(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)).toContain('telegram');
		expect(received[0]?.detail).toMatchObject({
			event: 'first_prompt_submitted',
			utm_source: 'telegram',
			utm_campaign: 'summer'
		});
		expect(received[0]?.detail.prompt).toBeUndefined();

		if (YANDEX_METRICA_ID) {
			const analyticsWindow = window as Window & { ym?: { a?: unknown[][] } };
			const queue = analyticsWindow.ym?.a ?? [];
			expect(queue.some((args) => args.includes('lead_signup_completed'))).toBe(true);
			expect(queue.some((args) => args.includes('activation_first_prompt'))).toBe(true);
		}
	});
});
