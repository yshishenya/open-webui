// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { BillingReportingOverview } from '$lib/apis/admin/billing_reporting';
import Overview from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			url: new URL(
				'https://example/admin/billing?from_date=2026-10-01&to_date=2026-10-02&currency=EUR'
			)
		})
	};
});
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { WEBUI_NAME: writable('Airis'), user: writable({ role: 'admin' }) };
});
vi.mock('$lib/apis/admin/billing_reporting', () => ({ getBillingReportingOverview: vi.fn() }));

const confirmed: BillingReportingOverview = {
	currency: 'EUR',
	from: 1790812800,
	to: 1790985600,
	as_of: 1791000000,
	time_semantics: 'UTC',
	metrics: {
		successful_payments_kopeks: 100000,
		refund_kopeks: 20000,
		net_kopeks: 80000,
		usage_spend_kopeks: 30000,
		payer_count: 2,
		paid_balance_kopeks: 50000,
		included_balance_kopeks: 0
	},
	warnings: {},
	series: [],
	definitions: {}
};
const render = (): { target: HTMLDivElement; cleanup: () => Promise<void> } => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Overview, {
		target,
		context: new Map([['i18n', writable({ language: 'en', t: (key: string): string => key })]])
	});
	return {
		target,
		cleanup: async (): Promise<void> => {
			await unmount(component);
			target.remove();
		}
	};
};
const submit = async (target: HTMLElement): Promise<void> => {
	target
		.querySelector('form')!
		.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	await tick();
};
const changeFilters = async (target: HTMLElement): Promise<void> => {
	const date = target.querySelector<HTMLInputElement>('input[type="date"]')!;
	date.value = '2026-10-03';
	date.dispatchEvent(new Event('input', { bubbles: true }));
	const to = target.querySelectorAll<HTMLInputElement>('input[type="date"]')[1];
	to.value = '2026-10-04';
	to.dispatchEvent(new Event('input', { bubbles: true }));
	const currency = target.querySelector('select')!;
	currency.value = 'USD';
	currency.dispatchEvent(new Event('change', { bubbles: true }));
	await tick();
};
beforeEach(async () => {
	const { getBillingReportingOverview } = await import('$lib/apis/admin/billing_reporting');
	vi.mocked(getBillingReportingOverview).mockReset().mockResolvedValue(confirmed);
});

it('explains net receipts using separate gross/refund links with the confirmed filters', async () => {
	const { target, cleanup } = render();
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('€800.00'));
		const label = Array.from(target.querySelectorAll('div')).find(
			(node) => node.textContent === 'Top-ups after refunds'
		)!;
		const card = label.parentElement!;
		expect(card.tagName).toBe('DIV');
		expect(card.textContent).toContain('€1,000.00 − €200.00 = €800.00');
		const links = Array.from(card.querySelectorAll('a')).map((a) => new URL(a.href));
		expect(links.map((url) => url.searchParams.get('tab'))).toEqual(['payments', 'refunds']);
		for (const url of links) {
			expect(url.searchParams.get('currency')).toBe('EUR');
			expect(url.searchParams.get('from_date')).toBe('2026-10-01');
			expect(url.searchParams.get('to_date')).toBe('2026-10-02');
		}
		expect(links[0].searchParams.get('credit_status')).toBe('credited');
		expect(links[0].searchParams.get('is_test')).toBe('false');
	} finally {
		await cleanup();
	}
});

it('retains confirmed period/currency/as-of during a failed new filter and replaces them only after retry', async () => {
	const api = await import('$lib/apis/admin/billing_reporting');
	const { target, cleanup } = render();
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('€800.00'));
		const oldCaption = Array.from(target.querySelectorAll('p')).find((p) =>
			p.textContent?.includes('For the applied period')
		)!.textContent;
		let fail!: (reason: Error) => void;
		vi.mocked(api.getBillingReportingOverview).mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					fail = reject;
				})
		);
		await changeFilters(target);
		await submit(target);
		expect(target.textContent).toContain('Updating report');
		expect(target.textContent).toContain('€800.00');
		fail(new Error('offline'));
		await vi.waitFor(() =>
			expect(target.textContent).toContain('Could not refresh. Showing the last confirmed report.')
		);
		expect(target.textContent).toContain(oldCaption);
		expect(target.textContent).not.toContain('$800.00');
		const refundLink = Array.from(target.querySelectorAll('a')).find(
			(a) => a.textContent === 'Returned to customers'
		)!;
		expect(new URL(refundLink.href).searchParams.get('currency')).toBe('EUR');
		vi.mocked(api.getBillingReportingOverview).mockResolvedValueOnce({
			...confirmed,
			currency: 'USD',
			as_of: 1791100000
		});
		Array.from(target.querySelectorAll('button'))
			.find((button) => button.textContent === 'Retry')!
			.click();
		await vi.waitFor(() => expect(target.textContent).toContain('$800.00'));
		expect(target.textContent).not.toContain('Could not refresh.');
		expect(target.textContent).toContain('2026-10-03 — 2026-10-04');
	} finally {
		await cleanup();
	}
});

it('shows an initial failure and retry without fabricated zero totals', async () => {
	const api = await import('$lib/apis/admin/billing_reporting');
	vi.mocked(api.getBillingReportingOverview).mockRejectedValueOnce(new Error('offline'));
	const { target, cleanup } = render();
	try {
		await vi.waitFor(() =>
			expect(target.querySelector('[role="alert"]')?.textContent).toContain(
				'Failed to load billing overview'
			)
		);
		expect(target.textContent).not.toContain('Top-ups after refunds');
		expect(target.textContent).not.toContain('No financial events');
		expect(target.textContent).not.toContain('€0.00');
		Array.from(target.querySelectorAll('button'))
			.find((button) => button.textContent === 'Retry')!
			.click();
		await vi.waitFor(() => expect(target.textContent).toContain('€800.00'));
	} finally {
		await cleanup();
	}
});

it('ignores an older report after a newer filter result has been confirmed', async () => {
	const api = await import('$lib/apis/admin/billing_reporting');
	let completeOld!: (value: BillingReportingOverview) => void;
	vi.mocked(api.getBillingReportingOverview).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				completeOld = resolve;
			})
	);
	const { target, cleanup } = render();
	try {
		await vi.waitFor(() => expect(completeOld).toBeDefined());
		await changeFilters(target);
		vi.mocked(api.getBillingReportingOverview).mockResolvedValueOnce({
			...confirmed,
			currency: 'USD'
		});
		await submit(target);
		await vi.waitFor(() => expect(target.textContent).toContain('$800.00'));
		completeOld(confirmed);
		await tick();
		await tick();
		expect(target.textContent).toContain('$800.00');
		expect(target.textContent).not.toContain('€800.00');
		expect(target.textContent).toContain('2026-10-03 — 2026-10-04');
	} finally {
		await cleanup();
	}
});
