// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { createInstance } from 'i18next';
import type { LedgerEntry } from '$lib/apis/billing';

vi.mock('$lib/utils/airis/funnelAnalytics', () => ({ browserTracksPayments: async () => true }));

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
	language: string;
	resolvedLanguage?: string;
	t: (key: string, vars?: Record<string, string | number>) => string;
};

type MockStore<T> = {
	subscribe: (run: (value: T) => void) => () => void;
	set: (value: T) => void;
};

type WalletTestModel = {
	id: string;
	name?: string;
	info?: { meta?: { lead_magnet?: boolean } };
};

type MockSet = {
	createTopupMock: ReturnType<typeof vi.fn>;
	getBalanceMock: ReturnType<typeof vi.fn>;
	getLeadMagnetInfoMock: ReturnType<typeof vi.fn>;
	getPublicPricingConfigMock: ReturnType<typeof vi.fn>;
	reconcileTopupMock: ReturnType<typeof vi.fn>;
	getLedgerMock: ReturnType<typeof vi.fn>;
	getUsageEventsMock: ReturnType<typeof vi.fn>;
	updateAutoTopupMock: ReturnType<typeof vi.fn>;
	updateBillingSettingsMock: ReturnType<typeof vi.fn>;
	getUserInfoMock: ReturnType<typeof vi.fn>;
	trackEventMock: ReturnType<typeof vi.fn>;
	trackEcommercePurchaseMock: ReturnType<typeof vi.fn>;
	gotoMock: ReturnType<typeof vi.fn>;
	toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
	webuiNameStore: MockStore<string>;
	modelsStore: MockStore<WalletTestModel[]>;
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
		getPublicPricingConfigMock: vi.fn().mockResolvedValue(null),
		reconcileTopupMock: vi.fn().mockResolvedValue({ credited: false }),
		getLedgerMock: vi.fn().mockResolvedValue([]),
		getUsageEventsMock: vi.fn().mockResolvedValue([]),
		updateAutoTopupMock: vi.fn().mockResolvedValue({ status: 'ok' }),
		updateBillingSettingsMock: vi.fn().mockResolvedValue({ status: 'ok' }),
		getUserInfoMock: vi.fn().mockResolvedValue({
			billing_contact_email: '',
			billing_contact_phone: ''
		}),
		trackEventMock: vi.fn(),
		trackEcommercePurchaseMock: vi.fn(),
		gotoMock: vi.fn(),
		toast: { error: vi.fn(), success: vi.fn() },
		webuiNameStore: createStore('Airis'),
		modelsStore: createStore<WalletTestModel[]>([]),
		settingsStore: createStore<{ highContrastMode?: boolean }>({ highContrastMode: false }),
		pageStore: createStore({ url: new URL('http://localhost/billing/balance') }),
		i18nStore: createStore<I18nValue>({
			language: 'en-US',
			t: (key: string) => key
		})
	};
});

vi.mock('$lib/apis/billing', () => ({
	createTopup: mocks.createTopupMock,
	getBalance: mocks.getBalanceMock,
	getLeadMagnetInfo: mocks.getLeadMagnetInfoMock,
	getPublicPricingConfig: mocks.getPublicPricingConfigMock,
	reconcileTopup: mocks.reconcileTopupMock,
	getLedger: mocks.getLedgerMock,
	getUsageEvents: mocks.getUsageEventsMock,
	getBillingRefunds: vi.fn().mockResolvedValue({ items: [], total: 0 }),
	getBillingSummary: vi
		.fn()
		.mockResolvedValue({ currency: 'RUB', topup_kopeks: 0, spent_kopeks: 0, refund_kopeks: 0 }),
	updateAutoTopup: mocks.updateAutoTopupMock,
	updateBillingSettings: mocks.updateBillingSettingsMock
}));
vi.mock('$lib/apis/users', () => ({ getUserInfo: mocks.getUserInfoMock }));
vi.mock('$lib/stores', () => ({
	WEBUI_NAME: mocks.webuiNameStore,
	models: mocks.modelsStore,
	settings: mocks.settingsStore
}));
vi.mock('$lib/utils/analytics', () => ({
	trackEvent: mocks.trackEventMock,
	trackEcommercePurchase: mocks.trackEcommercePurchaseMock
}));
vi.mock('$app/navigation', () => ({ goto: mocks.gotoMock }));
vi.mock('$app/stores', () => ({ page: mocks.pageStore }));
vi.mock('svelte-sonner', () => ({ toast: mocks.toast }));

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

const createLeadMagnetInfo = (enabled = true) => ({
	enabled,
	cycle_start: null,
	cycle_end: null,
	usage: { tokens_input: 0, tokens_output: 0, images: 0, tts_seconds: 0, stt_seconds: 0 },
	quotas: { tokens_input: 1000, tokens_output: 1000, images: 10, tts_seconds: 60, stt_seconds: 60 },
	remaining: {
		tokens_input: 1000,
		tokens_output: 1000,
		images: 10,
		tts_seconds: 60,
		stt_seconds: 60
	},
	config_version: 1
});

const createContext = (): Map<string, unknown> => new Map([['i18n', mocks.i18nStore]]);

describe('Billing balance page', () => {
	let mounted: Record<string, unknown> | null = null;
	let target: HTMLDivElement | null = null;

	beforeEach(() => {
		mocks.createTopupMock.mockReset().mockResolvedValue({ confirmation_url: '/billing/balance' });
		mocks.getBalanceMock.mockReset();
		mocks.getLeadMagnetInfoMock.mockReset().mockResolvedValue({ enabled: false });
		mocks.getPublicPricingConfigMock.mockReset().mockResolvedValue(null);
		mocks.reconcileTopupMock.mockReset().mockResolvedValue({ credited: false });
		mocks.getLedgerMock.mockReset().mockResolvedValue([]);
		mocks.getUsageEventsMock.mockReset().mockResolvedValue([]);
		mocks.getUserInfoMock.mockReset().mockResolvedValue({
			billing_contact_email: '',
			billing_contact_phone: ''
		});
		mocks.toast.error.mockReset();
		mocks.toast.success.mockReset();
		mocks.modelsStore.set([]);
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance') });
		localStorage.token = 'test-token';
		mocks.i18nStore.set({ language: 'en-US', t: (key: string) => key });
		localStorage.removeItem('billing_topup_flow_v1');
	});

	afterEach(async () => {
		if (mounted) {
			await unmount(mounted);
		}
		vi.useRealTimers();
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

	it('updates wallet total and package amounts on language change without another balance fetch', async () => {
		const selected = createInstance();
		await selected.init({
			lng: 'en-US',
			fallbackLng: 'en-US',
			resources: {
				'en-US': { translation: { 'Available now': 'Available now' } },
				'ru-RU': { translation: { 'Available now': 'Доступно сейчас' } }
			}
		});
		mocks.i18nStore.set(selected);
		mocks.getBalanceMock.mockResolvedValue(createBalance({ balance_topup_kopeks: 150000 }));
		const root = renderPage();
		await flushPromises();
		expect(root.querySelector('.text-3xl')?.textContent?.trim()).toBe(
			new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RUB' }).format(1500)
		);
		await selected.changeLanguage('ru-RU');
		mocks.i18nStore.set(selected);
		await flushPromises();
		expect(root.querySelector('.text-3xl')?.textContent?.trim()).toBe(
			new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(1500)
		);
		for (const preset of root.querySelectorAll('[data-testid="topup-preset"]')) {
			const amount = Number(preset.getAttribute('data-amount-kopeks')) / 100;
			expect(preset.textContent?.trim()).toBe(
				new Intl.NumberFormat('ru-RU', {
					style: 'currency',
					currency: 'RUB',
					maximumFractionDigits: 0
				}).format(amount)
			);
		}
		expect(mocks.getBalanceMock).toHaveBeenCalledTimes(1);
		expect(mocks.createTopupMock).not.toHaveBeenCalled();
	});

	it('opens payment settings explicitly when requested', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance({ auto_topup_enabled: true }));
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=limits') });

		const root = renderPage();
		await flushPromises();

		expect(root.textContent).toContain('Payment settings');
		expect(root.textContent).toContain('Spend controls');
		expect(root.querySelector('[data-testid="topup-proceed"]')).toBeNull();
	});

	it('keeps payment settings separate from the balance page', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance());

		const root = renderPage();
		await flushPromises();

		expect(root.textContent).not.toContain('Save limits');
		expect(root.querySelector('[data-testid="topup-proceed"]')).toBeTruthy();
	});

	it('preselects the smallest package for paid recovery even with free usage', async () => {
		mocks.getLeadMagnetInfoMock.mockResolvedValue(createLeadMagnetInfo(true));
		mocks.modelsStore.set([{ id: 'free-model', info: { meta: { lead_magnet: true } } }]);
		mocks.getBalanceMock.mockResolvedValue(createBalance({ balance_topup_kopeks: 0 }));
		mocks.getPublicPricingConfigMock.mockResolvedValue({ topup_amounts_rub: [500, 1000, 2000] });
		mocks.pageStore.set({
			url: new URL('http://localhost/billing/balance?focus=topup&required_kopeks=21')
		});

		const root = renderPage();
		await flushPromises();
		await flushPromises();

		const recommended = root.querySelector('[data-testid="topup-recommendation"]');
		const presets = [...root.querySelectorAll('[data-testid="topup-preset"]')];
		const proceed = root.querySelector('[data-testid="topup-proceed"]') as HTMLButtonElement | null;

		expect(recommended?.textContent).toContain('Recommended top-up');
		expect(presets[0]?.getAttribute('aria-pressed')).toBe('true');
		expect(proceed?.disabled).toBe(false);
	});

	it('preselects the first package for a low balance without free usage', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance({ balance_topup_kopeks: 0 }));
		mocks.getPublicPricingConfigMock.mockResolvedValue({ topup_amounts_rub: [500, 1000, 2000] });

		const root = renderPage();
		await flushPromises();
		await flushPromises();

		const presets = [...root.querySelectorAll('[data-testid="topup-preset"]')];
		const proceed = root.querySelector('[data-testid="topup-proceed"]') as HTMLButtonElement | null;

		expect(presets[0]?.getAttribute('aria-pressed')).toBe('true');
		expect(proceed?.disabled).toBe(false);
		expect(proceed?.textContent).toContain('Continue to payment');
	});

	it('hides free-limit hint when free models are unavailable', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance({ balance_topup_kopeks: 5000 }));
		mocks.getLeadMagnetInfoMock.mockResolvedValue(createLeadMagnetInfo(true));
		mocks.modelsStore.set([]);

		const root = renderPage();
		await flushPromises();

		expect(root.textContent).not.toContain('Wallet is low but free limit is available');
		expect(root.textContent).toContain('Top up to keep working');
		expect(root.querySelector('[data-testid="wallet-low-balance-hint-free"]')).toBeNull();
		expect(root.querySelector('[data-testid="wallet-low-balance-hint-topup"]')).toBeTruthy();
	});

	it.each([0, 5000])('avoids payment urgency with free usage and cash=%s', async (cash) => {
		mocks.getBalanceMock.mockResolvedValue(createBalance({ balance_topup_kopeks: cash }));
		mocks.getPublicPricingConfigMock.mockResolvedValue({ topup_amounts_rub: [500, 1000, 2000] });
		mocks.getLeadMagnetInfoMock.mockResolvedValue(createLeadMagnetInfo(true));
		mocks.modelsStore.set([
			{
				id: 'free-model',
				name: 'Free Model',
				info: { meta: { lead_magnet: true } }
			}
		]);

		const root = renderPage();
		await flushPromises();

		expect(root.textContent).not.toContain('Low balance');
		expect(root.querySelector('[data-testid="wallet-low-balance-hint"]')).toBeNull();
		expect(root.querySelector('[data-testid="lead-magnet-section"]')).toBeTruthy();
		const presets = [...root.querySelectorAll('[data-testid="topup-preset"]')];
		expect(presets).toHaveLength(3);
		expect(presets.every((preset) => preset.getAttribute('aria-pressed') === 'false')).toBe(true);
		const proceed = root.querySelector('[data-testid="topup-proceed"]') as HTMLButtonElement | null;
		expect(proceed?.disabled).toBe(true);
	});

	it('keeps custom top-up hidden when pricing discovery fails', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		mocks.getPublicPricingConfigMock.mockRejectedValue(new Error('pricing unavailable'));

		const root = renderPage();
		await flushPromises();
		await flushPromises();

		expect(root.querySelector('input[name="custom_topup"]')).toBeNull();
		expect(root.querySelectorAll('[data-testid="topup-preset"]')).toHaveLength(3);
	});

	it('sends normalized return_url for top-up when return_to is valid', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		mocks.createTopupMock.mockResolvedValue({ confirmation_url: '' });
		mocks.pageStore.set({
			url: new URL('http://localhost/billing/balance?return_to=%2Fc%2F123%3Ffocus%3Dtopup')
		});

		const root = renderPage();
		await flushPromises();

		const preset = root.querySelector('[data-testid="topup-preset"]') as HTMLButtonElement | null;
		expect(preset).toBeTruthy();
		preset?.click();
		await flushPromises();

		const proceed = root.querySelector('[data-testid="topup-proceed"]') as HTMLButtonElement | null;
		expect(proceed).toBeTruthy();
		proceed?.click();
		await flushPromises();

		expect(mocks.createTopupMock).toHaveBeenCalled();
		const call = mocks.createTopupMock.mock.calls.at(-1);
		expect(call).toBeTruthy();

		const returnUrl = new URL(String(call?.[2] ?? ''));
		expect(returnUrl.origin).toBe(window.location.origin);
		expect(returnUrl.pathname).toBe('/billing/balance');
		expect(returnUrl.searchParams.get('topup_return')).toBe('1');
		expect(returnUrl.searchParams.get('return_to')).toBe('/c/123?focus=topup');
		expect(returnUrl.hash).toBe('');
	});

	it('omits return_to in top-up return_url when input is invalid', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		mocks.createTopupMock.mockResolvedValue({ confirmation_url: '' });
		mocks.pageStore.set({
			url: new URL('http://localhost/billing/balance?return_to=https%3A%2F%2Fevil.example%2Fpath')
		});

		const root = renderPage();
		await flushPromises();

		const preset = root.querySelector('[data-testid="topup-preset"]') as HTMLButtonElement | null;
		expect(preset).toBeTruthy();
		preset?.click();
		await flushPromises();

		const proceed = root.querySelector('[data-testid="topup-proceed"]') as HTMLButtonElement | null;
		expect(proceed).toBeTruthy();
		proceed?.click();
		await flushPromises();

		expect(mocks.createTopupMock).toHaveBeenCalled();
		const call = mocks.createTopupMock.mock.calls.at(-1);
		expect(call).toBeTruthy();

		const returnUrl = new URL(String(call?.[2] ?? ''));
		expect(returnUrl.searchParams.get('topup_return')).toBe('1');
		expect(returnUrl.searchParams.get('return_to')).toBeNull();
		expect(returnUrl.hash).toBe('');
	});

	it('shows provider error detail when top-up creation fails', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		mocks.createTopupMock.mockRejectedValue('Payment provider credentials are invalid');

		const root = renderPage();
		await flushPromises();

		const preset = root.querySelector('[data-testid="topup-preset"]') as HTMLButtonElement | null;
		expect(preset).toBeTruthy();
		preset?.click();
		await flushPromises();

		const proceed = root.querySelector('[data-testid="topup-proceed"]') as HTMLButtonElement | null;
		expect(proceed).toBeTruthy();
		proceed?.click();
		await flushPromises();

		expect(mocks.toast.error).toHaveBeenCalledWith('Payment provider credentials are invalid');
	});

	const ledgerTopup = (reference: string, createdAt: number): LedgerEntry => ({
		id: reference,
		user_id: 'wallet-user',
		wallet_id: 'wallet',
		currency: 'RUB',
		type: 'topup',
		amount_kopeks: 50000,
		balance_included_after: 0,
		balance_topup_after: 100000,
		reference_type: 'payment',
		reference_id: reference,
		created_at: createdAt
	});

	const storeReturningTopup = (): void => {
		localStorage.setItem(
			'billing_topup_flow_v1',
			JSON.stringify({
				started_at_ms: Date.now(),
				amount_kopeks: 50000,
				previous_total_kopeks: 50000,
				payment_id: 'newpay00',
				return_to: null
			})
		);
	};

	it.each(['automatic', 'manual'])(
		'refreshes recent activity after %s confirmed credit',
		async (path) => {
			vi.useFakeTimers();
			storeReturningTopup();
			const oldEntry = ledgerTopup('oldpay00', 1000);
			const newEntry = ledgerTopup('newpay00', 2000);
			mocks.getBalanceMock.mockResolvedValue(createBalance({ balance_topup_kopeks: 100000 }));
			mocks.getLedgerMock.mockResolvedValueOnce([oldEntry]).mockResolvedValue([newEntry, oldEntry]);
			mocks.reconcileTopupMock.mockResolvedValue({ credited: true });
			const root = renderPage();
			await vi.advanceTimersByTimeAsync(0);
			expect(root.textContent).toContain('#oldpay00');
			expect(root.textContent).not.toContain('#newpay00');
			if (path === 'automatic') {
				await vi.advanceTimersByTimeAsync(3000);
			} else {
				const refresh = [...root.querySelectorAll('button')].find(
					(button) => button.textContent?.trim() === 'Refresh'
				);
				expect(refresh).toBeTruthy();
				refresh?.click();
				await vi.advanceTimersByTimeAsync(0);
			}
			expect(root.textContent).toContain('Top-up successful');
			expect(root.textContent).toContain('#newpay00');
			expect(root.textContent?.match(/#oldpay00/g)).toHaveLength(1);
			expect(mocks.getLedgerMock).toHaveBeenCalledTimes(2);
			await vi.advanceTimersByTimeAsync(9000);
			expect(mocks.getLedgerMock).toHaveBeenCalledTimes(2);
		}
	);

	it.each(['pending', 'error'])(
		'preserves recent activity during %s reconciliation',
		async (outcome) => {
			vi.useFakeTimers();
			storeReturningTopup();
			mocks.getBalanceMock.mockResolvedValue(createBalance({ balance_topup_kopeks: 100000 }));
			mocks.getLedgerMock.mockResolvedValue([ledgerTopup('oldpay00', 1000)]);
			if (outcome === 'error') {
				mocks.reconcileTopupMock.mockRejectedValue(new Error('provider unavailable'));
			}
			const root = renderPage();
			await vi.advanceTimersByTimeAsync(0);
			await vi.advanceTimersByTimeAsync(3000);
			expect(root.textContent).toContain('#oldpay00');
			expect(root.textContent).not.toContain('Top-up successful');
			expect(mocks.getLedgerMock).toHaveBeenCalledTimes(1);
		}
	);

	it('uses the exact payment reconciliation result for top-up success', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance({ balance_topup_kopeks: 50000 }));
		localStorage.setItem(
			'billing_topup_flow_v1',
			JSON.stringify({
				started_at_ms: Date.now(),
				amount_kopeks: 15000,
				previous_total_kopeks: 0,
				payment_id: 'payment-under-test',
				return_to: null
			})
		);

		const root = renderPage();
		await flushPromises();
		expect(root.textContent).toContain('Checking top-up…');
		expect(root.textContent).not.toContain('Top-up successful');

		const refresh = [...root.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === 'Refresh'
		) as HTMLButtonElement | undefined;
		expect(refresh).toBeTruthy();
		refresh?.click();
		await flushPromises();
		expect(root.textContent).not.toContain('Top-up successful');

		mocks.reconcileTopupMock.mockResolvedValue({ credited: true });
		refresh?.click();
		await flushPromises();
		expect(root.textContent).toContain('Top-up successful');
	});
	it.each([
		['canceled', 'Payment canceled; balance was not topped up'],
		['succeeded', 'Payment confirmed; awaiting balance credit']
	])('keeps the provider %s state distinct from confirmed wallet credit', async (status, label) => {
		vi.useFakeTimers();
		storeReturningTopup();
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		mocks.reconcileTopupMock.mockResolvedValue({ credited: false, provider_status: status });
		const root = renderPage();
		await vi.advanceTimersByTimeAsync(3000);
		expect(root.textContent).toContain(label);
		expect(root.textContent).not.toContain('Top-up successful');
	});
	it('rejects a malformed spending limit and preserves an explicit zero limit', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance({ max_reply_cost_kopeks: 1000 }));
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=limits') });
		const root = renderPage();
		await flushPromises();
		const input = root.querySelector('input[name="max_reply_cost"]') as HTMLInputElement;
		input.value = '12abc';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await flushPromises();
		const save = [...root.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Save limits')
		);
		save?.click();
		await flushPromises();
		expect(mocks.updateBillingSettingsMock).not.toHaveBeenCalled();
		expect(root.querySelector('[role="alert"]')?.textContent).toContain(
			'Enter a non-negative amount'
		);
		input.value = '0';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await flushPromises();
		save?.click();
		await flushPromises();
		expect(mocks.updateBillingSettingsMock.mock.calls.at(-1)?.[1].max_reply_cost_kopeks).toBe(0);
	});
	it('disables manual refresh for the whole pending reconciliation', async () => {
		vi.useFakeTimers();
		storeReturningTopup();
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		let complete: (value: { credited: boolean }) => void = () => {};
		mocks.reconcileTopupMock.mockImplementation(
			() =>
				new Promise((resolve) => {
					complete = resolve;
				})
		);
		const root = renderPage();
		await vi.advanceTimersByTimeAsync(0);
		const refresh = [...root.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === 'Refresh'
		) as HTMLButtonElement;
		refresh.click();
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh.disabled).toBe(true);
		await vi.advanceTimersByTimeAsync(3000);
		expect(mocks.reconcileTopupMock).toHaveBeenCalledTimes(1);
		complete({ credited: false });
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh.disabled).toBe(false);
	});
	it('keeps edits made during saving dirty and remembers only the sent limit', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance({ max_reply_cost_kopeks: 1000 }));
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=limits') });
		let saved: () => void = () => {};
		mocks.updateBillingSettingsMock.mockImplementation(
			() =>
				new Promise((resolve) => {
					saved = () => resolve({ status: 'ok' });
				})
		);
		const root = renderPage();
		await flushPromises();
		const input = root.querySelector('input[name="max_reply_cost"]') as HTMLInputElement;
		const set = (value: string) => {
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
		};
		set('20');
		await flushPromises();
		const button = [...root.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Save limits')
		) as HTMLButtonElement;
		button.click();
		await flushPromises();
		set('30');
		await flushPromises();
		saved();
		await flushPromises();
		expect(mocks.updateBillingSettingsMock.mock.calls.at(-1)?.[1].max_reply_cost_kopeks).toBe(2000);
		expect(input.value).toBe('30');
		expect(button.disabled).toBe(false);
	});
});
