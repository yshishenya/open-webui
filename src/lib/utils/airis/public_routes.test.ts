import { describe, expect, it } from 'vitest';
import { isPublicMarketingRoute } from './public_routes';

describe('isPublicMarketingRoute', () => {
	it('allows public marketing routes and legacy prices alias', () => {
		expect(isPublicMarketingRoute('/welcome')).toBe(true);
		expect(isPublicMarketingRoute('/pricing')).toBe(true);
		expect(isPublicMarketingRoute('/prices')).toBe(true);
		expect(isPublicMarketingRoute('/documents/example')).toBe(true);
	});

	it('keeps authenticated app and auth routes on normal bootstrap', () => {
		expect(isPublicMarketingRoute('/')).toBe(false);
		expect(isPublicMarketingRoute('/auth')).toBe(false);
		expect(isPublicMarketingRoute('/signup')).toBe(false);
		expect(isPublicMarketingRoute('/admin/billing')).toBe(false);
	});
});
