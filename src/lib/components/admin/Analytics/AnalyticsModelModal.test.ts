// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClassComponent } from 'svelte/legacy';
import { tick } from 'svelte';
import { readable } from 'svelte/store';
import AnalyticsModelModal from './AnalyticsModelModal.svelte';

const api = vi.hoisted(() => ({ overview: vi.fn(), chats: vi.fn() }));
vi.mock('$lib/apis/analytics', () => ({
	getModelOverview: api.overview,
	getModelChats: api.chats
}));
vi.mock('$lib/stores', async () => {
	const { readable } = await import('svelte/store');
	return { config: readable({ features: { enable_admin_chat_access: true } }) };
});
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({
		activate: vi.fn(),
		deactivate: vi.fn(),
		pause: vi.fn(),
		unpause: vi.fn()
	})
}));

const chat = (id: string) => ({ chat_id: id, first_message: id, updated_at: 100 });

describe('AnalyticsModelModal report context', () => {
	let mounted: ReturnType<typeof createClassComponent> | null = null;
	let intersect: (() => void) | null = null;
	beforeEach(() => {
		vi.resetAllMocks();
		document.body.innerHTML = '';
		localStorage.token = 'test-token';
		api.overview.mockResolvedValue({ history: [], tags: [] });
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
					intersect = () => callback([{ isIntersecting: true }]);
				}
				observe(): void {}
				disconnect(): void {}
			}
		);
	});
	afterEach(() => {
		mounted?.$destroy();
		mounted = null;
		document.body.innerHTML = '';
		vi.unstubAllGlobals();
	});
	async function clickChats(): Promise<void> {
		await tick();
		const button = [...document.querySelectorAll('button')].find(
			(node) => node.textContent?.trim() === 'Chats'
		);
		expect(button).toBeTruthy();
		button?.click();
		await tick();
	}
	it('reloads the same model for new dates/group, resets pagination and advances by raw rows despite duplicates', async () => {
		api.chats.mockImplementation(
			async (_token: string, _model: string, from: number, _to: number, skip: number) => {
				if (from === 100) {
					if (skip === 0)
						return { chats: Array.from({ length: 50 }, (_, i) => chat(`old-${i}`)), total: 101 };
					if (skip === 50)
						return {
							chats: [chat('old-49'), ...Array.from({ length: 49 }, (_, i) => chat(`older-${i}`))],
							total: 101
						};
					return { chats: [chat('old-final')], total: 101 };
				}
				return { chats: [chat('new-context')], total: 1 };
			}
		);
		const target = document.createElement('div');
		document.body.appendChild(target);
		const model = { id: 'same-model', name: 'Same model' };
		mounted = createClassComponent({
			component: AnalyticsModelModal,
			target,
			context: new Map([['i18n', readable({ t: (key: string) => key })]]),
			props: { show: true, model, startDate: 100, endDate: 200, groupId: 'old-group' }
		});
		await vi.waitFor(() =>
			expect(api.overview).toHaveBeenCalledWith(
				'test-token',
				'same-model',
				0,
				100,
				200,
				'old-group'
			)
		);
		await clickChats();
		await vi.waitFor(() => expect(document.querySelectorAll('a[href^="/s/"]')).toHaveLength(50));
		intersect?.();
		await vi.waitFor(() => expect(document.querySelectorAll('a[href^="/s/"]')).toHaveLength(100));
		expect(api.chats.mock.calls.map((call) => call[4])).toEqual([0, 50, 100]);
		expect(document.querySelectorAll('a[href="/s/old-49"]')).toHaveLength(1);
		mounted.$set({ startDate: 300, endDate: 400, groupId: 'new-group' });
		await vi.waitFor(() =>
			expect(api.overview).toHaveBeenCalledWith(
				'test-token',
				'same-model',
				0,
				300,
				400,
				'new-group'
			)
		);
		await clickChats();
		await vi.waitFor(() => expect(document.querySelectorAll('a[href^="/s/"]')).toHaveLength(1));
		expect(document.querySelector('a[href="/s/new-context"]')).toBeTruthy();
		expect(document.querySelector('a[href="/s/old-49"]')).toBeNull();
		expect(api.chats).toHaveBeenLastCalledWith(
			'test-token',
			'same-model',
			300,
			400,
			0,
			50,
			'updated_at',
			'desc',
			'new-group'
		);
	});
	it('ignores an old overview response after a new period has loaded', async () => {
		let finishOld!: (value: { history: []; tags: { tag: string; count: number }[] }) => void;
		api.overview.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishOld = resolve;
				})
		);
		api.overview.mockResolvedValue({ history: [], tags: [{ tag: 'Current period', count: 1 }] });
		const target = document.createElement('div');
		document.body.appendChild(target);
		mounted = createClassComponent({
			component: AnalyticsModelModal,
			target,
			props: { show: true, model: { id: 'demo', name: 'demo' }, startDate: 100, endDate: 200 },
			context: new Map([['i18n', readable({ t: (text: string) => text })]])
		});
		await vi.waitFor(() => expect(api.overview).toHaveBeenCalledOnce());
		mounted.$set({ startDate: 300, endDate: 400 });
		await vi.waitFor(() => expect(document.body.textContent).toContain('Current period'));
		finishOld({ history: [], tags: [{ tag: 'Old period', count: 99 }] });
		await tick();
		expect(document.body.textContent).not.toContain('Old period');
	});
});
