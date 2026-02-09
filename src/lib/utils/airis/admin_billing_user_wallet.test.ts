// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }), { virtual: true });

import {
	adjustUserWalletAdmin,
	getUserWalletAdmin,
	type AdjustUserWalletRequest
} from '$lib/apis/admin/billing';

import {
	buildWalletAdjustmentRequest,
	validateWalletAdjustmentInput
} from './admin_billing_user_wallet';

const jsonResponse = (body: unknown, status: number = 200): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body
	}) as Response;

describe('airis/admin_billing_user_wallet', () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		fetchMock.mockReset();
		vi.unstubAllGlobals();
	});

	it('getUserWalletAdmin returns wallet summary on success', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				user_id: 'user-1',
				wallet: {
					id: 'wallet-1',
					user_id: 'user-1',
					currency: 'RUB',
					balance_topup_kopeks: 1000,
					balance_included_kopeks: 2500,
					daily_spent_kopeks: 0,
					daily_cap_kopeks: null,
					created_at: 1,
					updated_at: 1
				},
				ledger_preview: []
			})
		);

		const result = await getUserWalletAdmin('token-1', 'user-1');

		expect(result.user_id).toBe('user-1');
		expect(result.wallet.balance_topup_kopeks).toBe(1000);
		const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain('/admin/billing/users/user-1/wallet');
		expect((options.headers as Headers).get('Authorization')).toBe('Bearer token-1');
	});

	it('getUserWalletAdmin throws user-safe API detail on error', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ detail: 'User not found' }, 404));

		await expect(getUserWalletAdmin('token-1', 'missing-user')).rejects.toThrow('User not found');
	});

	it('adjustUserWalletAdmin sends payload and returns response', async () => {
		const payload: AdjustUserWalletRequest = {
			delta_topup_kopeks: 1200,
			delta_included_kopeks: -200,
			reason: 'manual correction'
		};
		fetchMock.mockResolvedValue(
			jsonResponse({
				success: true,
				wallet: {
					id: 'wallet-1',
					user_id: 'user-1',
					currency: 'RUB',
					balance_topup_kopeks: 2200,
					balance_included_kopeks: 2300,
					daily_spent_kopeks: 0,
					daily_cap_kopeks: null,
					created_at: 1,
					updated_at: 2
				},
				ledger_entry: {
					id: 'entry-1',
					user_id: 'user-1',
					wallet_id: 'wallet-1',
					currency: 'RUB',
					type: 'adjustment',
					amount_kopeks: 1000,
					balance_included_after: 2300,
					balance_topup_after: 2200,
					reference_id: 'ref-1',
					reference_type: 'admin_wallet_adjustment',
					idempotency_key: null,
					metadata_json: null,
					created_at: 2
				}
			})
		);

		const result = await adjustUserWalletAdmin('token-1', 'user-1', payload);

		expect(result.success).toBe(true);
		const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain('/admin/billing/users/user-1/wallet/adjust');
		expect(options.method).toBe('POST');
		expect(options.body).toBe(JSON.stringify(payload));
	});

	it('adjustUserWalletAdmin throws API detail on error', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ detail: 'reason is required' }, 400));

		await expect(
			adjustUserWalletAdmin('token-1', 'user-1', {
				delta_topup_kopeks: 100,
				delta_included_kopeks: 0,
				reason: ''
			})
		).rejects.toThrow('reason is required');
	});

	it('validation helpers reject invalid input and normalize reason', () => {
		expect(
			validateWalletAdjustmentInput({
				delta_topup_kopeks: 0,
				delta_included_kopeks: 0,
				reason: 'valid'
			})
		).toBe('At least one balance delta must be non-zero');

		expect(
			validateWalletAdjustmentInput({
				delta_topup_kopeks: 100,
				delta_included_kopeks: 0,
				reason: '   '
			})
		).toBe('Reason is required');

		expect(
			buildWalletAdjustmentRequest({
				delta_topup_kopeks: 100,
				delta_included_kopeks: -50,
				reason: '  manual correction  '
			})
		).toEqual({
			delta_topup_kopeks: 100,
			delta_included_kopeks: -50,
			reason: 'manual correction'
		});
	});
});
