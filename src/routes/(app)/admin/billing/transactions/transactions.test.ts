// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import Transactions from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return { page: writable({ url: new URL('http://localhost/admin/billing/transactions') }) };
});
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { WEBUI_NAME: writable('Airis'), user: writable({ role: 'admin' }) };
});
vi.mock('$lib/apis/admin/billing_reporting', () => ({
	getBillingReportingPayments: vi.fn().mockResolvedValue({
		items: ['Иван Петров', null, '   '].map((name, index) => ({
			id: `payment-${index}`,
			user_id: `customer-${index}`,
			name,
			kind: 'topup',
			status: 'succeeded',
			amount_kopeks: 50000,
			currency: 'RUB',
			provider: 'yookassa',
			processed_at: 100
		})),
		total: 3,
		total_pages: 1
	}),
	getBillingReportingLedger: vi.fn(),
	getBillingReportingUsage: vi.fn(),
	getBillingReportingExportUrl: vi.fn()
}));

it('shows profile names with ID fallback and opens the customer by ID', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Transactions, {
		target,
		context: new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() => expect(target.querySelectorAll('tbody tr')).toHaveLength(3));
		const buttons = Array.from(
			target.querySelectorAll<HTMLButtonElement>('tbody tr td:nth-child(2) button')
		);
		expect(buttons.map((button) => button.textContent)).toEqual([
			'Иван Петров',
			'customer-1',
			'customer-2'
		]);
		buttons[0].click();
		await tick();
		const { goto } = await import('$app/navigation');
		expect(goto).toHaveBeenCalledWith('/admin/billing/customers/customer-0');
	} finally {
		await unmount(component);
		target.remove();
	}
});
