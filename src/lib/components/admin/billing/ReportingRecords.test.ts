// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { BillingReportingPayment } from '$lib/apis/admin/billing_reporting';
import ReportingRecords from './ReportingRecords.svelte';

it('confirms only positive refunds and shows unavailable data separately from zero', async () => {
	const payments: BillingReportingPayment[] = [0, '0', 2500, 50000, 'invalid'].map(
		(value, index) => ({
			id: `payment-${index}`,
			user_id: 'customer',
			name: 'Customer',
			kind: 'topup',
			status: 'succeeded',
			amount_kopeks: 50000,
			currency: 'RUB',
			provider: 'yookassa',
			provider_payment_id: null,
			processed_at: 100,
			created_at: 100,
			credited_at: 100,
			credit_status: 'credited',
			is_test: false,
			// Exercise malformed and legacy JSON values at the component boundary.
			refunded_kopeks: value as number,
			source: 'billing_payment',
			wallet_id: null,
			subscription_id: null
		})
	);
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(ReportingRecords, {
		target,
		props: { payments },
		context: new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]])
	});
	try {
		await tick();
		const details = Array.from(target.querySelectorAll('tbody tr details'));
		for (const index of [0, 1]) expect(details[index].textContent).not.toContain('Refunds');
		for (const index of [2, 3]) {
			expect(details[index].textContent).toContain(
				'Refund confirmed; wallet reflection requires verification'
			);
		}
		expect(details[2].textContent).toContain('25,00');
		expect(details[3].textContent).toContain('500,00');
		expect(details[4].textContent).toContain('Status unavailable');
		expect(details[4].textContent).not.toContain('Refund confirmed');
	} finally {
		await unmount(component);
		target.remove();
	}
});
