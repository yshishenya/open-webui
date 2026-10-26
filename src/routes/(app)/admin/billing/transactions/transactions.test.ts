// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import Transactions from './+page.svelte';

vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
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

it('downloads the whole applied selection, not the visible page or an unsaved filter draft', async () => {
	const api = await import('$lib/apis/admin/billing_reporting');
	const realApi = await vi.importActual<typeof api>('$lib/apis/admin/billing_reporting');
	const { page } = await import('$app/stores');
	const pageStore = page as unknown as Writable<{ url: URL }>;
	const originalUrl = new URL('http://localhost/admin/billing/transactions');
	pageStore.set({
		url: new URL(
			'?tab=payments&page=2&from_date=2026-10-01&to_date=2026-10-02&currency=USD&user_id=selected&status=succeeded&kind=topup&credit_status=credited&is_test=false',
			originalUrl
		)
	});
	vi.mocked(api.getBillingReportingExportUrl).mockImplementation(
		realApi.getBillingReportingExportUrl
	);
	const blob = new Blob(['id,amount_kopeks\np-0,100\np-1,200\n'], { type: 'text/csv' });
	const readBlob = vi.fn().mockResolvedValue(blob);
	const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: readBlob });
	const nativeUrl = URL;
	class ExportUrl extends nativeUrl {
		static createObjectURL = vi.fn().mockReturnValue('blob:synthetic-export');
		static revokeObjectURL = vi.fn();
	}
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal('URL', ExportUrl);
	const downloads: Array<{ href: string; filename: string }> = [];
	const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
		this: HTMLAnchorElement
	) {
		downloads.push({ href: this.href, filename: this.download });
	});
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Transactions, {
		target,
		context: new Map([['i18n', writable({ language: 'en-US', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() => expect(target.querySelectorAll('tbody tr')).toHaveLength(3));
		const date = target.querySelector<HTMLInputElement>('input[type="date"]')!;
		date.value = '2026-09-01';
		date.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		const button = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(
			(element) => element.textContent?.trim() === 'Export CSV'
		)!;
		await vi.waitFor(() => expect(button.disabled).toBe(false));
		button.click();
		await vi.waitFor(() => expect(downloads).toHaveLength(1));
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const url = new nativeUrl(String(fetchMock.mock.calls[0][0]), 'http://localhost');
		expect(url.pathname).toMatch(/\/admin\/billing\/reporting\/export$/);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			dataset: 'payments',
			from: String(Date.parse('2026-10-01T00:00:00Z') / 1000),
			to: String(Date.parse('2026-10-03T00:00:00Z') / 1000),
			currency: 'USD',
			user_id: 'selected',
			status: 'succeeded',
			kind: 'topup',
			credit_status: 'credited',
			is_test: 'false'
		});
		expect(readBlob).toHaveBeenCalledTimes(1);
		expect(ExportUrl.createObjectURL).toHaveBeenCalledWith(blob);
		expect(downloads).toEqual([
			{ href: 'blob:synthetic-export', filename: 'billing-payments.csv' }
		]);
		expect(ExportUrl.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-export');
	} finally {
		await unmount(component);
		target.remove();
		click.mockRestore();
		vi.unstubAllGlobals();
		vi.mocked(api.getBillingReportingExportUrl).mockReset();
		pageStore.set({ url: originalUrl });
	}
});

it.each([401, 403, 500, 503])('does not download HTTP %s as a CSV file', async (status) => {
	const response = new Response(JSON.stringify({ detail: 'Synthetic export failure' }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
	const readBlob = vi.spyOn(response, 'blob');
	const fetchMock = vi.fn().mockResolvedValue(response);
	vi.stubGlobal('fetch', fetchMock);
	const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Transactions, {
		target,
		context: new Map([['i18n', writable({ language: 'en-US', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() => expect(target.querySelectorAll('tbody tr')).toHaveLength(3));
		const button = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(
			(element) => element.textContent?.trim() === 'Export CSV'
		)!;
		await vi.waitFor(() => expect(button.disabled).toBe(false));
		button.click();
		await vi.waitFor(() =>
			expect(target.textContent).toContain('Failed to export billing transactions')
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(readBlob).not.toHaveBeenCalled();
		expect(click).not.toHaveBeenCalled();
		expect(button.disabled).toBe(false);
	} finally {
		await unmount(component);
		target.remove();
		click.mockRestore();
		vi.unstubAllGlobals();
	}
});
