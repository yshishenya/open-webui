// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import EditPlan from './+page.svelte';
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
	updatePlan: vi.fn().mockResolvedValue(null)
}));
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
