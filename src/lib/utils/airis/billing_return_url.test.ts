import { describe, expect, it } from 'vitest';

import {
	buildTopupReturnUrl,
	normalizeBillingReturnPath,
	topupReturnPaymentId,
	topupReturnStorageKey,
	withBasePath
} from './billing_return_url';

describe('topupReturnPaymentId', () => {
	it('prefers payment-specific recovery identity over an unrelated provider query', () => {
		expect(
			topupReturnPaymentId(
				new URL(
					'https://airis.example/billing/balance?topup_payment_id=owned-payment&payment_id=another-payment'
				)
			)
		).toBe('owned-payment');
	});
	it.each(['', 'https://evil.example', '../payment', 'a'.repeat(129)])(
		'rejects malformed identity %s',
		(id) => {
			const url = new URL('https://airis.example/billing/balance');
			url.searchParams.set('topup_payment_id', id);
			expect(topupReturnPaymentId(url)).toBeNull();
		}
	);
});

describe('withBasePath', () => {
	it('prefixes non-root base path once', () => {
		expect(withBasePath('/billing/balance', '/app')).toBe('/app/billing/balance');
		expect(withBasePath('/app/billing/balance', '/app')).toBe('/app/billing/balance');
	});

	it('keeps root deployment paths unchanged', () => {
		expect(withBasePath('/billing/balance', '')).toBe('/billing/balance');
		expect(withBasePath('/billing/balance', '/')).toBe('/billing/balance');
	});
});

describe('normalizeBillingReturnPath', () => {
	const options = { origin: 'https://airis.example', basePath: '/app' };

	it('normalizes app-relative paths, strips hash, and applies base path', () => {
		expect(normalizeBillingReturnPath('/c/123?x=1#frag', options)).toBe('/app/c/123?x=1');
	});

	it('accepts same-origin absolute URLs and rejects external origins/schemes', () => {
		expect(normalizeBillingReturnPath('https://airis.example/c/42?tab=1#hash', options)).toBe(
			'/app/c/42?tab=1'
		);
		expect(normalizeBillingReturnPath('https://evil.example/c/42', options)).toBeNull();
		expect(normalizeBillingReturnPath('javascript:alert(1)', options)).toBeNull();
		expect(normalizeBillingReturnPath('//evil.example/path', options)).toBeNull();
	});
});

describe('buildTopupReturnUrl', () => {
	it('preserves distinct payment return identities without exposing storage contents', () => {
		const first = new URL(
			buildTopupReturnUrl({ origin: 'https://airis.example', flowId: 'first-flow' })
		);
		const second = new URL(
			buildTopupReturnUrl({ origin: 'https://airis.example', flowId: 'second-flow' })
		);
		expect(topupReturnStorageKey(first)).toBe('billing_topup_flow_v1:first-flow');
		expect(topupReturnStorageKey(second)).toBe('billing_topup_flow_v1:second-flow');
		expect(first.searchParams.get('topup_return')).toBe('1');
	});
	it('builds deterministic base-aware return URL', () => {
		const returnUrl = buildTopupReturnUrl({
			origin: 'https://airis.example',
			basePath: '/app',
			returnTo: '/c/123?focus=topup'
		});

		expect(returnUrl).toBe(
			'https://airis.example/app/billing/balance?topup_return=1&return_to=%2Fapp%2Fc%2F123%3Ffocus%3Dtopup'
		);
	});

	it('omits return_to when value is invalid', () => {
		const returnUrl = buildTopupReturnUrl({
			origin: 'https://airis.example',
			basePath: '/app',
			returnTo: 'https://evil.example/path'
		});
		expect(returnUrl).toBe('https://airis.example/app/billing/balance?topup_return=1');
	});
});
