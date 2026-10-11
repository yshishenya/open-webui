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
