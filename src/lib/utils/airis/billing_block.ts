import { sanitizeReturnTo } from '$lib/utils/airis/return_to';

export type BillingBlockedErrorCode =
	| 'insufficient_funds'
	| 'daily_cap_exceeded'
	| 'max_reply_cost_exceeded';

type BillingBlockedBase = {
	error: BillingBlockedErrorCode;
};

export type BillingBlockedInsufficientFunds = BillingBlockedBase & {
	error: 'insufficient_funds';
	available_kopeks: number | null;
	required_kopeks: number | null;
	currency: string | null;
	auto_topup_status: string | null;
	auto_topup_payment_id: string | null;
	message: string | null;
};

export type BillingBlockedDailyCapExceeded = BillingBlockedBase & {
	error: 'daily_cap_exceeded';
	daily_cap_kopeks: number | null;
	daily_spent_kopeks: number | null;
	daily_reset_at: number | null;
	required_kopeks: number | null;
};

export type BillingBlockedMaxReplyCostExceeded = BillingBlockedBase & {
	error: 'max_reply_cost_exceeded';
	max_reply_cost_kopeks: number | null;
	required_kopeks: number | null;
};

export type BillingBlockedDetail =
	| BillingBlockedInsufficientFunds
	| BillingBlockedDailyCapExceeded
	| BillingBlockedMaxReplyCostExceeded;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const parseNumber = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

const parseString = (value: unknown): string | null =>
	typeof value === 'string' && value.trim().length > 0 ? value : null;

export const parseBillingBlockedDetail = (value: unknown): BillingBlockedDetail | null => {
	if (!isRecord(value)) return null;
	const error = value.error;
	if (error === 'insufficient_funds') {
		return {
			error,
			available_kopeks: parseNumber(value.available_kopeks),
			required_kopeks: parseNumber(value.required_kopeks),
			currency: parseString(value.currency),
			auto_topup_status: parseString(value.auto_topup_status),
			auto_topup_payment_id: parseString(value.auto_topup_payment_id),
			message: parseString(value.message)
		};
	}
	if (error === 'daily_cap_exceeded') {
		return {
			error,
			daily_cap_kopeks: parseNumber(value.daily_cap_kopeks),
			daily_spent_kopeks: parseNumber(value.daily_spent_kopeks),
			daily_reset_at: parseNumber(value.daily_reset_at),
			required_kopeks: parseNumber(value.required_kopeks)
		};
	}
	if (error === 'max_reply_cost_exceeded') {
		return {
			error,
			max_reply_cost_kopeks: parseNumber(value.max_reply_cost_kopeks),
			required_kopeks: parseNumber(value.required_kopeks)
		};
	}
	return null;
};

export type BillingBalanceFocus = 'topup' | 'limits' | 'auto_topup';

export const buildBillingBalanceHref = (options: {
	returnTo: string | null;
	focus?: BillingBalanceFocus | null;
	requiredKopeks?: number | null;
	src?: string | null;
}): string => {
	const params = new URLSearchParams();
	if (options.src) {
		params.set('src', options.src);
	}
	const returnTo = sanitizeReturnTo(options.returnTo);
	if (returnTo) {
		params.set('return_to', returnTo);
	}
	if (options.focus) {
		params.set('focus', options.focus);
	}
	if (typeof options.requiredKopeks === 'number' && options.requiredKopeks > 0) {
		params.set('required_kopeks', String(options.requiredKopeks));
	}
	const query = params.toString();
	return query ? `/billing/balance?${query}` : '/billing/balance';
};

