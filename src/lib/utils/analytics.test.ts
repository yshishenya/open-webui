// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { setAnalyticsConsent } from '$lib/utils/airis/analyticsConsent';
import { trackEcommercePurchase, trackEvent } from './analytics';

describe('analytics adapter', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		document.head.innerHTML = '';
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
		if (import.meta.env.PUBLIC_YANDEX_METRICA_ID) {
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

		if (import.meta.env.PUBLIC_YANDEX_METRICA_ID) {
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
});
