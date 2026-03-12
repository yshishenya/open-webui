// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';

import HeaderBillingAccess from './HeaderBillingAccess.svelte';

type Balance = {
	balance_topup_kopeks: number;
	balance_included_kopeks: number;
	included_expires_at: number | null;
	max_reply_cost_kopeks: number | null;
	daily_cap_kopeks: number | null;
	daily_spent_kopeks: number;
	auto_topup_enabled?: boolean;
	auto_topup_threshold_kopeks?: number | null;
	auto_topup_amount_kopeks?: number | null;
	auto_topup_fail_count?: number;
	auto_topup_last_failed_at?: number | null;
	auto_topup_payment_method_saved?: boolean;
	currency: string;
};

type I18nValue = {
	locale: string;
	t: (key: string, vars?: Record<string, string | number>) => string;
};

type MockStore<T> = {
	subscribe: (run: (value: T) => void) => () => void;
	set: (value: T) => void;
};

const mocks = vi.hoisted(() => {
	const createStore = <T>(initial: T): MockStore<T> => {
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

	return {
		getBalanceMock: vi.fn(),
		pageStore: createStore({ url: new URL('http://localhost/c/123') }),
		i18nStore: createStore<I18nValue>({
			locale: 'en',
			t: (key: string) => key
		})
	};
});

vi.mock('$lib/apis/billing', () => ({ getBalance: mocks.getBalanceMock }), { virtual: true });
vi.mock('$app/stores', () => ({ page: mocks.pageStore }), { virtual: true });

const flushPromises = async (): Promise<void> => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

const createBalance = (overrides: Partial<Balance> = {}): Balance => ({
	balance_topup_kopeks: 25_000,
	balance_included_kopeks: 0,
	included_expires_at: null,
	max_reply_cost_kopeks: null,
	daily_cap_kopeks: null,
	daily_spent_kopeks: 0,
	currency: 'RUB',
	...overrides
});

const createContext = (): Map<string, unknown> => new Map([['i18n', mocks.i18nStore]]);

describe('HeaderBillingAccess', () => {
	let mounted: Record<string, unknown> | null = null;
	let target: HTMLDivElement | null = null;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

	beforeEach(() => {
		localStorage.token = 'test-token';
		mocks.pageStore.set({ url: new URL('http://localhost/c/123?focus=topup') });
		mocks.getBalanceMock.mockReset().mockResolvedValue(createBalance());
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
		consoleErrorSpy?.mockRestore();
		consoleErrorSpy = null;
	});

	const renderComponent = (): HTMLDivElement => {
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(HeaderBillingAccess, {
			target,
			context: createContext()
		});
		return target;
	};

	it('renders total balance and chat-safe wallet links', async () => {
		mocks.getBalanceMock.mockResolvedValue(
			createBalance({ balance_topup_kopeks: 25_000, balance_included_kopeks: 5_000 })
		);

		const root = renderComponent();
		await flushPromises();

		const amount = root.querySelector('[data-testid="header-billing-amount"]');
		const balanceLink = root.querySelector('[data-testid="header-billing-balance"]');
		const topupLink = root.querySelector('[data-testid="header-billing-topup"]');
		const shell = root.querySelector('[data-testid="header-billing-shell"]');

		expect(amount?.textContent).toContain('300');
		expect(root.textContent).not.toContain('Balance');
		expect(root.textContent).not.toContain('Top up');
		expect(topupLink?.getAttribute('aria-label')).toBe('Top up');
		expect(shell?.className).toContain('h-[34px]');
		expect(shell?.className).toContain('rounded-xl');
		expect(topupLink?.className).not.toContain('rounded-full');
		expect(topupLink?.className).not.toContain('bg-black');

		const walletUrl = new URL(balanceLink?.getAttribute('href') ?? '', 'http://localhost');
		expect(walletUrl.pathname).toBe('/billing/balance');
		expect(walletUrl.searchParams.get('src')).toBe('header_balance');
		expect(walletUrl.searchParams.get('return_to')).toBe('/c/123?focus=topup');

		const topupUrl = new URL(topupLink?.getAttribute('href') ?? '', 'http://localhost');
		expect(topupUrl.pathname).toBe('/billing/balance');
		expect(topupUrl.searchParams.get('src')).toBe('header_topup');
		expect(topupUrl.searchParams.get('focus')).toBe('topup');
		expect(topupUrl.searchParams.get('return_to')).toBe('/c/123?focus=topup');
	});

	it('preserves validated return_to on billing routes', async () => {
		mocks.pageStore.set({
			url: new URL('http://localhost/billing/history?return_to=%2Fc%2F42%3Ffocus%3Dtopup')
		});

		const root = renderComponent();
		await flushPromises();

		const walletUrl = new URL(
			root.querySelector('[data-testid="header-billing-balance"]')?.getAttribute('href') ?? '',
			'http://localhost'
		);
		const topupUrl = new URL(
			root.querySelector('[data-testid="header-billing-topup"]')?.getAttribute('href') ?? '',
			'http://localhost'
		);

		expect(walletUrl.searchParams.get('return_to')).toBe('/c/42?focus=topup');
		expect(topupUrl.searchParams.get('return_to')).toBe('/c/42?focus=topup');
	});

	it('marks the access pill as low balance when funds are low', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance({ balance_topup_kopeks: 5_000 }));

		const root = renderComponent();
		await flushPromises();

		const access = root.querySelector('[data-testid="header-billing-access"]');
		expect(access?.getAttribute('data-state')).toBe('low');
	});

	it('keeps top-up usable when balance loading fails', async () => {
		mocks.pageStore.set({ url: new URL('http://localhost/workspace') });
		mocks.getBalanceMock.mockRejectedValue(new Error('boom'));

		const root = renderComponent();
		await flushPromises();

		const access = root.querySelector('[data-testid="header-billing-access"]');
		const amount = root.querySelector('[data-testid="header-billing-amount"]');
		const topupUrl = new URL(
			root.querySelector('[data-testid="header-billing-topup"]')?.getAttribute('href') ?? '',
			'http://localhost'
		);

		expect(access?.getAttribute('data-state')).toBe('error');
		expect(amount?.textContent).toContain('--');
		expect(topupUrl.pathname).toBe('/billing/balance');
		expect(topupUrl.searchParams.get('focus')).toBe('topup');
		expect(topupUrl.searchParams.get('return_to')).toBeNull();
	});
});
