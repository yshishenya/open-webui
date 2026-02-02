// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';

import Page from './+page.svelte';

type Balance = {
	balance_topup_kopeks: number;
	balance_included_kopeks: number;
	included_expires_at: number | null;
	max_reply_cost_kopeks: number | null;
	daily_cap_kopeks: number | null;
	daily_spent_kopeks: number | null;
	auto_topup_enabled: boolean;
	auto_topup_threshold_kopeks: number | null;
	auto_topup_amount_kopeks: number | null;
	auto_topup_fail_count: number | null;
	auto_topup_last_failed_at: number | null;
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

type MockSet = {
	createTopupMock: ReturnType<typeof vi.fn>;
	getBalanceMock: ReturnType<typeof vi.fn>;
	getLeadMagnetInfoMock: ReturnType<typeof vi.fn>;
	getLedgerMock: ReturnType<typeof vi.fn>;
	getUsageEventsMock: ReturnType<typeof vi.fn>;
	updateAutoTopupMock: ReturnType<typeof vi.fn>;
	updateBillingSettingsMock: ReturnType<typeof vi.fn>;
	getUserInfoMock: ReturnType<typeof vi.fn>;
	trackEventMock: ReturnType<typeof vi.fn>;
	gotoMock: ReturnType<typeof vi.fn>;
	toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
	webuiNameStore: MockStore<string>;
	modelsStore: MockStore<{ id: string; name?: string }[]>;
	settingsStore: MockStore<{ highContrastMode?: boolean }>;
	pageStore: MockStore<{ url: URL }>;
	i18nStore: MockStore<I18nValue>;
};

const mocks: MockSet = vi.hoisted(() => {
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

	return {
		createTopupMock: vi.fn().mockResolvedValue({ confirmation_url: '/billing/balance' }),
		getBalanceMock: vi.fn(),
		getLeadMagnetInfoMock: vi.fn().mockResolvedValue({ enabled: false }),
		getLedgerMock: vi.fn().mockResolvedValue([]),
		getUsageEventsMock: vi.fn().mockResolvedValue([]),
		updateAutoTopupMock: vi.fn().mockResolvedValue({ status: 'ok' }),
		updateBillingSettingsMock: vi.fn().mockResolvedValue({ status: 'ok' }),
		getUserInfoMock: vi.fn().mockResolvedValue({
			billing_contact_email: '',
			billing_contact_phone: ''
		}),
		trackEventMock: vi.fn(),
		gotoMock: vi.fn(),
		toast: { error: vi.fn(), success: vi.fn() },
		webuiNameStore: createStore('Airis'),
		modelsStore: createStore([]),
		settingsStore: createStore({ highContrastMode: false }),
		pageStore: createStore({ url: new URL('http://localhost/billing/balance') }),
		i18nStore: createStore<I18nValue>({
			locale: 'en',
			t: (key: string) => key
		})
	};
});

vi.mock(
	'$lib/apis/billing',
	() => ({
		createTopup: mocks.createTopupMock,
		getBalance: mocks.getBalanceMock,
		getLeadMagnetInfo: mocks.getLeadMagnetInfoMock,
		getLedger: mocks.getLedgerMock,
		getUsageEvents: mocks.getUsageEventsMock,
		updateAutoTopup: mocks.updateAutoTopupMock,
		updateBillingSettings: mocks.updateBillingSettingsMock
	}),
	{ virtual: true }
);
vi.mock('$lib/apis/users', () => ({ getUserInfo: mocks.getUserInfoMock }), { virtual: true });
vi.mock('$lib/stores', () => ({
	WEBUI_NAME: mocks.webuiNameStore,
	models: mocks.modelsStore,
	settings: mocks.settingsStore
}), { virtual: true });
vi.mock('$lib/utils/analytics', () => ({ trackEvent: mocks.trackEventMock }), { virtual: true });
vi.mock('$app/navigation', () => ({ goto: mocks.gotoMock }), { virtual: true });
vi.mock('$app/stores', () => ({ page: mocks.pageStore }), { virtual: true });
vi.mock('svelte-sonner', () => ({ toast: mocks.toast }), { virtual: true });

const flushPromises = async (): Promise<void> => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

const createBalance = (overrides: Partial<Balance> = {}): Balance => ({
	balance_topup_kopeks: 25000,
	balance_included_kopeks: 0,
	included_expires_at: null,
	max_reply_cost_kopeks: null,
	daily_cap_kopeks: null,
	daily_spent_kopeks: 0,
	auto_topup_enabled: false,
	auto_topup_threshold_kopeks: null,
	auto_topup_amount_kopeks: null,
	auto_topup_fail_count: 0,
	auto_topup_last_failed_at: null,
	currency: 'RUB',
	...overrides
});

const createContext = (): Map<string, unknown> => new Map([['i18n', mocks.i18nStore]]);

describe('Billing balance page', () => {
	let mounted: Record<string, unknown> | null = null;
	let target: HTMLDivElement | null = null;

	beforeEach(() => {
		mocks.getBalanceMock.mockReset();
		mocks.getLeadMagnetInfoMock.mockReset().mockResolvedValue({ enabled: false });
		mocks.getUserInfoMock.mockReset().mockResolvedValue({
			billing_contact_email: '',
			billing_contact_phone: ''
		});
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance') });
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

	const renderPage = () => {
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(Page, {
			target,
			context: createContext()
		});
		return target;
	};

	it('auto-expands advanced settings when auto-topup is enabled', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance({ auto_topup_enabled: true }));

		const root = renderPage();
		await flushPromises();

		const toggle = root.querySelector('button[aria-controls^="wallet-advanced-settings-"]');
		expect(toggle?.getAttribute('aria-expanded')).toBe('true');
	});

	it('keeps advanced settings collapsed when no settings are configured', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance());

		const root = renderPage();
		await flushPromises();

		const toggle = root.querySelector('button[aria-controls^="wallet-advanced-settings-"]');
		expect(toggle?.getAttribute('aria-expanded')).toBe('false');
	});
});
