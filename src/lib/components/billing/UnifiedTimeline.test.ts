// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';

import UnifiedTimeline from './UnifiedTimeline.svelte';

type PageStoreValue = { url: URL };
type Model = { id: string; name?: string };
type I18nValue = {
	locale: string;
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
	getUsageEventsMock: ReturnType<typeof vi.fn>;
	i18nStore: MockStore<I18nValue>;
};

type RenderProps = Partial<{
	showFilters: boolean;
	syncFilterWithUrl: boolean;
	onFilterChange: (filter: 'all' | 'paid' | 'free' | 'topups') => void;
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
	const getLedgerMock = vi.fn().mockResolvedValue([]);
	const getUsageEventsMock = vi.fn().mockResolvedValue([]);
	const i18nStore = createStore<I18nValue>({
		locale: 'en',
		t: (key: string) => key
	});
	return { gotoMock, pageStore, modelsStore, getLedgerMock, getUsageEventsMock, i18nStore };
});

vi.mock('$app/navigation', () => ({ goto: mocks.gotoMock }), { virtual: true });
vi.mock('$app/stores', () => ({ page: mocks.pageStore }), { virtual: true });
vi.mock('$lib/stores', () => ({ models: mocks.modelsStore }), { virtual: true });
vi.mock(
	'$lib/apis/billing',
	() => ({
		getLedger: mocks.getLedgerMock,
		getUsageEvents: mocks.getUsageEventsMock
	}),
	{ virtual: true }
);

const flushPromises = async (): Promise<void> => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

const createContext = (): Map<string, unknown> => new Map([['i18n', mocks.i18nStore]]);

describe('UnifiedTimeline', () => {
	let mounted: Record<string, unknown> | null = null;
	let target: HTMLDivElement | null = null;

	beforeEach(() => {
		mocks.gotoMock.mockReset();
		mocks.getLedgerMock.mockReset().mockResolvedValue([]);
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
			button.textContent?.includes('Paid')
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
});
