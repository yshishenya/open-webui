import { describe, expect, it } from 'vitest';

import { sanitizeRedirectPath, sanitizeReturnTo } from './return_to';

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

