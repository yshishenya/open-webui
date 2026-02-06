import { parseBillingBlockedDetail, type BillingBlockedDetail } from '$lib/utils/airis/billing_block';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const tryParseJsonTail = (value: string): unknown => {
	// Backend sometimes stringifies HTTPException as: "402: {'error': 'insufficient_funds', ...}"
	// Python repr is not JSON; we support only a conservative subset by rewriting quotes.
	const idx = value.indexOf('{');
	if (idx < 0) return null;
	const tail = value.slice(idx).trim();
	if (!tail.endsWith('}')) return null;

	// Convert a very limited python-dict repr to JSON:
	// - single quotes to double quotes
	// - None/True/False to null/true/false
	// This is intentionally conservative; if it fails, we return null.
	const asJson = tail
		.replace(/\bNone\b/g, 'null')
		.replace(/\bTrue\b/g, 'true')
		.replace(/\bFalse\b/g, 'false')
		.replace(/'/g, '"');

	try {
		return JSON.parse(asJson);
	} catch {
		return null;
	}
};

export const parseWsBillingBlockedDetail = (value: unknown): BillingBlockedDetail | null => {
	// Common cases: { error: "insufficient_funds", ... }
	const direct = parseBillingBlockedDetail(value);
	if (direct) return direct;

	// Some websocket payloads look like: { content: "402: {...}" } or { content: {...} }
	if (isRecord(value)) {
		// Preferred structured payload from backend task-mode: { content: string, detail: { error: ... } }
		const detail = value.detail;
		const fromDetail = parseBillingBlockedDetail(detail);
		if (fromDetail) return fromDetail;

		const content = value.content;
		const fromContent = parseBillingBlockedDetail(content);
		if (fromContent) return fromContent;

		if (typeof content === 'string') {
			const parsed = tryParseJsonTail(content);
			return parseBillingBlockedDetail(parsed);
		}
	}

	if (typeof value === 'string') {
		const parsed = tryParseJsonTail(value);
		return parseBillingBlockedDetail(parsed);
	}

	return null;
};
