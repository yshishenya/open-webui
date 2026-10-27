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
	beforeNavigateMock: ReturnType<typeof vi.fn>;
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
		beforeNavigateMock: vi.fn(),
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
vi.mock('$app/navigation', () => ({
	goto: mocks.gotoMock,
	afterNavigate: vi.fn(),
	beforeNavigate: mocks.beforeNavigateMock
}));
vi.mock('$app/state', () => ({ updated: { current: false } }));
vi.mock('$app/stores', () => ({ page: mocks.pageStore }));
vi.mock('svelte-sonner', () => ({ toast: mocks.toast }));
// jsdom has no Web Animations API. Keep the real Modal and its focus lifecycle;
// only visual transitions are synchronous, as in EditUserModal.billing tests.
vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }) }));
vi.mock('$lib/utils/transitions', () => ({ flyAndScale: () => ({ duration: 0 }) }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => {
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		return {
			activate: vi.fn(),
			deactivate: vi.fn(() => {
				setTimeout(() => previous?.focus(), 0);
			}),
			pause: vi.fn(),
			unpause: vi.fn()
		};
	}
}));

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
		mocks.beforeNavigateMock.mockReset();
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
		mocks.updateAutoTopupMock.mockReset().mockResolvedValue({ status: 'ok' });
		mocks.updateBillingSettingsMock.mockReset().mockResolvedValue({ status: 'ok' });
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

	it.each(['max_reply_cost', 'billing_contact_email', 'auto_topup_threshold'])(
		'guards the unsaved %s draft and allows confirmed departure',
		async (name) => {
			mocks.getBalanceMock.mockResolvedValue(
				createBalance({ auto_topup_enabled: true, max_reply_cost_kopeks: 100 })
			);
			mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=limits') });
			const root = renderPage();
			await flushPromises();
			const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
			try {
				const navigate = mocks.beforeNavigateMock.mock.calls[0][0];
				const navigation = {
					from: { url: new URL('http://localhost/billing/balance') },
					to: { url: new URL('http://localhost/billing/history') },
					willUnload: false,
					cancel: vi.fn()
				};
				navigate(navigation);
				expect(confirm).not.toHaveBeenCalled();
				const input = root.querySelector<HTMLInputElement>(`input[name="${name}"]`);
				expect(input).toBeTruthy();
				input!.value = name === 'billing_contact_email' ? 'draft@example.test' : '10';
				input!.dispatchEvent(new Event('input', { bubbles: true }));
				await flushPromises();
				navigate(navigation);
				expect(navigation.cancel).toHaveBeenCalledOnce();
				expect(input!.value).toBe(name === 'billing_contact_email' ? 'draft@example.test' : '10');
				confirm.mockReturnValue(true);
				navigation.cancel.mockClear();
				navigate(navigation);
				expect(navigation.cancel).not.toHaveBeenCalled();
			} finally {
				confirm.mockRestore();
			}
		}
	);

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

	it('names the billing help dialog through the existing Modal contract', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		const root = renderPage();
		await flushPromises();
		[...root.querySelectorAll('button')]
			.find((button) => button.textContent?.includes('How billing works'))
			?.click();
		await flushPromises();
		expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
			'How billing works'
		);
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
		expect(returnUrl.searchParams.get('topup_return_id')).toMatch(/^[a-zA-Z0-9_-]+$/);
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

	it('checks a returning payment after eleven minutes rather than dropping its recovery', async () => {
		vi.useFakeTimers();
		storeReturningTopup();
		vi.setSystemTime(Date.now() + 11 * 60 * 1000);
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		mocks.reconcileTopupMock.mockResolvedValue({ credited: true });
		const root = renderPage();
		await vi.advanceTimersByTimeAsync(3000);
		expect(mocks.reconcileTopupMock).toHaveBeenCalledWith('test-token', 'newpay00');
		expect(root.textContent).toContain('Top-up successful');
	});

	it('recovers the URL payment without storage and never infers success from a larger balance', async () => {
		vi.useFakeTimers();
		mocks.pageStore.set({
			url: new URL('http://localhost/billing/balance?topup_return=1&topup_payment_id=url-payment')
		});
		mocks.getBalanceMock.mockResolvedValue(createBalance({ balance_topup_kopeks: 999999 }));
		mocks.reconcileTopupMock.mockResolvedValue({ credited: false, provider_status: 'pending' });
		const root = renderPage();
		await vi.advanceTimersByTimeAsync(3000);
		expect(mocks.reconcileTopupMock).toHaveBeenCalledWith('test-token', 'url-payment');
		expect(root.textContent).toContain('Awaiting payment confirmation');
		expect(root.textContent).not.toContain('Top-up successful');
	});

	it('checks the first URL payment without consuming the second stored payment', async () => {
		vi.useFakeTimers();
		storeReturningTopup();
		mocks.pageStore.set({
			url: new URL('http://localhost/billing/balance?topup_return=1&topup_payment_id=first-payment')
		});
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		mocks.reconcileTopupMock.mockResolvedValue({ credited: true });
		const root = renderPage();
		await vi.advanceTimersByTimeAsync(3000);
		expect(mocks.reconcileTopupMock).toHaveBeenCalledWith('test-token', 'first-payment');
		expect(root.textContent).toContain('Top-up successful');
		expect(JSON.parse(localStorage.getItem('billing_topup_flow_v1') ?? '{}').payment_id).toBe(
			'newpay00'
		);
	});

	it('recovers the exact stored flow when two payments return out of order after eleven minutes', async () => {
		vi.useFakeTimers();
		const first = { payment_id: 'first-payment', amount_kopeks: 50000, return_to: '/c/first' };
		const second = { payment_id: 'second-payment', amount_kopeks: 100000, return_to: '/c/second' };
		localStorage.setItem('billing_topup_flow_v1:first-flow', JSON.stringify(first));
		localStorage.setItem('billing_topup_flow_v1:second-flow', JSON.stringify(second));
		localStorage.setItem('billing_topup_flow_v1', JSON.stringify(second));
		vi.setSystemTime(Date.now() + 11 * 60 * 1000);
		mocks.pageStore.set({
			url: new URL('http://localhost/billing/balance?topup_return=1&topup_return_id=first-flow')
		});
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		mocks.reconcileTopupMock.mockResolvedValue({ credited: true });
		const root = renderPage();
		await vi.advanceTimersByTimeAsync(3000);
		expect(mocks.reconcileTopupMock).toHaveBeenCalledWith('test-token', 'first-payment');
		expect(root.textContent).toContain('Top-up successful');
		expect(localStorage.getItem('billing_topup_flow_v1:first-flow')).toBeNull();
		expect(
			JSON.parse(localStorage.getItem('billing_topup_flow_v1:second-flow') ?? '{}').payment_id
		).toBe('second-payment');
		localStorage.removeItem('billing_topup_flow_v1:second-flow');
	});

	it('does not reconcile an unrelated legacy payment if a returning flow lost its storage', async () => {
		storeReturningTopup();
		mocks.pageStore.set({
			url: new URL('http://localhost/billing/balance?topup_return=1&topup_return_id=lost-flow')
		});
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		const root = renderPage();
		await flushPromises();
		expect(root.textContent).toContain('Payment status could not be checked');
		expect(mocks.reconcileTopupMock).not.toHaveBeenCalled();
	});

	it.each(['', '&topup_payment_id=../invalid'])(
		'offers history when return identity is unavailable or invalid %s',
		async (query) => {
			mocks.pageStore.set({
				url: new URL(`http://localhost/billing/balance?topup_return=1${query}`)
			});
			mocks.getBalanceMock.mockResolvedValue(createBalance());
			const root = renderPage();
			await flushPromises();
			expect(root.textContent).toContain('Payment status could not be checked');
			expect(root.querySelector('a[href="/billing/history"]')).toBeTruthy();
			expect(mocks.reconcileTopupMock).not.toHaveBeenCalled();
		}
	);

	it('keeps an ownership/reconciliation failure unknown rather than successful', async () => {
		vi.useFakeTimers();
		mocks.pageStore.set({
			url: new URL(
				'http://localhost/billing/balance?topup_return=1&topup_payment_id=foreign-payment'
			)
		});
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		mocks.reconcileTopupMock.mockRejectedValue(
			new Error('Payment does not belong to the current user')
		);
		const root = renderPage();
		await vi.advanceTimersByTimeAsync(3000);
		expect(root.textContent).toContain('Payment status could not be checked');
		expect(root.textContent).not.toContain('Top-up successful');
	});

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
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toBe('max-reply-cost-error');
		expect(document.activeElement).toBe(input);
		expect(root.querySelector('input[name="daily_cap"]')?.getAttribute('aria-invalid')).not.toBe(
			'true'
		);
		input.value = '0';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await flushPromises();
		save?.click();
		await flushPromises();
		expect(mocks.updateBillingSettingsMock.mock.calls.at(-1)?.[1].max_reply_cost_kopeks).toBe(0);
	});
	it('does not mark valid limit fields invalid after a network failure', async () => {
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=limits') });
		mocks.getBalanceMock.mockResolvedValue(
			createBalance({ max_reply_cost_kopeks: 1000, daily_cap_kopeks: 2000 })
		);
		mocks.updateBillingSettingsMock.mockRejectedValue(new Error('network unavailable'));
		const root = renderPage();
		await flushPromises();
		const input = root.querySelector('input[name="max_reply_cost"]') as HTMLInputElement;
		input.value = '15';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await flushPromises();
		[...root.querySelectorAll('button')]
			.find((button) => button.textContent?.includes('Save limits'))
			?.click();
		await flushPromises();
		expect(root.textContent).toContain('Failed to update billing settings');
		for (const field of root.querySelectorAll('input[inputmode="decimal"]')) {
			expect(field.getAttribute('aria-invalid')).toBe('false');
			expect(field.getAttribute('aria-describedby')).toBeNull();
		}
	});

	it.each([
		['email', 'not-an-email', 'Enter a valid email address'],
		['phone', 'not-a-phone', 'Enter a valid phone number']
	])(
		'identifies and focuses the invalid receipt %s without submitting it',
		async (field, value, message) => {
			mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=limits') });
			mocks.getBalanceMock.mockResolvedValue(createBalance());
			const root = renderPage();
			await flushPromises();
			const input = root.querySelector(
				`input[name="billing_contact_${field}"]`
			) as HTMLInputElement;
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			await flushPromises();
			const save = [...root.querySelectorAll('button')].find((button) =>
				button.textContent?.includes('Save contacts')
			) as HTMLButtonElement;
			save.click();
			await flushPromises();
			expect(mocks.updateBillingSettingsMock).not.toHaveBeenCalled();
			expect(input.getAttribute('aria-invalid')).toBe('true');
			const errorId = input.getAttribute('aria-describedby');
			expect(errorId).toBe(`billing-contact-${field}-error`);
			expect(document.getElementById(errorId ?? '')?.textContent).toContain(message);
			expect(document.activeElement).toBe(input);
			const other = root.querySelector(
				`input[name="billing_contact_${field === 'email' ? 'phone' : 'email'}"]`
			);
			expect(other?.getAttribute('aria-invalid')).not.toBe('true');
			input.value = field === 'email' ? 'receipt@example.com' : '+7 900 000 00 00';
			input.dispatchEvent(new Event('input', { bubbles: true }));
			await flushPromises();
			expect(input.getAttribute('aria-invalid')).toBe('false');
			expect(input.getAttribute('aria-describedby')).toBeNull();
			save.click();
			await flushPromises();
			expect(mocks.updateBillingSettingsMock).toHaveBeenCalledTimes(1);
			expect(mocks.updateBillingSettingsMock.mock.calls[0][1][`billing_contact_${field}`]).toBe(
				input.value
			);
			expect(save.disabled).toBe(true);
		}
	);

	it('preserves receipt contacts after a network failure and permits retry without field errors', async () => {
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=limits') });
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		mocks.updateBillingSettingsMock.mockRejectedValueOnce(new Error('network unavailable'));
		const root = renderPage();
		await flushPromises();
		const email = root.querySelector('input[name="billing_contact_email"]') as HTMLInputElement;
		email.value = 'receipt@example.com';
		email.dispatchEvent(new Event('input', { bubbles: true }));
		await flushPromises();
		const save = [...root.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Save contacts')
		) as HTMLButtonElement;
		save.click();
		await flushPromises();
		expect(root.textContent).toContain('Failed to update billing settings');
		expect(email.value).toBe('receipt@example.com');
		expect(save.disabled).toBe(false);
		for (const input of root.querySelectorAll('input[name^="billing_contact_"]')) {
			expect(input.getAttribute('aria-invalid')).toBe('false');
			expect(input.getAttribute('aria-describedby')).toBeNull();
		}
		save.click();
		await flushPromises();
		expect(mocks.updateBillingSettingsMock).toHaveBeenCalledTimes(2);
		expect(save.disabled).toBe(true);
		expect(root.textContent).not.toContain('Failed to update billing settings');
	});

	it('keeps newer contact edits unsaved when an earlier save completes', async () => {
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=limits') });
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		let complete: () => void = () => {};
		mocks.updateBillingSettingsMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					complete = () => resolve({ status: 'ok' });
				})
		);
		const root = renderPage();
		await flushPromises();
		const email = root.querySelector('input[name="billing_contact_email"]') as HTMLInputElement;
		const set = (value: string): void => {
			email.value = value;
			email.dispatchEvent(new Event('input', { bubbles: true }));
		};
		set('sent@example.com');
		await flushPromises();
		const save = [...root.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Save contacts')
		) as HTMLButtonElement;
		save.click();
		await flushPromises();
		set('newer@example.com');
		await flushPromises();
		complete();
		await flushPromises();
		expect(mocks.updateBillingSettingsMock.mock.calls[0][1].billing_contact_email).toBe(
			'sent@example.com'
		);
		expect(email.value).toBe('newer@example.com');
		expect(save.disabled).toBe(false);
	});

	it.each(['limits', 'contacts', 'auto_topup', 'topup'])(
		'never submits the loaded account form as another account: %s',
		async (section) => {
			mocks.pageStore.set({
				url: new URL(
					`http://localhost/billing/balance?focus=${section === 'contacts' ? 'limits' : section}`
				)
			});
			mocks.getBalanceMock.mockResolvedValue(
				createBalance({
					max_reply_cost_kopeks: 1000,
					auto_topup_threshold_kopeks: 1000,
					auto_topup_amount_kopeks: 50000
				})
			);
			const root = renderPage();
			await flushPromises();
			if (section === 'limits' || section === 'contacts') {
				const field = root.querySelector<HTMLInputElement>(
					section === 'limits' ? '[name="max_reply_cost"]' : '[name="billing_contact_email"]'
				)!;
				field.value = section === 'limits' ? '25' : 'account-a@example.com';
				field.dispatchEvent(new Event('input', { bubbles: true }));
			} else if (section === 'auto_topup')
				root.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
			await flushPromises();
			localStorage.token = 'other-account';
			const button =
				section === 'topup'
					? root.querySelector<HTMLButtonElement>('[data-testid="topup-preset"]')
					: [...root.querySelectorAll('button')].find((candidate) =>
							candidate.textContent?.includes(
								section === 'limits'
									? 'Save limits'
									: section === 'contacts'
										? 'Save contacts'
										: 'Save auto-topup'
							)
						);
			expect(button).toBeTruthy();
			expect(button?.disabled).toBe(false);
			button?.click();
			await flushPromises();
			expect(mocks.updateBillingSettingsMock).not.toHaveBeenCalled();
			expect(mocks.updateAutoTopupMock).not.toHaveBeenCalled();
			expect(mocks.createTopupMock).not.toHaveBeenCalled();
		}
	);

	it.each(['balance', 'quota', 'contacts'])(
		'discards an account switch while awaiting %s without starting a mixed-account read',
		async (stage) => {
			let finish: () => void = () => {};
			mocks.getBalanceMock.mockResolvedValue(createBalance());
			if (stage === 'balance')
				mocks.getBalanceMock.mockImplementationOnce(
					() =>
						new Promise<Balance>((resolve) => {
							finish = () => resolve(createBalance());
						})
				);
			if (stage === 'quota')
				mocks.getLeadMagnetInfoMock.mockImplementationOnce(
					() =>
						new Promise((resolve) => {
							finish = () => resolve(createLeadMagnetInfo());
						})
				);
			if (stage === 'contacts')
				mocks.getUserInfoMock.mockImplementationOnce(
					() =>
						new Promise((resolve) => {
							finish = () => resolve({ billing_contact_email: 'old-account@example.com' });
						})
				);
			const root = renderPage();
			await flushPromises();
			localStorage.token = 'other-account';
			finish();
			await flushPromises();
			for (const mock of [
				mocks.getBalanceMock,
				mocks.getLeadMagnetInfoMock,
				mocks.getUserInfoMock
			]) {
				expect(mock.mock.calls.every(([token]) => token === 'test-token')).toBe(true);
			}
			if (stage !== 'contacts') expect(mocks.getUserInfoMock).not.toHaveBeenCalled();
			expect(root.textContent).not.toContain('old-account@example.com');
		}
	);

	it('does not publish save feedback or auto-topup readback after an account switch', async () => {
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=auto_topup') });
		mocks.getBalanceMock.mockResolvedValue(
			createBalance({ auto_topup_threshold_kopeks: 1000, auto_topup_amount_kopeks: 50000 })
		);
		let finish: () => void = () => {};
		mocks.updateAutoTopupMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = () => resolve({ status: 'ok' });
				})
		);
		const root = renderPage();
		await flushPromises();
		root.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
		await flushPromises();
		[...root.querySelectorAll('button')]
			.find((button) => button.textContent?.includes('Save auto-topup'))
			?.click();
		await flushPromises();
		expect(mocks.updateAutoTopupMock.mock.calls[0]?.[0]).toBe('test-token');
		localStorage.token = 'other-account';
		finish();
		await flushPromises();
		expect(mocks.getBalanceMock).toHaveBeenCalledTimes(1);
		expect(mocks.toast.success).not.toHaveBeenCalled();
	});

	it('does not let a pre-save refresh overwrite successfully saved limits', async () => {
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=limits') });
		const original = createBalance({ max_reply_cost_kopeks: 1000, daily_cap_kopeks: 2000 });
		const confirmed = createBalance({ max_reply_cost_kopeks: 2500, daily_cap_kopeks: 2000 });
		mocks.getBalanceMock.mockResolvedValue(original);
		mocks.getUserInfoMock.mockRejectedValueOnce(new Error('contacts temporarily unavailable'));
		const root = renderPage();
		await flushPromises();
		const input = root.querySelector<HTMLInputElement>('[name="max_reply_cost"]')!;
		input.value = '25';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await flushPromises();
		let finish: (balance: Balance) => void = () => {};
		mocks.getBalanceMock
			.mockImplementationOnce(
				() =>
					new Promise<Balance>((resolve) => {
						finish = resolve;
					})
			)
			.mockResolvedValue(confirmed);
		[...root.querySelectorAll('button')].find((button) => button.textContent === 'Retry')?.click();
		await flushPromises();
		expect(mocks.getBalanceMock).toHaveBeenCalledTimes(2);
		[...root.querySelectorAll('button')]
			.find((button) => button.textContent?.includes('Save limits'))
			?.click();
		await flushPromises();
		expect(mocks.updateBillingSettingsMock).toHaveBeenCalledWith('test-token', {
			max_reply_cost_kopeks: 2500,
			daily_cap_kopeks: 2000
		});
		finish(original);
		await flushPromises();
		expect(input.value).toBe('25');
		expect(root.textContent).toContain('Billing settings saved');
		expect(
			[...root.querySelectorAll('button')].find((button) =>
				button.textContent?.includes('Save limits')
			)?.disabled
		).toBe(true);
	});

	it('focuses top-up only after the modal delayed return-focus timer finishes', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		const root = renderPage();
		await flushPromises();
		const help = [...root.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('How billing works')
		)!;
		help.focus();
		help.click();
		await flushPromises();
		const dialog = document.querySelector('[role="dialog"]')!;
		[...dialog.querySelectorAll('button')]
			.find((button) => button.textContent?.trim() === 'Top up')!
			.click();
		await flushPromises();
		await flushPromises();
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(root.querySelector('[data-testid="topup-preset"]'));
	});

	it('moves focus to top-up controls and on client-side settings transitions', async () => {
		mocks.getBalanceMock.mockResolvedValue(createBalance());
		const root = renderPage();
		await flushPromises();
		(root.querySelector('[data-testid="wallet-hero-topup"]') as HTMLButtonElement).click();
		await flushPromises();
		expect(document.activeElement).toBe(root.querySelector('[data-testid="topup-preset"]'));
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=limits') });
		await flushPromises();
		expect(document.activeElement).toBe(root.querySelector('#spend-controls-section input'));
		mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=auto_topup') });
		await flushPromises();
		expect(document.activeElement).toBe(root.querySelector('#auto-topup-section [role="switch"]'));
	});

	it.each(['success', 'failure'])(
		'uses confirmed auto-topup failure state after %s and preserves later edits',
		async (outcome) => {
			mocks.pageStore.set({ url: new URL('http://localhost/billing/balance?focus=auto_topup') });
			const failed = createBalance({
				auto_topup_fail_count: 3,
				auto_topup_last_failed_at: 1000,
				auto_topup_threshold_kopeks: 1000,
				auto_topup_amount_kopeks: 50000
			});
			mocks.getBalanceMock.mockResolvedValueOnce(failed).mockResolvedValue(
				createBalance({
					auto_topup_enabled: true,
					auto_topup_threshold_kopeks: 1000,
					auto_topup_amount_kopeks: 50000
				})
			);
			let finish: () => void = () => {};
			mocks.updateAutoTopupMock.mockImplementation(
				() =>
					new Promise((resolve, reject) => {
						finish = () =>
							outcome === 'success' ? resolve({ status: 'ok' }) : reject(new Error('network'));
					})
			);
			const root = renderPage();
			await flushPromises();
			expect(root.textContent).toContain('Auto-topup disabled after failed attempts');
			(root.querySelector('[role="switch"]') as HTMLButtonElement).click();
			await flushPromises();
			const save = [...root.querySelectorAll('button')].find((button) =>
				button.textContent?.includes('Save auto-topup')
			) as HTMLButtonElement;
			save.click();
			await flushPromises();
			const threshold = root.querySelector('[name="auto_topup_threshold"]') as HTMLInputElement;
			threshold.value = '30';
			threshold.dispatchEvent(new Event('input', { bubbles: true }));
			await flushPromises();
			finish();
			await flushPromises();
			expect(threshold.value).toBe('30');
			expect(save.disabled).toBe(false);
			if (outcome === 'success') {
				expect(root.textContent).not.toContain('Auto-topup disabled after failed attempts');
				expect(root.textContent).not.toContain('Last failed');
			} else {
				expect(root.textContent).toContain('Auto-topup disabled after failed attempts');
				expect(threshold.getAttribute('aria-invalid')).toBe('false');
			}
		}
	);
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
