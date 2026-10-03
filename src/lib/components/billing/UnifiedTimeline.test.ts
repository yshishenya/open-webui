// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { createInstance } from 'i18next';
import type { LedgerEntry } from '$lib/apis/billing';

import UnifiedTimeline from './UnifiedTimeline.svelte';

type PageStoreValue = { url: URL };
type Model = { id: string; name?: string };
type I18nValue = {
	language: string;
	resolvedLanguage?: string;
	t: (key: string, vars?: Record<string, string | number>) => string;
};

type MockStore<T> = {
	subscribe: (run: (value: T) => void) => () => void;
	set: (value: T) => void;
};

type MockStores = {
	gotoMock: ReturnType<typeof vi.fn>;
	pageStore: MockStore<PageStoreValue>;
	modelsStore: MockStore<Model[]>;
	getLedgerMock: ReturnType<typeof vi.fn>;
	getBillingRefundsMock: ReturnType<typeof vi.fn>;
	getUsageEventsMock: ReturnType<typeof vi.fn>;
	i18nStore: MockStore<I18nValue>;
};

type RenderProps = Partial<{
	showFilters: boolean;
	showLoadMore: boolean;
	pageSize: number;
	periodFrom: number;
	periodTo: number;
	syncFilterWithUrl: boolean;
	onFilterChange: (filter: 'all' | 'paid' | 'free' | 'topups' | 'refunds') => void;
}>;

const mocks: MockStores = vi.hoisted(() => {
	const gotoMock = vi.fn();
	const createStore = function <T>(initial: T): MockStore<T> {
		let value = initial;
		const subscribers = new Set<(value: T) => void>();
		const subscribe = (run: (value: T) => void) => {
			run(value);
			subscribers.add(run);
			return () => subscribers.delete(run);
		};
		const set = (next: T) => {
			value = next;
			subscribers.forEach((run) => run(value));
		};
		return { subscribe, set };
	};
	const pageStore = createStore<PageStoreValue>({
		url: new URL('http://localhost/billing/history')
	});
	const modelsStore = createStore<Model[]>([]);
	const getBillingRefundsMock = vi.fn().mockResolvedValue({ items: [], total: 0 });
	const getLedgerMock = vi.fn().mockResolvedValue([]);
	const getUsageEventsMock = vi.fn().mockResolvedValue([]);
	const i18nStore = createStore<I18nValue>({
		language: 'en-US',
		t: (key: string) => key
	});
	return {
		gotoMock,
		pageStore,
		modelsStore,
		getLedgerMock,
		getUsageEventsMock,
		getBillingRefundsMock,
		i18nStore
	};
});

vi.mock('$app/navigation', () => ({ goto: mocks.gotoMock }));
vi.mock('$app/stores', () => ({ page: mocks.pageStore }));
vi.mock('$lib/stores', () => ({ models: mocks.modelsStore }));
vi.mock('$lib/apis/billing', () => ({
	getLedger: mocks.getLedgerMock,
	getUsageEvents: mocks.getUsageEventsMock,
	getBillingRefunds: mocks.getBillingRefundsMock
}));

const flushPromises = async (): Promise<void> => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

const createContext = (): Map<string, unknown> => new Map([['i18n', mocks.i18nStore]]);

describe('UnifiedTimeline', () => {
	let mounted: Record<string, unknown> | null = null;
	let target: HTMLDivElement | null = null;

	beforeEach(() => {
		mocks.i18nStore.set({ language: 'en-US', t: (key: string) => key });
		mocks.gotoMock.mockReset();
		mocks.getLedgerMock.mockReset().mockResolvedValue([]);
		mocks.getBillingRefundsMock.mockReset().mockResolvedValue({ items: [], total: 0 });
		mocks.getUsageEventsMock.mockReset().mockResolvedValue([]);
		mocks.pageStore.set({ url: new URL('http://localhost/billing/history') });
		localStorage.token = 'test-token';
	});

	afterEach(async () => {
		if (mounted) {
			await unmount(mounted);
		}
		mounted = null;
		if (target) {
			target.remove();
		}
		target = null;
		vi.restoreAllMocks();
	});

	const renderTimeline = (props: RenderProps = {}) => {
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(UnifiedTimeline, {
			target,
			context: createContext(),
			props: {
				showFilters: true,
				syncFilterWithUrl: true,
				...props
			}
		});
		return target;
	};

	it('uses actual selected language for money and dates and reacts to a language change', async () => {
		const selected = createInstance();
		await selected.init({
			lng: 'en-US',
			fallbackLng: 'en-US',
			resources: {
				'en-US': { translation: { 'Top-up': 'Top-up' } },
				'ru-RU': { translation: { 'Top-up': 'Пополнение' } }
			}
		});
		mocks.i18nStore.set(selected);
		const dateFormat = Date.prototype.toLocaleDateString;
		const daySpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
			this: Date,
			locales,
			options
		): string {
			// Simulate a Russian environment when the formatter omits the app language.
			return dateFormat.call(this, locales ?? 'ru-RU', options);
		});
		const moneySpy = vi.spyOn(Intl, 'NumberFormat');
		mocks.getLedgerMock.mockResolvedValue([
			{
				id: 'selected-language-credit',
				balance_included_after: 0,
				balance_topup_after: 1234,
				user_id: 'user-1',
				wallet_id: 'wallet-1',
				amount_kopeks: 1234,
				currency: 'USD',
				type: 'topup',
				created_at: 1_700_000_000
			} satisfies LedgerEntry
		]);
		const root = renderTimeline();
		await flushPromises();
		const options: Intl.DateTimeFormatOptions = {
			timeZone: 'UTC',
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		};
		expect(root.querySelector('h2')?.textContent).toContain(
			dateFormat.call(new Date(1_700_000_000 * 1000), 'en-US', options)
		);
		expect(root.textContent).toContain('+$12.34');
		expect(daySpy).toHaveBeenCalledWith('en-US', options);
		expect(moneySpy).toHaveBeenCalledWith('en-US', { style: 'currency', currency: 'USD' });

		await selected.changeLanguage('ru-RU');
		mocks.i18nStore.set(selected);
		await flushPromises();
		expect(root.querySelector('h2')?.textContent).toContain(
			dateFormat.call(new Date(1_700_000_000 * 1000), 'ru-RU', options)
		);
		expect(root.textContent).toContain(
			'+' + new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' }).format(12.34)
		);
		expect(root.textContent).toContain('Пополнение');
		expect(mocks.getLedgerMock).toHaveBeenCalledTimes(1);
		expect(mocks.getUsageEventsMock).toHaveBeenCalledTimes(1);
	});

	it('reads the initial filter from the URL when sync is enabled', async () => {
		mocks.pageStore.set({ url: new URL('http://localhost/billing/history?filter=topups') });

		const root = renderTimeline();
		await flushPromises();

		const topupsButton = Array.from(root.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('Top-ups')
		);
		expect(topupsButton).toBeTruthy();
		expect(topupsButton?.className).toContain('bg-black');
	});

	it('updates the URL and notifies on filter change', async () => {
		const onFilterChange = vi.fn();
		const root = renderTimeline({ onFilterChange });
		await flushPromises();

		const paidButton = Array.from(root.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('Usage')
		);
		expect(paidButton).toBeTruthy();

		paidButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flushPromises();

		expect(onFilterChange).toHaveBeenCalledWith('paid');
		expect(mocks.gotoMock).toHaveBeenCalledTimes(1);
		expect(mocks.gotoMock.mock.calls[0][0]).toBe('/billing/history?filter=paid');
		expect(mocks.gotoMock.mock.calls[0][1]).toMatchObject({
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	});

	it('keeps selected filter applied while URL store has not emitted the new filter yet', async () => {
		mocks.getLedgerMock.mockResolvedValue([
			{
				id: 'ledger-topup',
				user_id: 'user-1',
				wallet_id: 'wallet-1',
				currency: 'RUB',
				type: 'topup',
				amount_kopeks: 5_000,
				balance_included_after: 0,
				balance_topup_after: 5_000,
				created_at: 200
			},
			{
				id: 'ledger-charge',
				user_id: 'user-1',
				wallet_id: 'wallet-1',
				currency: 'RUB',
				type: 'charge',
				amount_kopeks: -1_200,
				balance_included_after: 0,
				balance_topup_after: 3_800,
				created_at: 199
			}
		]);
		mocks.getUsageEventsMock.mockResolvedValue([]);

		const root = renderTimeline();
		await flushPromises();
		const initialCards = Array.from(root.querySelectorAll('[data-testid="timeline-item"]'));
		expect(initialCards).toHaveLength(2);

		const paidButton = Array.from(root.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('Usage')
		);
		expect(paidButton).toBeTruthy();

		paidButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flushPromises();

		const filteredCards = Array.from(root.querySelectorAll('[data-testid="timeline-item"]'));
		expect(filteredCards).toHaveLength(1);
		expect(filteredCards[0].textContent).toContain('Charge');
		expect(filteredCards[0].textContent).not.toContain('Top-up');
		expect(paidButton?.className).toContain('bg-black');
	});

	it('groups visible activity by calendar day and exposes filter state', async () => {
		mocks.getUsageEventsMock.mockResolvedValue([
			{
				id: 'usage-1',
				request_id: 'request-1',
				model_id: 'model-1',
				modality: 'text',
				billing_source: 'lead_magnet',
				cost_charged_kopeks: 0,
				created_at: 1_700_000_000,
				prompt_tokens: 4,
				completion_tokens: 8
			},
			{
				id: 'usage-2',
				request_id: 'request-2',
				model_id: 'model-1',
				modality: 'text',
				billing_source: 'lead_magnet',
				cost_charged_kopeks: 0,
				created_at: 1_700_086_400,
				prompt_tokens: 2,
				completion_tokens: 3
			}
		]);

		const root = renderTimeline();
		await flushPromises();

		expect(root.querySelectorAll('[data-testid="timeline-item"]')).toHaveLength(2);
		expect(root.querySelectorAll('section[aria-labelledby^="timeline-"]')).toHaveLength(2);
		expect(root.querySelector('button[aria-pressed="true"]')?.textContent).toContain(
			'All activity'
		);
	});

	it('updates active filter when URL filter changes after mount', async () => {
		const root = renderTimeline();
		await flushPromises();

		const freeButton = Array.from(root.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('Free usage')
		);
		expect(freeButton).toBeTruthy();
		expect(freeButton?.className).not.toContain('bg-black');

		mocks.pageStore.set({ url: new URL('http://localhost/billing/history?filter=free') });
		await flushPromises();

		expect(freeButton?.className).toContain('bg-black');
		expect(mocks.gotoMock).not.toHaveBeenCalled();
	});

	it('ignores stale URL updates when filters are changed quickly', async () => {
		const root = renderTimeline();
		await flushPromises();

		const paidButton = Array.from(root.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('Usage')
		);
		const freeButton = Array.from(root.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('Free usage')
		);
		expect(paidButton).toBeTruthy();
		expect(freeButton).toBeTruthy();

		paidButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		freeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flushPromises();

		expect(mocks.gotoMock).toHaveBeenCalledTimes(2);
		expect(freeButton?.className).toContain('bg-black');

		mocks.pageStore.set({ url: new URL('http://localhost/billing/history?filter=paid') });
		await flushPromises();
		expect(freeButton?.className).toContain('bg-black');
		expect(paidButton?.className).not.toContain('bg-black');

		mocks.pageStore.set({ url: new URL('http://localhost/billing/history?filter=free') });
		await flushPromises();
		expect(freeButton?.className).toContain('bg-black');
		expect(paidButton?.className).not.toContain('bg-black');
	});
	it('loads the full bounded period even when the first filtered page is empty', async () => {
		mocks.pageStore.set({ url: new URL('http://localhost/billing/history?filter=topups') });
		const entry = (id: string, type: string, created_at: number): LedgerEntry => ({
			id,
			type,
			created_at,
			user_id: 'u',
			wallet_id: 'w',
			currency: 'RUB',
			amount_kopeks: 50000,
			balance_included_after: 0,
			balance_topup_after: 50000
		});
		mocks.getLedgerMock
			.mockResolvedValueOnce([entry('usage-1', 'hold', 400), entry('usage-2', 'release', 300)])
			.mockResolvedValueOnce([entry('actual-topup', 'topup', 200), entry('older', 'topup', 50)]);
		const root = renderTimeline({ pageSize: 2, periodFrom: 100, periodTo: 500 });
		await flushPromises();
		await flushPromises();
		expect(mocks.getLedgerMock).toHaveBeenCalledTimes(2);
		expect(root.querySelectorAll('[data-testid="timeline-item"]')).toHaveLength(1);
		expect(root.textContent).toContain('Top-up');
	});
	it('asks to open full history when the preview contains only hidden technical records', async () => {
		mocks.getLedgerMock.mockResolvedValue([
			{ id: 'hold', type: 'hold', created_at: 400 },
			{ id: 'release', type: 'release', created_at: 300 }
		]);
		const root = renderTimeline({ pageSize: 2, showLoadMore: false });
		await flushPromises();
		expect(root.textContent).toContain('Open the full history to see older operations.');
		expect(root.textContent).not.toContain('Load older operations to continue.');
		expect(
			[...root.querySelectorAll('button')].some((button) =>
				button.textContent?.includes('Load more')
			)
		).toBe(false);
	});
	it('shows the final estimated charge once and retains a confirmed provider refund', async () => {
		mocks.getLedgerMock.mockResolvedValue([
			{
				id: 'delta',
				type: 'adjustment',
				amount_kopeks: -200,
				metadata_json: { reason: 'hold_overage' },
				currency: 'RUB',
				created_at: 200
			}
		]);
		mocks.getUsageEventsMock.mockResolvedValue([
			{
				id: 'usage',
				request_id: 'request',
				model_id: 'model',
				modality: 'text',
				billing_source: 'wallet',
				cost_charged_kopeks: 1000,
				is_estimated: true,
				created_at: 200
			}
		]);
		mocks.getBillingRefundsMock.mockResolvedValue({
			items: [
				{
					id: 'refund',
					payment_id: 'payment',
					amount_kopeks: 5000,
					currency: 'RUB',
					occurred_at: 210,
					wallet_reflection: 'requires_verification'
				}
			],
			total: 1
		});
		const root = renderTimeline();
		await flushPromises();
		expect(root.querySelectorAll('[data-testid="timeline-item"]')).toHaveLength(2);
		expect(root.textContent).toContain('Charged using an estimate');
		expect(root.textContent).not.toContain('Not charged');
		expect(root.textContent).toContain('Payment refund');
		expect(root.textContent).toContain(
			'Refund confirmation and its reflection in the wallet are checked separately'
		);
	});
	it('preserves a partial-load error when another source has valid operations', async () => {
		mocks.getLedgerMock.mockRejectedValue(new Error('offline'));
		mocks.getBillingRefundsMock.mockResolvedValue({
			items: [
				{
					id: 'refund',
					payment_id: 'payment',
					amount_kopeks: 5000,
					currency: 'RUB',
					occurred_at: 210
				}
			],
			total: 1
		});
		const root = renderTimeline();
		await flushPromises();
		expect(root.querySelector('[role="alert"]')?.textContent).toContain(
			'Some operations could not be loaded'
		);
		expect(root.textContent).toContain('Payment refund');
	});
	it('deduplicates a shifted offset page while retaining the raw offset', async () => {
		const entry = (id: string, created_at: number) => ({
			id,
			type: 'topup',
			created_at,
			user_id: 'u',
			wallet_id: 'w',
			currency: 'RUB',
			amount_kopeks: 1000,
			balance_included_after: 0,
			balance_topup_after: 1000
		});
		mocks.getLedgerMock
			.mockResolvedValueOnce([entry('a', 400), entry('b', 300)])
			.mockResolvedValueOnce([entry('b', 300), entry('c', 200)])
			.mockResolvedValueOnce([entry('d', 50)]);
		const root = renderTimeline({ pageSize: 2, periodFrom: 100, periodTo: 500 });
		await flushPromises();
		await flushPromises();
		expect(root.querySelectorAll('[data-testid="timeline-item"]')).toHaveLength(2);
		const more = [...root.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Load more')
		);
		more?.click();
		await flushPromises();
		expect(root.querySelectorAll('[data-testid="timeline-item"]')).toHaveLength(3);
		expect(mocks.getLedgerMock.mock.calls.map((call) => call[2])).toEqual([0, 2, 4]);
	});
});
