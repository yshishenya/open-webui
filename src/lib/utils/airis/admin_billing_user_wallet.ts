import type { AdjustUserWalletRequest } from '$lib/apis/admin/billing';

export interface WalletAdjustmentInput {
	delta_topup_kopeks: number;
	delta_included_kopeks: number;
	reason: string;
	idempotency_key?: string;
	reference_id?: string;
}

export type ParseRubleAmountToKopeksResult =
	| { ok: true; kopeks: number }
	| { ok: false; error: string };

const stripWhitespaceSeparators = (value: string): string => value.replace(/[\s_]/g, '');

export const parseRubleAmountToKopeks = (input: string): ParseRubleAmountToKopeksResult => {
	const raw = input.trim();
	if (!raw) {
		return { ok: true, kopeks: 0 };
	}

	let sign = 1;
	let normalized = raw;
	if (normalized.startsWith('+') || normalized.startsWith('-')) {
		sign = normalized.startsWith('-') ? -1 : 1;
		normalized = normalized.slice(1);
	}

	normalized = normalized.trim();
	if (!normalized) {
		return { ok: false, error: 'Invalid amount format' };
	}

	normalized = stripWhitespaceSeparators(normalized);

	const lastDot = normalized.lastIndexOf('.');
	const lastComma = normalized.lastIndexOf(',');

	const normalizeForDecimalSeparator = (value: string, decimalSep: '.' | ','): string => {
		const otherSep = decimalSep === '.' ? ',' : '.';

		// Remove other separator as a thousands separator (e.g. "1,000.50" or "1.000,50").
		value = value.split(otherSep).join('');

		// If the same separator is repeated, treat all but last as thousands separators.
		const parts = value.split(decimalSep);
		if (parts.length > 2) {
			const fraction = parts.pop() ?? '';
			value = parts.join('') + decimalSep + fraction;
		}

		return value;
	};

	let candidate = normalized;

	if (lastDot !== -1 || lastComma !== -1) {
		if (lastDot !== -1 && lastComma !== -1) {
			// Both present: use the last one as decimal separator, other as thousands.
			const decimalSep: '.' | ',' = lastDot > lastComma ? '.' : ',';
			candidate = normalizeForDecimalSeparator(candidate, decimalSep);
			candidate = candidate.replace(decimalSep, '.');
		} else {
			const decimalSep: '.' | ',' = lastDot !== -1 ? '.' : ',';
			candidate = normalizeForDecimalSeparator(candidate, decimalSep);

			const idx = candidate.lastIndexOf(decimalSep);
			const integerPart = candidate.slice(0, idx);
			const fractionPart = candidate.slice(idx + 1);

			// Heuristic: treat "12.345" / "12,345" as 12345 (thousands separator).
			// This avoids rejecting a common "1000" formatting habit.
			if (
				fractionPart.length === 3 &&
				integerPart.length > 0 &&
				/^[0-9]*$/.test(integerPart) &&
				/^[0-9]+$/.test(fractionPart)
			) {
				candidate = integerPart + fractionPart;
			} else {
				candidate = candidate.replace(decimalSep, '.');
			}
		}
	}

	if (candidate === '.' || !/^[0-9]*\.?[0-9]*$/.test(candidate)) {
		return { ok: false, error: 'Invalid amount format' };
	}

	const [wholeRaw, fractionRaw] = candidate.split('.');
	const whole = wholeRaw.length > 0 ? wholeRaw : '0';
	const fraction = typeof fractionRaw === 'string' ? fractionRaw : '';

	if (!/^[0-9]+$/.test(whole) || (fraction.length > 0 && !/^[0-9]+$/.test(fraction))) {
		return { ok: false, error: 'Invalid amount format' };
	}

	if (fraction.length > 2) {
		return { ok: false, error: 'Amount must have at most 2 decimal places' };
	}

	const wholeValue = Number.parseInt(whole, 10);
	const fractionValue = Number.parseInt((fraction + '00').slice(0, 2) || '0', 10);

	if (!Number.isFinite(wholeValue) || !Number.isFinite(fractionValue)) {
		return { ok: false, error: 'Invalid amount format' };
	}

	return { ok: true, kopeks: sign * (wholeValue * 100 + fractionValue) };
};

const isValidInteger = (value: number): boolean => Number.isFinite(value) && Number.isInteger(value);

export const validateWalletAdjustmentInput = (
	input: WalletAdjustmentInput
): string | null => {
	if (!isValidInteger(input.delta_topup_kopeks) || !isValidInteger(input.delta_included_kopeks)) {
		return 'Balance deltas must be integers';
	}

	if (input.delta_topup_kopeks === 0 && input.delta_included_kopeks === 0) {
		return 'At least one balance delta must be non-zero';
	}

	if (!input.reason.trim()) {
		return 'Reason is required';
	}

	return null;
};

export const buildWalletAdjustmentRequest = (
	input: WalletAdjustmentInput
): AdjustUserWalletRequest => ({
	delta_topup_kopeks: input.delta_topup_kopeks,
	delta_included_kopeks: input.delta_included_kopeks,
	reason: input.reason.trim(),
	...(input.idempotency_key ? { idempotency_key: input.idempotency_key } : {}),
	...(input.reference_id ? { reference_id: input.reference_id } : {})
});
