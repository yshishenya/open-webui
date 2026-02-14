import { describe, expect, it } from 'vitest';

import { buildTopupReturnUrl, normalizeBillingReturnPath, withBasePath } from './billing_return_url';

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
