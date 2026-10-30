// @vitest-environment jsdom
import { get } from 'svelte/store';
import { beforeEach, expect, it, vi } from 'vitest';
import { getChatList, getPinnedChatList } from '$lib/apis/chats';
import {
	chats,
	pinnedChats,
	refreshChatList,
	loadNextChatListPage,
	resetChatListState
} from './chatList';
vi.mock('$lib/apis/chats', () => ({ getChatList: vi.fn(), getPinnedChatList: vi.fn() }));
const row = (id: string) => ({ id, title: id, created_at: 1, updated_at: 1, time_range: 'Today' });
beforeEach(() => {
	vi.resetAllMocks();
	resetChatListState();
	localStorage.token = 'original-session';
	vi.mocked(getChatList).mockResolvedValue([row('retained')]);
	vi.mocked(getPinnedChatList).mockResolvedValue([row('retained-pinned')]);
});
it.each(['refresh', 'page'])(
	'rejects late %s data after the login session changes and accepts the next refresh',
	async (mode) => {
		await refreshChatList(localStorage.token, { refreshPinned: true });
		let resolve!: (rows: Awaited<ReturnType<typeof getChatList>>) => void;
		const response = new Promise<Awaited<ReturnType<typeof getChatList>>>((done) => {
			resolve = done;
		});
		vi.mocked(getChatList).mockImplementationOnce(() => response);
		vi.mocked(getPinnedChatList).mockResolvedValueOnce([row('old-session-pinned')]);
		const pending =
			mode === 'refresh'
				? refreshChatList(localStorage.token, { refreshPinned: true })
				: loadNextChatListPage(localStorage.token);
		localStorage.token = 'new-session';
		resolve([row('old-session-private')]);
		expect((await pending).accepted).toBe(false);
		expect(get(chats)?.map((chat) => chat.id)).toEqual(['retained']);
		expect(get(pinnedChats).map((chat) => chat.id)).toEqual(['retained-pinned']);
		vi.mocked(getChatList).mockResolvedValueOnce([row('new-session')]);
		expect((await refreshChatList(localStorage.token, { refreshPinned: true })).accepted).toBe(
			true
		);
		expect(get(chats)?.map((chat) => chat.id)).toEqual(['new-session']);
	}
);

it('a superseded refresh is rejected while the newer accepted refresh owns published rows', async () => {
	let finishOld!: (rows: Awaited<ReturnType<typeof getChatList>>) => void;
	vi.mocked(getChatList).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finishOld = resolve;
			})
	);
	const old = refreshChatList(localStorage.token, { refreshPinned: true });
	vi.mocked(getChatList).mockResolvedValueOnce([row('current')]);
	expect((await refreshChatList(localStorage.token)).accepted).toBe(true);
	finishOld([row('stale')]);
	expect((await old).accepted).toBe(false);
	expect(get(chats)?.map((chat) => chat.id)).toEqual(['current']);
});
it('retries failed first and next pages without publishing empty rows or skipping a page', async () => {
	vi.mocked(getChatList)
		.mockRejectedValueOnce(new Error('503'))
		.mockResolvedValueOnce([row('retained')])
		.mockRejectedValueOnce(new Error('503'))
		.mockResolvedValueOnce([row('retained'), row('next')])
		.mockResolvedValueOnce([]);
	await expect(refreshChatList(localStorage.token)).rejects.toThrow('503');
	expect(get(chats)).toBeNull();
	await refreshChatList(localStorage.token);
	await expect(loadNextChatListPage(localStorage.token)).rejects.toThrow('503');
	expect(get(chats)?.map((chat) => chat.id)).toEqual(['retained']);
	await loadNextChatListPage(localStorage.token);
	expect(get(chats)?.map((chat) => chat.id)).toEqual(['retained', 'next']);
	expect((await loadNextChatListPage(localStorage.token)).allLoaded).toBe(true);
	expect(vi.mocked(getChatList).mock.calls.map((call) => call[1])).toEqual([1, 1, 2, 2, 3]);
});
