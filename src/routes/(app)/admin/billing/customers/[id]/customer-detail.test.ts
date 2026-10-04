// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import CustomerDetail from './+page.svelte';
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			url: new URL('https://example/admin/billing/customers/first'),
			params: { id: 'first' }
		})
	};
});
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { WEBUI_NAME: writable('Airis'), user: writable({ role: 'admin' }) };
});
vi.mock('$lib/apis/admin/billing_reporting', () => ({
	getBillingReportingCustomer: vi.fn(async (_token: string, id: string) => ({
		user: { id, name: id, email: id + '@example.test', role: 'user' },
		wallet: {
			id: 'wallet-' + id,
			currency: 'RUB',
			balance_topup_kopeks: 100,
			balance_included_kopeks: 0,
			daily_cap_kopeks: null,
			daily_spent_kopeks: 0
		},
		metrics: {
			period_paid_kopeks: 100,
			period_refund_kopeks: 0,
			period_spent_kopeks: 0,
			paid_kopeks: 100,
			spent_kopeks: 0,
			refund_kopeks: 0
		},
		payments: [],
		ledger: [],
		usage: [],
		from: 0,
		to: 1,
		as_of: 1,
		time_semantics: 'UTC'
	})),
	getBillingReportingPayments: vi.fn().mockResolvedValue({ items: [], total: 0, total_pages: 1 }),
	getBillingReportingRefunds: vi.fn(),
	getBillingReportingLedger: vi.fn(),
	getBillingReportingUsage: vi.fn()
}));
it('reloads customer identity and operations when the same route component is reused', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(CustomerDetail, {
		target,
		context: new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('first@example.test'));
		const { page } = await import('$app/stores');
		(page as unknown as Writable<{ url: URL; params: { id: string } }>).set({
			url: new URL(
				'https://example/admin/billing/customers/second?back=%2Fadmin%2Fbilling%2Ftransactions%3Fpage%3D3'
			),
			params: { id: 'second' }
		});
		await tick();
		await vi.waitFor(() => expect(target.textContent).toContain('second@example.test'));
		expect(target.textContent).not.toContain('first@example.test');
		expect(target.querySelector('a')?.getAttribute('href')).toBe(
			'/admin/billing/transactions?page=3'
		);
		const api = await import('$lib/apis/admin/billing_reporting');
		expect(api.getBillingReportingPayments).toHaveBeenLastCalledWith(
			undefined,
			expect.objectContaining({ user_id: 'second' })
		);
		(page as unknown as Writable<{ url: URL; params: { id: string } }>).set({
			url: new URL(
				'https://example/admin/billing/customers/second?tab=payments&payment_id=older-payment'
			),
			params: { id: 'second' }
		});
		await tick();
		await vi.waitFor(() =>
			expect(api.getBillingReportingPayments).toHaveBeenLastCalledWith(
				undefined,
				expect.objectContaining({ user_id: 'second', payment_id: 'older-payment' })
			)
		);
		await vi.waitFor(() =>
			expect(target.textContent).toContain('Related records are shown across all dates')
		);
		Array.from(target.querySelectorAll<HTMLButtonElement>('button'))
			.find((button) => button.textContent?.trim() === 'Show all customer operations')!
			.click();
		await tick();
		await vi.waitFor(() =>
			expect(api.getBillingReportingPayments).toHaveBeenLastCalledWith(
				undefined,
				expect.objectContaining({ user_id: 'second', payment_id: undefined })
			)
		);
	} finally {
		await unmount(component);
		target.remove();
	}
});
