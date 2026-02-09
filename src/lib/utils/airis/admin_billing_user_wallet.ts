import type { AdjustUserWalletRequest } from '$lib/apis/admin/billing';

export interface WalletAdjustmentInput {
	delta_topup_kopeks: number;
	delta_included_kopeks: number;
	reason: string;
	idempotency_key?: string;
	reference_id?: string;
}

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
