// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';

import BillingBlockedModal from './BillingBlockedModal.svelte';
import type { BillingBlockedDetail } from '$lib/utils/airis/billing_block';

const mocks = vi.hoisted(() => ({
	gotoMock: vi.fn(),
	reconcileTopup: vi.fn(),
	i18nStore: {
		locale: 'en',
		t: (key: string) => key,
		subscribe: (run: (value: { locale: string; t: (key: string) => string }) => void) => {
			run(mocks.i18nStore);
			return () => undefined;
		}
	}
}));

vi.mock('$app/navigation', () => ({ goto: mocks.gotoMock }));
vi.mock('$lib/apis/billing', () => ({ reconcileTopup: mocks.reconcileTopup }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({
		activate: vi.fn(),
		deactivate: vi.fn(),
		pause: vi.fn(),
		unpause: vi.fn()
	})
}));

const createContext = (): Map<string, unknown> => new Map([['i18n', mocks.i18nStore]]);

const insufficientFunds = (
	overrides: Partial<Extract<BillingBlockedDetail, { error: 'insufficient_funds' }>> = {}
): BillingBlockedDetail => ({
	error: 'insufficient_funds',
	available_kopeks: 0,
	required_kopeks: 2500,
	currency: 'RUB',
	auto_topup_status: null,
	auto_topup_payment_id: null,
	message: null,
	...overrides
});

describe('BillingBlockedModal', () => {
	let mounted: Record<string, unknown> | null = null;

	beforeEach(() => {
		mocks.gotoMock.mockReset();
		mocks.reconcileTopup.mockReset();
		document.body.innerHTML = '';
	});

	afterEach(async () => {
		if (mounted) {
			await unmount(mounted);
		}
		mounted = null;
		document.body.innerHTML = '';
	});

	const renderModal = (detail: BillingBlockedDetail, returnTo: string | null = '/c/123') => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(BillingBlockedModal, {
			target,
			context: createContext(),
			props: { open: true, detail, returnTo }
		});
		return document.body;
	};

	it('shows the shortfall and routes a blocked reply to a contextual top-up', async () => {
		const root = renderModal(insufficientFunds({ available_kopeks: 500, required_kopeks: 2500 }));
		await Promise.resolve();

		expect(
			root.querySelector('[role="dialog"][aria-modal="true"][aria-label="Insufficient funds"]')
		).toBeTruthy();
		expect(root.querySelector('button[aria-label="Close"]')).toBeTruthy();
		expect(root.querySelector('[data-testid="billing-blocked-modal"]')?.textContent).toContain(
			'Shortfall'
		);
		expect(root.querySelector('[data-testid="billing-blocked-shortfall"]')?.textContent).toContain(
			'20'
		);

		const topUp = [...root.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Top up balance')
		) as HTMLButtonElement | undefined;
		expect(topUp).toBeTruthy();
		topUp?.click();
		await Promise.resolve();

		expect(mocks.gotoMock).toHaveBeenCalledWith(
			'/billing/balance?src=chat_blocked&return_to=%2Fc%2F123&focus=topup&required_kopeks=2500'
		);
	});

	it('drops an untrusted return path from the payment CTA', async () => {
		const root = renderModal(insufficientFunds(), 'https://evil.example/steal');
		await Promise.resolve();

		const topUp = [...root.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Top up balance')
		) as HTMLButtonElement | undefined;
		topUp?.click();
		await Promise.resolve();

		expect(mocks.gotoMock).toHaveBeenCalledWith(
			'/billing/balance?src=chat_blocked&focus=topup&required_kopeks=2500'
		);
		expect(mocks.gotoMock.mock.calls[0]?.[0]).not.toContain('evil.example');
	});

	it.each(['created', 'pending', 'succeeded', 'unknown', 'failed'])(
		'checks the same %s auto-payment without creating a second payment',
		async (status) => {
			mocks.reconcileTopup.mockResolvedValue({
				payment_id: 'auto-1',
				credited: false,
				provider_status: 'pending'
			});
			const root = renderModal(
				insufficientFunds({ auto_topup_status: status, auto_topup_payment_id: 'auto-1' })
			);
			await Promise.resolve();
			const check = [...root.querySelectorAll('button')].find(
				(button) => button.textContent?.trim() === 'Check payment'
			);
			expect(check).toBeTruthy();
			expect(root.textContent).not.toContain('Top up balance');
			check?.click();
			await vi.waitFor(() =>
				expect(mocks.reconcileTopup).toHaveBeenCalledWith(undefined, 'auto-1')
			);
			await vi.waitFor(() =>
				expect(root.querySelector('[role="status"]')?.textContent).toContain(
					'Payment is processing'
				)
			);
			expect(mocks.gotoMock).not.toHaveBeenCalled();
		}
	);

	it.each([
		[{ credited: true }, 'Balance credited.'],
		[{ credited: false, provider_status: 'succeeded' }, 'balance credit is still being checked'],
		[{ credited: false, provider_status: 'canceled' }, 'Payment canceled.'],
		[null, 'Could not check the payment result']
	])(
		'distinguishes the known outcome without claiming credit from provider status alone',
		async (result, expected) => {
			mocks.reconcileTopup.mockResolvedValue(result);
			const root = renderModal(
				insufficientFunds({ auto_topup_status: 'created', auto_topup_payment_id: 'auto-1' })
			);
			await Promise.resolve();
			[...root.querySelectorAll('button')]
				.find((button) => button.textContent?.trim() === 'Check payment')
				?.click();
			await vi.waitFor(() =>
				expect(root.querySelector('[role="status"]')?.textContent).toContain(expected)
			);
			expect(mocks.gotoMock).not.toHaveBeenCalled();
		}
	);

	it('offers a safe history lookup when the pending payment ID is absent', async () => {
		const root = renderModal(insufficientFunds({ auto_topup_status: 'pending' }));
		await Promise.resolve();
		[...root.querySelectorAll('button')]
			.find((button) => button.textContent?.trim() === 'Check payment')
			?.click();
		await vi.waitFor(() =>
			expect(mocks.gotoMock).toHaveBeenCalledWith('/billing/history?filter=topups')
		);
		expect(mocks.reconcileTopup).not.toHaveBeenCalled();
	});

	it('requires an explicit additional-payment action to navigate to top-up', async () => {
		const root = renderModal(
			insufficientFunds({ auto_topup_status: 'pending', auto_topup_payment_id: 'auto-1' })
		);
		await Promise.resolve();
		[...root.querySelectorAll('button')]
			.find((button) => button.textContent?.trim() === 'Make an additional top-up')
			?.click();
		await vi.waitFor(() =>
			expect(mocks.gotoMock).toHaveBeenCalledWith(expect.stringContaining('focus=topup'))
		);
		expect(mocks.reconcileTopup).not.toHaveBeenCalled();
	});

	it.each([0, 10000])(
		'explains spending plus holds and a new reserve for a cap of %i without offering top-up',
		async (cap) => {
			const root = renderModal({
				error: 'daily_cap_exceeded',
				daily_cap_kopeks: cap,
				daily_spent_kopeks: 2000,
				daily_reserved_kopeks: 7000,
				daily_reset_at: 1800000000,
				required_kopeks: 2000
			});
			await Promise.resolve();
			expect(root.querySelector('[role="dialog"][aria-label="Daily cap reached"]')).toBeTruthy();
			expect(root.querySelector('[data-testid="daily-reserved"]')?.textContent).toContain('70');
			expect(root.textContent).toContain('Reserve needed for this request');
			expect(root.textContent).toContain('Adding money does not raise the daily cap');
			expect(root.textContent).toContain('Resets at');
			expect(root.textContent).not.toContain('Top up balance');
		}
	);
});
