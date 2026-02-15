type NormalizeReturnPathOptions = {
	origin: string;
	basePath?: string;
};

type BuildTopupReturnUrlOptions = {
	origin: string;
	basePath?: string;
	returnTo?: string | null;
};

const normalizeBasePath = (basePath: string | undefined): string => {
	if (!basePath || basePath === '/') {
		return '';
	}

	const trimmed = basePath.trim();
	if (!trimmed || trimmed === '/') {
		return '';
	}

	const withoutSlashes = trimmed.replace(/^\/+|\/+$/g, '');
	if (!withoutSlashes) {
		return '';
	}

	return `/${withoutSlashes}`;
};

const ensureLeadingSlash = (pathname: string): string => {
	if (!pathname) {
		return '/';
	}
	return pathname.startsWith('/') ? pathname : `/${pathname}`;
};

export const withBasePath = (pathname: string, basePath?: string): string => {
	const normalizedBase = normalizeBasePath(basePath);
	const normalizedPath = ensureLeadingSlash(pathname);

	if (!normalizedBase) {
		return normalizedPath;
	}

	if (normalizedPath === normalizedBase || normalizedPath.startsWith(`${normalizedBase}/`)) {
		return normalizedPath;
	}

	return `${normalizedBase}${normalizedPath}`;
};

export const normalizeBillingReturnPath = (
	raw: string | null | undefined,
	options: NormalizeReturnPathOptions
): string | null => {
	if (!raw) {
		return null;
	}

	const value = raw.trim();
	if (!value) {
		return null;
	}
	if (value.startsWith('//')) {
		return null;
	}

	const toPathAndQuery = (url: URL): string => `${url.pathname}${url.search}`;

	if (value.startsWith('/')) {
		const parsed = new URL(value, options.origin);
		return withBasePath(toPathAndQuery(parsed), options.basePath);
	}

	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		return null;
	}

	if (!(parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
		return null;
	}
	if (parsed.origin !== options.origin) {
		return null;
	}

	return withBasePath(toPathAndQuery(parsed), options.basePath);
};

export const buildTopupReturnUrl = (options: BuildTopupReturnUrlOptions): string => {
	const returnPath = withBasePath('/billing/balance', options.basePath);
	const params = new URLSearchParams();
	params.set('topup_return', '1');

	const normalizedReturnTo = normalizeBillingReturnPath(options.returnTo ?? null, {
		origin: options.origin,
		basePath: options.basePath
	});
	if (normalizedReturnTo) {
		params.set('return_to', normalizedReturnTo);
	}

	return `${options.origin}${returnPath}?${params.toString()}`;
};
