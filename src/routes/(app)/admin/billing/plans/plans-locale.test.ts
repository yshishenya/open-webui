// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { createInstance, type i18n as I18n } from 'i18next';
import { mount, tick, unmount, type ComponentProps } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import type { Plan, PlanStats, PlanSubscriber } from '$lib/apis/admin/billing';
import * as api from '$lib/apis/admin/billing';
import { goto } from '$app/navigation';
import PlanForm from '$lib/components/admin/billing/PlanForm.svelte';
import Plans from './+page.svelte';
import NewPlan from './new/+page.svelte';
import Analytics from './[id]/analytics/+page.svelte';
import Subscribers from './[id]/subscribers/+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			url: new URL('https://example/admin/billing/plans/localized/subscribers'),
			params: { id: 'localized' }
		})
	};
});
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		WEBUI_NAME: writable('Airis'),
		user: writable({ role: 'admin' }),
		settings: writable({}),
		config: writable({ features: { enable_billing_subscriptions: true } })
	};
});
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('$lib/apis/admin/billing', () => ({
	getPlan: vi.fn(),
	getPlansWithStats: vi.fn(),
	getPlanSubscribers: vi.fn(),
	createPlan: vi.fn(),
	deletePlan: vi.fn(),
	togglePlanActive: vi.fn(),
	duplicatePlan: vi.fn()
}));

const plan: Plan = {
	id: 'localized',
	name: 'English plan',
	name_ru: 'Русский тариф',
	description: 'English description',
	description_ru: 'Русское описание',
	price: 1234.56,
	currency: 'USD',
	interval: 'month',
	quotas: { tokens_input: 12345, tokens_output: 23456, requests: 34567 },
	features: [],
	is_active: true,
	display_order: 0,
	created_at: 1,
	updated_at: 1
};
const stats: PlanStats = {
	plan,
	active_subscriptions: 1234,
	canceled_subscriptions: 12,
	total_subscriptions: 1246,
	mrr: 1234.56
};
const subscriber: PlanSubscriber = {
	user_id: 'customer',
	name: 'Customer',
	email: 'customer@example.test',
	role: 'user',
	subscription_status: 'active',
	subscribed_at: 1790812800,
	current_period_start: 1790812800,
	current_period_end: 1793491200,
	tokens_input_used: 1234,
	tokens_input_limit: 12345,
	tokens_output_used: 2345,
	requests_used: 12,
	requests_limit: 1000
};
const languageContext = async (): Promise<{
	context: Map<string, Writable<I18n>>;
	change: (locale: string) => Promise<void>;
}> => {
	const selected = createInstance();
	await selected.init({
		lng: 'ru-RU',
		fallbackLng: 'en-US',
		resources: {
			'en-US': { translation: { month: 'month', mo: 'mo', Unlimited: 'Unlimited' } },
			'ru-RU': { translation: { month: 'месяц', mo: 'мес.', Unlimited: 'Без ограничений' } }
		}
	});
	const language = writable(selected);
	return {
		context: new Map([['i18n', language]]),
		change: async (locale: string): Promise<void> => {
			await selected.changeLanguage(locale);
			language.set(selected);
			await tick();
		}
	};
};
const money = (locale: string, rounded = false): string =>
	new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: 'USD',
		...(rounded ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {})
	}).format(plan.price);

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(api.getPlan).mockResolvedValue(plan);
	vi.mocked(api.getPlansWithStats).mockResolvedValue([stats]);
	vi.mocked(api.getPlanSubscribers).mockResolvedValue({
		items: [subscriber],
		total: 1,
		page: 1,
		page_size: 20,
		total_pages: 1
	});
});

it.each([
	{ name: 'list', Page: Plans },
	{ name: 'analytics', Page: Analytics },
	{ name: 'subscribers', Page: Subscribers }
])(
	'switches $name plan display and formatting without refetching or changing currency',
	async ({ Page }) => {
		const { context, change } = await languageContext();
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(Page, { target, context });
		try {
			await vi.waitFor(() => expect(target.textContent).toContain('Русский тариф'));
			const calls =
				vi.mocked(api.getPlansWithStats).mock.calls.length +
				vi.mocked(api.getPlan).mock.calls.length;
			if (Page === Subscribers) {
				expect(target.textContent).toContain('1\u00a0234 / 12\u00a0345');
				expect(target.textContent).toContain('Без ограничений');
			} else expect(target.textContent).toContain(money('ru-RU', Page === Plans));
			await change('en-US');
			expect(target.textContent).toContain('English plan');
			expect(target.textContent).not.toContain('Русский тариф');
			if (Page === Plans) expect(target.textContent).toContain('English description');
			if (Page === Subscribers) {
				expect(target.textContent).toContain('1,234 / 12,345');
				expect(target.textContent).toContain('Unlimited');
				expect(target.textContent).toContain(
					new Date(subscriber.subscribed_at * 1000).toLocaleString('en-US', { timeZone: 'UTC' })
				);
			} else expect(target.textContent).toContain(money('en-US', Page === Plans));
			// A missing UI language uses the loaded English fallback, not French number/date conventions.
			await change('fr-FR');
			expect(target.textContent).toContain('English plan');
			if (Page === Subscribers) expect(target.textContent).toContain('1,234 / 12,345');
			else expect(target.textContent).toContain(money('en-US', Page === Plans));
			await change('ru-RU');
			expect(target.textContent).toContain('Русский тариф');
			expect(
				vi.mocked(api.getPlansWithStats).mock.calls.length +
					vi.mocked(api.getPlan).mock.calls.length
			).toBe(calls);
			expect(api.getPlanSubscribers).toHaveBeenCalledTimes(Page === Subscribers ? 1 : 0);
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);

it('switches PlanForm preview and keeps the other-language fallback and form values', async () => {
	const { context, change } = await languageContext();
	const formData: ComponentProps<typeof PlanForm>['formData'] = {
		name: plan.name,
		name_ru: plan.name_ru || '',
		description: plan.description || '',
		description_ru: plan.description_ru || '',
		price: plan.price,
		currency: plan.currency,
		interval: plan.interval,
		quotas: { tokens_input: 12345, tokens_output: 23456, requests: 34567 },
		features: [],
		is_active: true,
		display_order: 0
	};
	const target = document.createElement('div');
	const component = mount(PlanForm, { target, context, props: { formData } });
	try {
		await tick();
		expect(target.textContent).toContain('Русский тариф');
		expect(target.textContent).toContain(money('ru-RU'));
		await change('en-US');
		expect(target.textContent).toContain('English plan');
		expect(target.textContent).toContain('English description');
		expect(target.textContent).toContain(money('en-US'));
		expect(target.textContent).toContain('/month');
		const name = target.querySelector<HTMLInputElement>('#plan-form-name')!;
		expect(name.value).toBe('English plan');
		name.value = '';
		name.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(target.textContent).toContain('Русский тариф');
		expect(target.querySelector<HTMLInputElement>('#plan-form-name_ru')!.value).toBe(
			'Русский тариф'
		);
		expect(api.createPlan).not.toHaveBeenCalled();
	} finally {
		await unmount(component);
	}
});

it('switches the new-plan preview without replacing the entered bilingual fields', async () => {
	const { context, change } = await languageContext();
	const target = document.createElement('div');
	const component = mount(NewPlan, { target, context });
	try {
		await tick();
		for (const [selector, value] of [
			['input[placeholder="Name (Russian)"]', 'Русский тариф'],
			['#plan-new-name_ru', 'English plan'],
			['input[placeholder="Description (English)"]', 'English description'],
			['#plan-new-description_ru', 'Русское описание']
		]) {
			const input = target.querySelector<HTMLInputElement>(selector)!;
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
		await tick();
		expect(target.textContent).toContain('Русский тариф');
		expect(target.textContent).toContain('Русское описание');
		await change('en-US');
		expect(target.textContent).toContain('English plan');
		expect(target.textContent).toContain('English description');
		expect(target.textContent).not.toContain('Русское описание');
		expect(target.querySelector<HTMLInputElement>('#plan-new-name_ru')!.value).toBe('English plan');
		await change('ru-RU');
		expect(target.textContent).toContain('Русский тариф');
		expect(api.createPlan).not.toHaveBeenCalled();
	} finally {
		await unmount(component);
	}
});

it('keeps mobile plan titles above distinct named actions and updates labels with the locale', async () => {
	vi.mocked(api.getPlansWithStats).mockResolvedValueOnce([
		stats,
		{ ...stats, plan: { ...plan, id: 'same-name' } },
		{ ...stats, plan: { ...plan, id: 'fallback-id', name: '', name_ru: '' } }
	]);
	const { context, change } = await languageContext();
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Plans, { target, context });
	try {
		await vi.waitFor(() => expect(target.querySelectorAll('[role="switch"]')).toHaveLength(3));
		expect(target.querySelector('button[aria-label="New Plan"]')).not.toBeNull();
		const search = target.querySelector<HTMLInputElement>('input[aria-label="Search Plans"]')!;
		expect(search).not.toBeNull();
		for (const [id, name] of [
			['localized', 'Русский тариф'],
			['same-name', 'Русский тариф'],
			['fallback-id', 'fallback-id']
		]) {
			const link = target.querySelector<HTMLAnchorElement>(
				`a[href="/admin/billing/plans/${id}/edit"]`
			)!;
			expect(link.getAttribute('aria-label')).toBe(`Edit Plan: ${name} (${id})`);
			expect(link.classList.contains('min-w-0')).toBe(true);
			expect(link.parentElement!.classList.contains('flex-col')).toBe(true);
			const title = link.querySelector('.whitespace-normal')!;
			expect(title.textContent?.trim()).toBe(name);
			expect(title.classList.contains('[overflow-wrap:anywhere]')).toBe(true);
			expect(title.classList.contains('line-clamp-1')).toBe(false);
			for (const action of ['Delete', 'Subscribers', 'Analytics', 'Duplicate', 'Active']) {
				expect(target.querySelector(`[aria-label="${action}: ${name} (${id})"]`)).not.toBeNull();
			}
		}
		search.value = 'fallback-id';
		search.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(target.querySelectorAll('[role="switch"]')).toHaveLength(1);
		target.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')!.click();
		await tick();
		expect(search.value).toBe('');
		expect(target.querySelectorAll('[role="switch"]')).toHaveLength(3);
		await change('en-US');
		expect(target.querySelector('[aria-label="Active: English plan (localized)"]')).not.toBeNull();
		expect(target.querySelector('[aria-label="Active: Русский тариф (localized)"]')).toBeNull();
		target
			.querySelector<HTMLButtonElement>(
				'button[aria-label="Subscribers: English plan (same-name)"]'
			)!
			.click();
		expect(goto).toHaveBeenCalledWith('/admin/billing/plans/same-name/subscribers');
		target
			.querySelector<HTMLButtonElement>(
				'[role="switch"][aria-label="Active: English plan (same-name)"]'
			)!
			.click();
		await vi.waitFor(() =>
			expect(api.togglePlanActive).toHaveBeenCalledWith(undefined, 'same-name')
		);
		expect(api.deletePlan).not.toHaveBeenCalled();
		expect(api.duplicatePlan).not.toHaveBeenCalled();
	} finally {
		await unmount(component);
		target.remove();
	}
});
