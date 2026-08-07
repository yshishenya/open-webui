// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { setAnalyticsConsent } from '$lib/utils/airis/analyticsConsent';
import { PUBLIC_YANDEX_METRICA_ID } from '$env/static/public';
import { captureAttribution, trackEcommercePurchase, trackEvent } from './analytics';

describe('analytics adapter', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		document.head.innerHTML = '';
		window.history.replaceState({}, '', '/welcome');
	});

	it('does not load providers before consent and removes sensitive payload keys', () => {
		const received: CustomEvent[] = [];
		window.addEventListener('analytics', (event) => received.push(event as CustomEvent));

		trackEvent('landing_cta_click', {
			source: 'hero',
			email: 'hidden@example.com',
			prompt: 'private text'
		});

		expect(document.querySelectorAll('script').length).toBe(0);
		expect(received[0]?.detail).toEqual({ event: 'landing_cta_click', source: 'hero' });
	});

	it('loads configured providers only after explicit consent', () => {
		setAnalyticsConsent('granted');
		trackEvent('page_view', { source: 'welcome' });

		const yandexScript = document.querySelector('#airis-yandex-metrica');
		if (PUBLIC_YANDEX_METRICA_ID) {
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

		if (PUBLIC_YANDEX_METRICA_ID) {
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
		captureAttribution();
		setAnalyticsConsent('granted');
		trackEvent('signup_completed', { method: 'email' });

		const received: CustomEvent[] = [];
		window.addEventListener('analytics', (event) => received.push(event as CustomEvent));
		trackEvent('first_prompt_submitted', { prompt: 'private text' });

		expect(localStorage.getItem('airis.analytics.attribution.v1')).toContain('telegram');
		expect(received[0]?.detail).toMatchObject({
			event: 'first_prompt_submitted',
			utm_source: 'telegram',
			utm_campaign: 'summer'
		});
		expect(received[0]?.detail.prompt).toBeUndefined();

		if (PUBLIC_YANDEX_METRICA_ID) {
			const analyticsWindow = window as Window & { ym?: { a?: unknown[][] } };
			const queue = analyticsWindow.ym?.a ?? [];
			expect(queue.some((args) => args.includes('lead_signup_completed'))).toBe(true);
			expect(queue.some((args) => args.includes('activation_first_prompt'))).toBe(true);
		}
	});
});
