export interface MoneyFilters {
	currency: string;
	fromDate: string;
	toDate: string;
}
export const moneyPage = (value: string | null): number => {
	const parsed = Math.floor(Number(value));
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
};
export const moneyFilters = (url: URL, now = new Date()): MoneyFilters => {
	const end = now.toISOString().slice(0, 10);
	const start = new Date(now);
	start.setUTCDate(start.getUTCDate() - 29);
	const code = url.searchParams.get('currency') || 'RUB';
	return {
		currency: ['RUB', 'USD', 'EUR'].includes(code) ? code : 'RUB',
		fromDate:
			url.searchParams.get('from_date') ||
			url.searchParams.get('from') ||
			start.toISOString().slice(0, 10),
		toDate: url.searchParams.get('to_date') || url.searchParams.get('to') || end
	};
};
export const moneyRange = (
	filters: MoneyFilters
): { currency: string; from: number; to: number } => {
	const from = Date.parse(`${filters.fromDate}T00:00:00Z`) / 1000;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(filters.toDate))
		throw new Error('Choose a valid date range');
	if (
		!Number.isFinite(from) ||
		new Date(from * 1000).toISOString().slice(0, 10) !== filters.fromDate
	)
		throw new Error('Choose a valid date range');
	const to = Date.parse(`${filters.toDate}T00:00:00Z`) / 1000 + 86400;
	if (
		!Number.isFinite(to) ||
		new Date((to - 86400) * 1000).toISOString().slice(0, 10) !== filters.toDate ||
		from >= to
	)
		throw new Error('Choose a valid date range');
	if (to - from > 366 * 86400) throw new Error('Choose a range of at most 366 days');
	return { currency: filters.currency, from, to };
};
export const moneyQuery = (
	filters: MoneyFilters,
	extra: Record<string, string | number> = {}
): string =>
	new URLSearchParams({
		currency: filters.currency,
		from_date: filters.fromDate,
		to_date: filters.toDate,
		...Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, String(value)]))
	}).toString();
export const customerHref = (id: string, filters: MoneyFilters, back = ''): string =>
	`/admin/billing/customers/${encodeURIComponent(id)}?${moneyQuery(filters, back ? { back } : {})}`;
export const reportingBack = (value: string | null): string =>
	value &&
	/^\/admin\/billing\/(?:(?:customers|transactions)(?:\?|$)|plans\/[^/?#]+\/subscribers(?:\?|$))/.test(
		value
	)
		? value
		: '/admin/billing/customers';
export const formatReportMoney = (kopeks: number, currency = 'RUB', locale = 'ru-RU'): string =>
	new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(
		kopeks / 100
	);
export const formatReportTime = (value: number | null | undefined, locale = 'ru-RU'): string =>
	value ? new Date(value * 1000).toLocaleString(locale, { timeZone: 'UTC' }) : '—';
export const paymentLabel = (status: string): string =>
	(
		({
			succeeded: 'Payment confirmed',
			pending: 'Awaiting payment',
			waiting_for_capture: 'Awaiting confirmation',
			failed: 'Payment failed',
			canceled: 'Payment canceled'
		}) as Record<string, string>
	)[status] || 'Status unavailable';
export const ledgerLabel = (type: string): string =>
	(
		({
			topup: 'Wallet credited',
			hold: 'Funds reserved',
			release: 'Reservation released',
			charge: 'Usage settled',
			adjustment: 'Balance adjustment',
			refund: 'Wallet credit adjustment',
			expire: 'Balance expired'
		}) as Record<string, string>
	)[type] || type;
export const modalityLabel = (value: string): string =>
	(
		({
			text: 'Text',
			image: 'Images',
			tts: 'Speech synthesis',
			stt: 'Speech recognition'
		}) as Record<string, string>
	)[value] || value;

export const priceToKopeks = (value: string): number | null => {
	const normalized = value.trim().replace(',', '.');
	if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
	const [whole, fraction = ''] = normalized.split('.');
	const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
	return Number.isSafeInteger(amount) ? amount : null;
};
