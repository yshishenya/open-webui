const PUBLIC_MARKETING_ROUTES = new Set([
	'/welcome',
	'/features',
	'/pricing',
	'/about',
	'/contact',
	'/privacy',
	'/terms'
]);

/**
 * Public marketing pages do not need backend/session bootstrap to render.
 * Keep the authenticated app and auth routes on the normal initialization path.
 */
export const isPublicMarketingRoute = (pathname: string): boolean =>
	PUBLIC_MARKETING_ROUTES.has(pathname) ||
	pathname === '/documents' ||
	pathname.startsWith('/documents/');
