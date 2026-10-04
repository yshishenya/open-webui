import { describe, expect, it } from 'vitest';

import { getBillingReturnTo, sanitizeRedirectPath, sanitizeReturnTo } from './return_to';

it.each([
	['/', 'saved', '/c/saved'],
	['/c/old', 'saved', '/c/saved'],
	['/c/saved?focus=topup', 'saved', '/c/saved?focus=topup'],
	['/billing/history?return_to=%2Fc%2F42', 'saved', '/c/42'],
	['/workspace', 'saved', null],
	['/', 'temporary:local', null],
	['/', 'local:legacy', null],
	['/', '', null]
])('resolves billing return from %s with chat %s', (path, chat, expected) => {
	expect(getBillingReturnTo(new URL(path!, 'http://localhost'), chat!)).toBe(expected);
});

describe('sanitizeReturnTo', () => {
	it('returns null for missing/invalid values', () => {
		expect(sanitizeReturnTo(null)).toBeNull();
		expect(sanitizeReturnTo('')).toBeNull();
		expect(sanitizeReturnTo('   ')).toBeNull();
		expect(sanitizeReturnTo('/')).toBeNull();
		expect(sanitizeReturnTo('/billing/balance')).toBeNull();
		expect(sanitizeReturnTo('https://example.com/c/123')).toBeNull();
		expect(sanitizeReturnTo('//example.com/c/123')).toBeNull();
	});

	it('allows /c/* paths', () => {
		expect(sanitizeReturnTo('/c/123')).toBe('/c/123');
		expect(sanitizeReturnTo('  /c/123  ')).toBe('/c/123');
		expect(sanitizeReturnTo('/c/123?x=1')).toBe('/c/123?x=1');
	});
});

describe('sanitizeRedirectPath', () => {
	it('returns null for missing/invalid values', () => {
		expect(sanitizeRedirectPath(null)).toBeNull();
		expect(sanitizeRedirectPath('')).toBeNull();
		expect(sanitizeRedirectPath('   ')).toBeNull();
		expect(sanitizeRedirectPath('https://example.com')).toBeNull();
		expect(sanitizeRedirectPath('javascript:alert(1)')).toBeNull();
		expect(sanitizeRedirectPath('//example.com')).toBeNull();
		expect(sanitizeRedirectPath('c/123')).toBeNull();
	});

	it('allows same-origin absolute paths', () => {
		expect(sanitizeRedirectPath('/')).toBe('/');
		expect(sanitizeRedirectPath('/c/123')).toBe('/c/123');
		expect(sanitizeRedirectPath('  /billing/balance?focus=topup  ')).toBe(
			'/billing/balance?focus=topup'
		);
	});
});
