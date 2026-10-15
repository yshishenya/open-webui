// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import EditPlan from './+page.svelte';
import NewPlan from '../../new/+page.svelte';
import * as api from '$lib/apis/admin/billing';
import { goto } from '$app/navigation';
import { toast } from 'svelte-sonner';
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			url: new URL('https://example/admin/billing/plans/first/edit'),
			params: { id: 'first' }
		})
	};
});
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		user: writable({ role: 'admin' }),
		WEBUI_NAME: writable('Airis'),
		settings: writable({})
	};
});
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('$lib/apis/admin/billing', () => ({
	getPlan: vi.fn(async (_token: string, id: string) => ({
		id,
		name: 'Plan ' + id,
		name_ru: 'Тариф ' + id,
		description: '',
		description_ru: '',
		currency: 'RUB',
		price: 10,
		interval: 'monthly',
		is_active: true,
		display_order: 0,
		plan_extra_metadata: {},
		quotas: { tokens_input: 100, tokens_output: 100, requests: 10 },
		features: []
	})),
	getPlansWithStats: vi
		.fn()
		.mockResolvedValue(
			['first', 'second'].map((id) => ({ plan: { id }, active_subscriptions: 0 }))
		),
	getPlanSubscribers: vi.fn().mockResolvedValue({ items: [], total: 0, total_pages: 1 }),
	updatePlan: vi.fn().mockResolvedValue(null),
	createPlan: vi.fn().mockResolvedValue(null)
}));
beforeEach(async () => {
	vi.clearAllMocks();
	const { page } = await import('$app/stores');
	(page as unknown as Writable<{ url: URL; params: { id: string } }>).set({
		url: new URL('https://example/admin/billing/plans/first/edit'),
		params: { id: 'first' }
	});
});

const context = () =>
	new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]]);
const submit = (target: HTMLElement): void => {
	target
		.querySelector('form')!
		.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

it.each([EditPlan, NewPlan])(
	'saves explicit unlimited quotas once after confirmed acceptance',
	async (Page) => {
		const plan = await api.getPlan('', 'first');
		const save = Page === EditPlan ? vi.mocked(api.updatePlan) : vi.mocked(api.createPlan);
		save.mockResolvedValueOnce(plan);
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(Page, { target, context: context() });
		try {
			await vi.waitFor(() => expect(target.querySelector('form')).not.toBeNull());
			const name = target.querySelector<HTMLInputElement>('input[placeholder="Name (Russian)"]')!;
			name.value = 'Тариф';
			name.dispatchEvent(new Event('input', { bubbles: true }));
			for (const checkbox of target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
				checkbox.checked = true;
				checkbox.dispatchEvent(new Event('change', { bubbles: true }));
			}
			await tick();
			submit(target);
			await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
			expect(save).toHaveBeenCalledTimes(1);
			const args = vi.mocked(save).mock.calls[0];
			expect(args[args.length - 1]).toEqual(
				expect.objectContaining({
					quotas: { tokens_input: null, tokens_output: null, requests: null }
				})
			);
			expect(goto).toHaveBeenCalledWith('/admin/billing/plans');
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);

it('blocks quota decreases when active subscribers exist', async () => {
	vi.mocked(api.getPlansWithStats).mockResolvedValueOnce([
		{
			plan: await api.getPlan('', 'first'),
			active_subscriptions: 1,
			canceled_subscriptions: 0,
			total_subscriptions: 1,
			mrr: 10
		}
	]);
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(EditPlan, { target, context: context() });
	try {
		await vi.waitFor(() => expect(target.querySelector('form')).not.toBeNull());
		const quota = target.querySelector<HTMLInputElement>('input[id$="-quotas-requests"]')!;
		quota.value = '9';
		quota.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		submit(target);
		await tick();
		expect(api.updatePlan).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith(
			'Cannot decrease quotas while plan has active subscriptions'
		);
	} finally {
		await unmount(component);
		target.remove();
	}
});

it('opens unlimited legacy quotas even when active subscribers exist', async () => {
	const plan = { ...(await api.getPlan('', 'first')), quotas: null, features: null };
	vi.mocked(api.getPlan).mockResolvedValueOnce(plan);
	vi.mocked(api.getPlansWithStats).mockResolvedValueOnce([
		{ plan, active_subscriptions: 1, canceled_subscriptions: 0, total_subscriptions: 1, mrr: 0 }
	]);
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(EditPlan, { target, context: context() });
	try {
		await vi.waitFor(() => expect(target.querySelector('form')).not.toBeNull());
		submit(target);
		await vi.waitFor(() =>
			expect(api.updatePlan).toHaveBeenCalledWith(
				undefined,
				'first',
				expect.objectContaining({
					quotas: { tokens_input: null, tokens_output: null, requests: null }
				})
			)
		);
	} finally {
		await unmount(component);
		target.remove();
	}
});

it.each([null, undefined])(
	'opens nullable fields and preserves unlimited quotas (%s)',
	async (empty) => {
		const plan = await api.getPlan('', 'first');
		vi.mocked(api.getPlan).mockResolvedValueOnce({ ...plan, features: empty, quotas: empty });
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(EditPlan, { target, context: context() });
		try {
			await vi.waitFor(() => expect(target.querySelector('form')).not.toBeNull());
			expect(target.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(4);
			submit(target);
			await vi.waitFor(() =>
				expect(api.updatePlan).toHaveBeenCalledWith(
					undefined,
					'first',
					expect.objectContaining({
						features: [],
						quotas: { tokens_input: null, tokens_output: null, requests: null }
					})
				)
			);
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);

it('keeps extra quota keys and interprets missing limits as unlimited', async () => {
	const plan = await api.getPlan('', 'first');
	vi.mocked(api.getPlan).mockResolvedValueOnce({ ...plan, quotas: { requests: 10, images: 0 } });
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(EditPlan, { target, context: context() });
	try {
		await vi.waitFor(() => expect(target.querySelector('form')).not.toBeNull());
		submit(target);
		await vi.waitFor(() =>
			expect(api.updatePlan).toHaveBeenCalledWith(
				undefined,
				'first',
				expect.objectContaining({
					quotas: { tokens_input: null, tokens_output: null, requests: 10, images: 0 }
				})
			)
		);
	} finally {
		await unmount(component);
		target.remove();
	}
});

it.each([EditPlan, NewPlan])(
	'preserves draft and prevents concurrent writes on refusal',
	async (Page) => {
		const save = Page === EditPlan ? vi.mocked(api.updatePlan) : vi.mocked(api.createPlan);
		let refuse!: (reason: Error) => void;
		save.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					refuse = reject;
				})
		);
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(Page, { target, context: context() });
		try {
			await vi.waitFor(() => expect(target.querySelector('form')).not.toBeNull());
			const name = target.querySelector<HTMLInputElement>('input[placeholder="Name (Russian)"]')!;
			name.value = 'Мой тариф';
			name.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			submit(target);
			submit(target);
			await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
			refuse(new Error('Save refused'));
			await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
			expect(name.value).toBe('Мой тариф');
			expect(goto).not.toHaveBeenCalled();
			expect(target.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
				false
			);
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);

it.each([EditPlan, NewPlan])(
	'rejects empty price and fractional quotas before a write',
	async (Page) => {
		const save = Page === EditPlan ? api.updatePlan : api.createPlan;
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(Page, { target, context: context() });
		try {
			await vi.waitFor(() => expect(target.querySelector('form')).not.toBeNull());
			const name = target.querySelector<HTMLInputElement>('input[placeholder="Name (Russian)"]')!;
			name.value = 'Мой тариф';
			name.dispatchEvent(new Event('input', { bubbles: true }));
			const price = target.querySelector<HTMLInputElement>('input[id$="-price"]')!;
			price.value = '';
			price.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			submit(target);
			await tick();
			expect(save).not.toHaveBeenCalled();
			price.value = '10';
			price.dispatchEvent(new Event('input', { bubbles: true }));
			const quota = target.querySelector<HTMLInputElement>('input[id$="-quotas-requests"]')!;
			quota.value = '1.5';
			quota.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			submit(target);
			await tick();
			expect(save).not.toHaveBeenCalled();
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);
it('replaces the editable plan and saves the current identity after route reuse', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(EditPlan, {
		target,
		context: new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() =>
			expect(
				target.querySelector<HTMLInputElement>('input[placeholder="Name (Russian)"]')?.value
			).toBe('Тариф first')
		);
		const { page } = await import('$app/stores');
		(page as unknown as Writable<{ url: URL; params: { id: string } }>).set({
			url: new URL('https://example/admin/billing/plans/second/edit'),
			params: { id: 'second' }
		});
		await tick();
		await vi.waitFor(() =>
			expect(
				target.querySelector<HTMLInputElement>('input[placeholder="Name (Russian)"]')?.value
			).toBe('Тариф second')
		);
		target
			.querySelector('form')!
			.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		const api = await import('$lib/apis/admin/billing');
		await vi.waitFor(() =>
			expect(api.updatePlan).toHaveBeenCalledWith(
				undefined,
				'second',
				expect.objectContaining({ name: 'Plan second', name_ru: 'Тариф second' })
			)
		);
	} finally {
		await unmount(component);
		target.remove();
	}
});
