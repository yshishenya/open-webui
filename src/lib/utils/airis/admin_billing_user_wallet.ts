import type { AdjustUserWalletRequest } from '$lib/apis/admin/billing';

export interface WalletAdjustmentInput {
	delta_topup_kopeks: number;
	delta_included_kopeks: number;
	reason: string;
}

export const validateWalletAdjustmentInput = (
	input: WalletAdjustmentInput
): string | null => {
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
	reason: input.reason.trim()
});
