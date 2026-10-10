// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, expect, it, vi } from 'vitest';
import Feedbacks from '$lib/components/admin/Evaluations/Feedbacks.svelte';
import FeedbackModal from '$lib/components/admin/Evaluations/FeedbackModal.svelte';
import { getFeedbackItems, getFeedbackById } from '$lib/apis/evaluations';
import { adminFeedbackCount } from '$lib/stores';
import { get } from 'svelte/store';
vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
});
vi.mock('$lib/apis/evaluations', () => ({
	getFeedbackItems: vi.fn(),
	getFeedbackById: vi.fn(),
	getFeedbackModelIds: async () => [],
	exportAllFeedbacks: vi.fn(),
	deleteFeedbackById: vi.fn()
}));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({ activate() {}, deactivate() {}, pause() {}, unpause() {} })
}));
afterEach(() => {
	vi.clearAllMocks();
});
const feedback = {
	id: 'feedback',
	user_id: 'user',
	created_at: 1,
	updated_at: 2,
	data: { rating: 0, comment: '<b>literal</b>' },
	meta: { chat_id: 'chat', message_id: 'reply' },
	snapshot: null,
	user: null
};
async function context(): Promise<Map<string, object>> {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	return new Map([['i18n', writable(i18n)]]);
}
it('renders numeric Draw, fixed table cells, nullable user and real username sort', async () => {
	vi.mocked(getFeedbackItems).mockResolvedValue({
		items: [feedback, { ...feedback, id: 'empty', data: null }],
		total: 2
	});
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Feedbacks, { target, context: await context() });
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('Draw'));
		expect(
			[...target.querySelectorAll('tbody tr')].map((row) => row.querySelectorAll('td').length)
		).toEqual([5, 5]);
		const header = [...target.querySelectorAll('th')].find((el) =>
			el.textContent?.includes('User')
		);
		header?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await tick();
		await vi.waitFor(() =>
			expect(vi.mocked(getFeedbackItems).mock.calls.at(-1)?.[1]).toBe('username')
		);
	} finally {
		await unmount(component);
		target.remove();
	}
});
it('cancels the real list on unmount and ignores its late shared-count update', async () => {
	let resolve: ((value: { items: (typeof feedback)[]; total: number }) => void) | undefined;
	vi.mocked(getFeedbackItems).mockImplementationOnce(
		() =>
			new Promise((done) => {
				resolve = done;
			})
	);
	adminFeedbackCount.set(7);
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Feedbacks, { target, context: await context() });
	await tick();
	const signal = vi.mocked(getFeedbackItems).mock.calls[0][5];
	await unmount(component);
	expect(signal?.aborted).toBe(true);
	resolve?.({ items: [feedback], total: 9 });
	await tick();
	await tick();
	expect(get(adminFeedbackCount)).toBe(7);
	target.remove();
});
it.each([
	null,
	{ chat: {} },
	{
		chat: {
			chat: {
				history: {
					messages: {
						prompt: {
							id: 'prompt',
							parentId: null,
							childrenIds: ['reply'],
							role: 'user',
							content: '<b>prompt</b>'
						},
						reply: {
							id: 'reply',
							parentId: 'prompt',
							childrenIds: [],
							role: 'assistant',
							content: '<b>answer</b>'
						}
					}
				}
			}
		}
	}
])(
	'opens nullable/partial/full snapshots without interpreting private text as HTML',
	async (snapshot) => {
		vi.mocked(getFeedbackById).mockResolvedValue({ ...feedback, snapshot });
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(FeedbackModal, {
			target,
			context: await context(),
			props: { show: true, selectedFeedback: feedback }
		});
		try {
			await vi.waitFor(() =>
				expect(document.querySelector('[role="dialog"]')?.textContent).toContain('<b>literal</b>')
			);
			expect(document.querySelector('[role="dialog"] b')).toBeNull();
			expect(document.querySelector('[role="dialog"] a')?.getAttribute('href')).toBe('/s/chat');
			if (snapshot?.chat && 'chat' in snapshot.chat)
				expect(document.querySelector('[role="dialog"]')?.textContent).toContain('<b>answer</b>');
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);
