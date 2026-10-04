import { isTemporaryChatId } from '$lib/utils/chatId';

export const sanitizeReturnTo = (raw: string | null): string | null => {
	if (!raw) return null;
	const value = raw.trim();
	if (!value.startsWith('/c/')) return null;
	if (value.startsWith('//')) return null;
	if (value.includes('://')) return null;
	return value;
};

export const sanitizeRedirectPath = (raw: string | null): string | null => {
	if (!raw) return null;
	const value = raw.trim();
	if (!value.startsWith('/')) return null;
	if (value.startsWith('//')) return null;
	if (value.includes('://')) return null;
	return value;
};

export const getBillingReturnTo = (url: URL, activeChatId: string): string | null => {
	const requested = sanitizeReturnTo(url.searchParams.get('return_to'));
	if (requested) return requested;
	if (
		activeChatId &&
		!isTemporaryChatId(activeChatId) &&
		(url.pathname === '/' || url.pathname.startsWith('/c/')) &&
		url.pathname !== `/c/${activeChatId}`
	) {
		return sanitizeReturnTo(`/c/${activeChatId}`);
	}
	return sanitizeReturnTo(`${url.pathname}${url.search}`);
};
