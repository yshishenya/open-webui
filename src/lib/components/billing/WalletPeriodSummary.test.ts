// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { BillingPeriodSummary } from '$lib/apis/billing';
import WalletPeriodSummary from './WalletPeriodSummary.svelte';

const getSummary = vi.hoisted(() => vi.fn());
vi.mock('$lib/apis/billing', () => ({ getBillingSummary: getSummary }));

it('keeps the three amount slots while loading and updates the same nodes with actual totals', async (): Promise<void> => {
	getSummary.mockClear();
	let resolveSummary: (summary: BillingPeriodSummary) => void = () => {
		throw new Error('Summary request has not started');
	};
	getSummary.mockReturnValue(
		new Promise<BillingPeriodSummary>((resolve) => {
			resolveSummary = resolve;
		})
	);
	const target = document.createElement('div');
	document.body.append(target);
	const instance = mount(WalletPeriodSummary, {
		target,
		context: new Map([['i18n', writable({ language: 'en-US', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() => expect(getSummary).toHaveBeenCalledOnce());
		const slots = Array.from(target.querySelectorAll('dd'));
		expect(slots.map((slot) => slot.textContent)).toEqual(['—', '—', '—']);
		const labels = Array.from(target.querySelectorAll('dt'), (node) => node.textContent);
		expect(target.querySelector('[role="status"]')?.textContent).toContain('Loading period totals');
		resolveSummary({
			currency: 'RUB',
			from: 1,
			to: 2,
			as_of: 2,
			topup_kopeks: 12345,
			topup_count: 1,
			refund_kopeks: 700,
			refund_count: 1,
			net_kopeks: 11645,
			spent_kopeks: 200,
			usage_count: 1,
			current_balance: {
				balance_kopeks: 11445,
				included_balance_kopeks: 0,
				daily_reserved_kopeks: 0,
				topup_expires_at: null
			},
			refund_wallet_reflection: 'requires_verification'
		});
		await vi.waitFor(() => expect(slots[0].textContent).toContain('123.45'));
		expect(Array.from(target.querySelectorAll('dd'))).toEqual(slots);
		expect(Array.from(target.querySelectorAll('dt'), (node) => node.textContent)).toEqual(labels);
		expect(slots[1].textContent).toContain('2.00');
		expect(slots[2].textContent).toContain('7.00');
		expect(target.querySelector('[role="status"]')).toBeNull();
		const startInput = target.querySelector<HTMLInputElement>('input[type="date"]');
		expect(startInput).not.toBeNull();
		if (!startInput) throw new Error('From date input is missing');
		startInput.value = '2001-01-01';
		startInput.dispatchEvent(new Event('input', { bubbles: true }));
		target
			.querySelector('form')
			?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await vi.waitFor(() =>
			expect(target.querySelector('[role="alert"]')?.textContent).toContain('Choose valid dates')
		);
		expect(Array.from(target.querySelectorAll('dd'))).toEqual(slots);
		expect(slots.map((slot) => slot.textContent)).toEqual(['—', '—', '—']);
		expect(getSummary).toHaveBeenCalledOnce();
	} finally {
		await unmount(instance);
		target.remove();
	}
});

it('keeps the same unknown amount slots when the summary request fails', async (): Promise<void> => {
	getSummary.mockClear();
	let rejectSummary: (error: Error) => void = () => {
		throw new Error('Summary request has not started');
	};
	getSummary.mockReturnValue(
		new Promise<BillingPeriodSummary>((_resolve, reject) => {
			rejectSummary = reject;
		})
	);
	const target = document.createElement('div');
	document.body.append(target);
	const instance = mount(WalletPeriodSummary, {
		target,
		context: new Map([['i18n', writable({ language: 'en-US', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() => expect(getSummary).toHaveBeenCalledOnce());
		const slots = Array.from(target.querySelectorAll('dd'));
		expect(slots.map((slot) => slot.textContent)).toEqual(['—', '—', '—']);
		rejectSummary(new Error('Controlled temporary refusal'));
		await vi.waitFor(() =>
			expect(target.querySelector('[role="alert"]')?.textContent).toContain(
				'Period totals could not be loaded'
			)
		);
		expect(Array.from(target.querySelectorAll('dd'))).toEqual(slots);
		expect(slots.map((slot) => slot.textContent)).toEqual(['—', '—', '—']);
		expect(target.querySelector('[role="status"]')).toBeNull();
	} finally {
		await unmount(instance);
		target.remove();
	}
});
