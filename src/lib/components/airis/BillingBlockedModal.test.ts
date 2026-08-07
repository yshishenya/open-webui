// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';

import BillingBlockedModal from './BillingBlockedModal.svelte';
import type { BillingBlockedDetail } from '$lib/utils/airis/billing_block';

const mocks = vi.hoisted(() => ({
	gotoMock: vi.fn(),
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

		expect(root.querySelector('[role="dialog"][aria-modal="true"]')).toBeTruthy();
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

	it('keeps the payment CTA visible while an auto-top-up payment is processing', async () => {
		const root = renderModal(insufficientFunds({ auto_topup_status: 'pending' }));
		await Promise.resolve();

		expect(root.textContent).toContain('Top-up is processing');
		expect(
		[...root.querySelectorAll('button')].some((button) =>
			button.textContent?.includes('Top up balance')
		)
		).toBe(true);
	});
});
