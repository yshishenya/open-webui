// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import Plans from './+page.svelte';
import * as api from '$lib/apis/billing';
import type { Plan } from '$lib/apis/billing';
import { config } from '$lib/stores';
import { goto } from '$app/navigation';
import { trackEvent } from '$lib/utils/analytics';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		WEBUI_NAME: writable('Airis'),
		user: writable({ role: 'admin' }),
		config: writable({ features: { enable_billing_subscriptions: true } })
	};
});
vi.mock('$lib/utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('$lib/apis/billing', () => ({
	getPlans: vi.fn(),
	getMySubscription: vi.fn(),
	createPayment: vi.fn(),
	resumeSubscription: vi.fn()
}));

const plan: Plan = {
	id: 'localized',
	name: 'English plan',
	name_ru: 'Русский тариф',
	description: 'English description',
	description_ru: 'Русское описание',
	price: 1234.56,
	currency: 'RUB',
	interval: 'month',
	display_order: 0,
	is_active: true,
	created_at: 1,
	updated_at: 1
};
const subscriptionConfig = config as unknown as Writable<{
	features: { enable_billing_subscriptions: boolean };
}>;
beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(api.getPlans).mockResolvedValue([plan]);
	vi.mocked(api.getMySubscription).mockResolvedValue(null);
	subscriptionConfig.set({ features: { enable_billing_subscriptions: true } });
});

const context = () =>
	new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]]);

it.each(['plans', 'subscription'])(
	'distinguishes a 503 loading %s from empty or unsubscribed and retries without payment',
	async (stage) => {
		const request = stage === 'plans' ? api.getPlans : api.getMySubscription;
		vi.mocked(request).mockRejectedValueOnce({ status: 503 });
		const target = document.createElement('div');
		const component = mount(Plans, { target, context: context() });
		try {
			await vi.waitFor(() => expect(target.querySelector('[role="alert"]')).not.toBeNull());
			expect(target.textContent).toContain(
				stage === 'plans' ? 'Failed to load subscription plans' : 'Failed to load subscription'
			);
			expect(target.textContent).not.toContain('No subscription plans available');
			expect(target.textContent).not.toContain('Subscribe');
			expect(trackEvent).not.toHaveBeenCalledWith('billing_plans_view', { status: 'empty' });
			// A second failed attempt must remain a visible error, never an empty catalogue.
			vi.mocked(request).mockRejectedValueOnce({ status: 503 });
			target.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
			await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
			await vi.waitFor(() => expect(target.querySelector('[role="alert"]')).not.toBeNull());
			expect(target.textContent).not.toContain('No subscription plans available');
			target.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
			await vi.waitFor(() => expect(target.textContent).toContain('Русский тариф'));
			expect(target.querySelector('[role="alert"]')).toBeNull();
			expect(trackEvent).toHaveBeenCalledWith('billing_plans_view', { status: 'loaded' });
			expect(api.createPayment).not.toHaveBeenCalled();
			expect(api.resumeSubscription).not.toHaveBeenCalled();
		} finally {
			await unmount(component);
		}
	}
);

it('shows empty only after both requests succeed with no plans', async () => {
	vi.mocked(api.getPlans).mockResolvedValueOnce([]);
	const target = document.createElement('div');
	const component = mount(Plans, { target, context: context() });
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('No subscription plans available'));
		expect(target.querySelector('[role="alert"]')).toBeNull();
		expect(trackEvent).toHaveBeenCalledWith('billing_plans_view', { status: 'empty' });
	} finally {
		await unmount(component);
	}
});

it('keeps subscriptions disabled without fetching plans or creating a payment', async () => {
	subscriptionConfig.set({ features: { enable_billing_subscriptions: false } });
	const target = document.createElement('div');
	const component = mount(Plans, { target, context: context() });
	try {
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/billing/dashboard'));
		expect(api.getPlans).not.toHaveBeenCalled();
		expect(api.getMySubscription).not.toHaveBeenCalled();
		expect(api.createPayment).not.toHaveBeenCalled();
		expect(api.resumeSubscription).not.toHaveBeenCalled();
	} finally {
		await unmount(component);
	}
});

it('switches plan language and currency formatting without a reload or currency conversion', async () => {
	const i18n = createInstance();
	await i18n.init({ lng: 'ru-RU', resources: {}, initImmediate: false });
	const language = writable(i18n);
	const target = document.createElement('div');
	const component = mount(Plans, { target, context: new Map([['i18n', language]]) });
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('Русский тариф'));
		expect(target.textContent).toContain('Русское описание');
		expect(target.textContent).toContain(
			new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(1234.56)
		);
		await i18n.changeLanguage('en-US');
		language.set(i18n);
		await tick();
		expect(target.textContent).toContain('English plan');
		expect(target.textContent).toContain('English description');
		expect(target.textContent).not.toContain('Русский тариф');
		expect(target.textContent).toContain(
			new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RUB' }).format(1234.56)
		);
	} finally {
		await unmount(component);
	}
});
