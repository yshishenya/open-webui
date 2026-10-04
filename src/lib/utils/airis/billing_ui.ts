import type { LedgerEntry, LeadMagnetInfo, TopupReconcileResponse } from '$lib/apis/billing';

/** Accept the whole decimal amount; never silently truncate money input. */
export const parseBillingMoney = (value: string): number | null => {
	const normalized = value.trim().replace(',', '.');
	if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
	const [whole, fraction = ''] = normalized.split('.');
	const kopeks = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
	return Number.isSafeInteger(kopeks) ? kopeks : null;
};

export type PaymentReturnState =
	| 'idle'
	| 'checking'
	| 'success'
	| 'pending'
	| 'canceled'
	| 'uncredited'
	| 'unknown';
export const paymentReturnState = (result: TopupReconcileResponse | null): PaymentReturnState => {
	if (!result) return 'unknown';
	if (result.credited) return 'success';
	if (result.provider_status === 'canceled' || result.payment_status === 'canceled')
		return 'canceled';
	if (result.provider_status === 'succeeded' || result.payment_status === 'succeeded')
		return 'uncredited';
	if (
		['pending', 'waiting_for_capture'].includes(
			result.provider_status ?? result.payment_status ?? ''
		)
	)
		return 'pending';
	return 'unknown';
};

/** Settlement deltas are already part of the final usage cost, never a second expense. */
export const isTechnicalBillingEntry = (entry: LedgerEntry): boolean =>
	['hold', 'release'].includes(entry.type) ||
	(entry.type === 'adjustment' && entry.metadata_json?.reason === 'hold_overage');

/** A free text reply needs both input and output quota; an image quota alone is insufficient. */
export const hasFreeTextQuota = (info: LeadMagnetInfo | null): boolean =>
	Boolean(
		info?.enabled &&
		(info.remaining?.tokens_input ?? 0) > 0 &&
		(info.remaining?.tokens_output ?? 0) > 0
	);
