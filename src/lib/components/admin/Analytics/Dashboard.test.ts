// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { readable } from 'svelte/store';
import Dashboard from './Dashboard.svelte';

vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return { page: writable({ url: new URL('http://localhost/admin/analytics/models') }) };
});
vi.mock('$lib/stores', async () => {
	const { readable } = await import('svelte/store');
	return {
		models: readable([
			{ id: 'a', name: 'Модель А' },
			{ id: 'b', name: 'Модель Б' }
		]),
		config: readable({ features: { enable_admin_chat_access: false } })
	};
});
vi.mock('$lib/apis/groups', () => ({ getGroups: vi.fn().mockResolvedValue([]) }));
vi.mock('$lib/apis/analytics', () => ({
	getSummary: vi
		.fn()
		.mockResolvedValue({ total_messages: 5, total_chats: 2, total_models: 2, total_users: 1 }),
	getModelAnalytics: vi.fn().mockResolvedValue({
		models: ['a', 'b'].map((model_id, i) => ({
			model_id,
			count: i + 2,
			unique_users: 1,
			unique_chats: 1
		}))
	}),
	getUserAnalytics: vi.fn().mockResolvedValue({ users: [] }),
	getDailyStats: vi
		.fn()
		.mockResolvedValue({ data: [{ date: '2026-10-03', models: { a: 2, b: 3 } }] }),
	getTokenUsage: vi.fn().mockResolvedValue({ models: [], total_tokens: 0 }),
	getModelOverview: vi.fn(),
	getModelChats: vi.fn()
}));

it('provides every model series and the daily total in the graph table', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const mounted = mount(Dashboard, {
		target,
		context: new Map([['i18n', readable({ t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() =>
			expect(target.querySelector('caption')?.textContent).toBe(
				'Сохранённые ответы по датам и моделям'
			)
		);
		const table = target.querySelector('caption')?.closest('table');
		const rows = Array.from(table?.querySelectorAll('tbody tr') || []).map((row) =>
			Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim())
		);
		expect(rows).toEqual([
			['2026-10-03', 'Модель А', '2'],
			['2026-10-03', 'Модель Б', '3'],
			['2026-10-03', 'Все модели', '5']
		]);
		expect(table?.querySelectorAll('th[scope="col"]')).toHaveLength(3);
	} finally {
		await unmount(mounted);
		target.remove();
	}
});
