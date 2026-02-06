export const sanitizeReturnTo = (raw: string | null): string | null => {
	if (!raw) return null;
	const value = raw.trim();
	if (!value.startsWith('/c/')) return null;
	if (value.startsWith('//')) return null;
	if (value.includes('://')) return null;
	return value;
};

