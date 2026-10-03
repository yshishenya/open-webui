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
	getBillingReportingRefunds: vi.fn(),
	getBillingReportingCustomers: vi.fn(),
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
		expect(goto).toHaveBeenCalledWith(
			expect.stringContaining('/admin/billing/customers/customer-0?')
		);
		const destination = vi.mocked(goto).mock.calls.at(-1)?.[0];
		expect(new URL(String(destination), 'http://localhost').searchParams.get('back')).toContain(
			'/admin/billing/transactions?'
		);
	} finally {
		await unmount(component);
		target.remove();
	}
});

it('keeps the selected tab when an older payment response arrives', async () => {
	const api = await import('$lib/apis/admin/billing_reporting');
	let complete!: (value: Awaited<ReturnType<typeof api.getBillingReportingPayments>>) => void;
	vi.mocked(api.getBillingReportingPayments).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				complete = resolve;
			})
	);
	vi.mocked(api.getBillingReportingRefunds).mockResolvedValueOnce({
		items: [
			{
				id: 'refund-current',
				user_id: 'current-user',
				name: 'Текущий возврат',
				payment_id: 'p',
				amount_kopeks: 200,
				currency: 'RUB',
				occurred_at: 100,
				wallet_reflection: 'requires_verification'
			}
		],
		total: 1,
		total_pages: 1,
		page: 1,
		page_size: 50,
		currency: 'RUB',
		from: 0,
		to: 1000,
		as_of: 100
	});
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Transactions, {
		target,
		context: new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() => expect(complete).toBeDefined());
		Array.from(target.querySelectorAll<HTMLButtonElement>('button'))
			.find((button) => button.textContent === 'Refunds')
			?.click();
		await vi.waitFor(() => expect(target.textContent).toContain('Текущий возврат'));
		complete({
			items: [
				{
					id: 'old',
					user_id: 'old-user',
					name: 'Устаревший платёж',
					kind: 'topup',
					status: 'succeeded',
					amount_kopeks: 100,
					currency: 'RUB',
					provider: 'yookassa',
					provider_payment_id: null,
					processed_at: 100,
					created_at: 100,
					credited_at: 100,
					credit_status: 'credited',
					is_test: false,
					refunded_kopeks: 0,
					source: '',
					wallet_id: null,
					subscription_id: null
				}
			],
			total: 1,
			total_pages: 1,
			page: 1,
			page_size: 50,
			currency: 'RUB',
			from: 0,
			to: 1000,
			as_of: 100
		});
		await tick();
		await tick();
		expect(target.textContent).toContain('Текущий возврат');
		expect(target.textContent).not.toContain('Устаревший платёж');
	} finally {
		await unmount(component);
		target.remove();
	}
});

it('does not navigate after the report is removed', async () => {
	const api = await import('$lib/apis/admin/billing_reporting');
	const { goto } = await import('$app/navigation');
	let complete!: (value: Awaited<ReturnType<typeof api.getBillingReportingPayments>>) => void;
	vi.mocked(api.getBillingReportingPayments).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				complete = resolve;
			})
	);
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Transactions, {
		target,
		context: new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]])
	});
	await vi.waitFor(() => expect(complete).toBeDefined());
	await unmount(component);
	vi.mocked(goto).mockClear();
	complete({
		items: [],
		total: 0,
		total_pages: 1,
		page: 1,
		page_size: 50,
		currency: 'RUB',
		from: 0,
		to: 1000,
		as_of: 100
	});
	await tick();
	await tick();
	expect(goto).not.toHaveBeenCalled();
	target.remove();
});

it('does not download an export that finishes after leaving the report', async () => {
	let complete!: (value: Response) => void;
	const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
		() =>
			new Promise((resolve) => {
				complete = resolve;
			})
	);
	vi.stubGlobal('fetch', fetchMock);
	const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Transactions, {
		target,
		context: new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() => expect(target.querySelectorAll('tbody tr')).toHaveLength(3));
		await vi.waitFor(() =>
			expect(
				Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(
					(button) => button.textContent?.trim() === 'Export CSV'
				)?.disabled
			).toBe(false)
		);
		Array.from(target.querySelectorAll<HTMLButtonElement>('button'))
			.find((button) => button.textContent?.trim() === 'Export CSV')!
			.click();
		await vi.waitFor(() => expect(complete).toBeDefined());
		expect(fetchMock.mock.calls[0]?.[1]).toEqual(
			expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) })
		);
		await unmount(component);
		complete({
			ok: true,
			blob: vi.fn().mockResolvedValue(new Blob(['payment']))
		} as unknown as Response);
		await tick();
		await tick();
		expect(click).not.toHaveBeenCalled();
	} finally {
		click.mockRestore();
		vi.unstubAllGlobals();
		target.remove();
	}
});
