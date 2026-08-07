import { describe, expect, it } from 'vitest';

import { isPublicMarketingRoute } from './public_routes';

describe('isPublicMarketingRoute', () => {
	it('recognizes public marketing routes and nested documents', () => {
		expect(isPublicMarketingRoute('/welcome')).toBe(true);
		expect(isPublicMarketingRoute('/pricing')).toBe(true);
		expect(isPublicMarketingRoute('/documents/cookies')).toBe(true);
	});

	it('keeps authenticated and auth routes on the bootstrap path', () => {
		expect(isPublicMarketingRoute('/')).toBe(false);
		expect(isPublicMarketingRoute('/auth')).toBe(false);
		expect(isPublicMarketingRoute('/signup')).toBe(false);
		expect(isPublicMarketingRoute('/admin/billing')).toBe(false);
	});
});
