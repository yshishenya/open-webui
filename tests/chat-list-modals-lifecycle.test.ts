// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { getErrorMessage } from '$lib/utils/airis/error_message';

const row = (id: string) => ({ id, title: id, updated_at: 2, time_range: 'Today' });
type Rows = ReturnType<typeof row>[];
const load = (kind: 'shared' | 'user') => {
	const file =
		kind === 'shared'
			? 'src/lib/components/layout/SharedChatsModal.svelte'
			: 'src/lib/components/admin/Users/UserList/UserChatsModal.svelte';
	const source = readFileSync(file, 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing component script');
	const ast = ts.createSourceFile(
		'modal.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const script = ast.statements
		.filter((node) => !ts.isImportDeclaration(node) && !ts.isLabeledStatement(node))
		.map((node) => node.getText(ast).replace(/^export /, ''))
		.join('\n');
	const requests: { resolve: (value: Rows) => void; reject: (error: unknown) => void }[] = [];
	const list = vi.fn<unknown[], Promise<Rows>>(
		() =>
			new Promise<Rows>((resolve, reject) => {
				requests.push({ resolve, reject });
			})
	);
	const errors = vi.fn();
	const destroys: (() => void)[] = [];
	const update = vi.fn();
	const code = ts.transpileModule(
		`(() => { ${kind === 'shared' ? 'let user;' : ''} ${script}; show = true; user = {id:'one',name:'First'}; onUpdate = update; filter = {order_by:orderBy,direction};
	return { refresh: searchHandler, more: loadMoreChats, retry: retryHandler,
	state: () => ({ chatList, page, allChatsLoaded, chatListLoading, error: typeof chatListError === 'undefined' ? null : chatListError }),
	set: (patch) => { if ('show' in patch) show = patch.show; if ('user' in patch) user = patch.user; if ('query' in patch) query = patch.query;
	filter = { ...(query ? {query}:{}), order_by: orderBy, direction }; },
	unshare: typeof unshareHandler === 'undefined' ? null : unshareHandler,
	unshareAll: typeof unshareAllHandler === 'undefined' ? null : unshareAllHandler }; })()`,
		{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
	).outputText;
	const remove = vi.fn(async () => true);
	const modal = runInNewContext(code, {
		getContext: () => ({}),
		getErrorMessage,
		$i18n: { t: (s: string) => s },
		onDestroy: (callback: () => void) => destroys.push(callback),
		getSharedChatList: list,
		getChatListByUserId: list,
		deleteSharedChatById: remove,
		unshareAllChats: remove,
		update,
		toast: { error: errors, success: vi.fn() },
		localStorage: { token: 'test' },
		dayjs: { extend: () => {} },
		localizedFormat: {},
		setTimeout,
		clearTimeout
	}) as {
		refresh: () => Promise<void> | void;
		more: () => Promise<void>;
		retry: () => void;
		state: () => {
			chatList: Rows | null;
			page: number;
			allChatsLoaded: boolean;
			chatListLoading: boolean;
			error: string | null;
		};
		set: (patch: { show?: boolean; query?: string; user?: { id: string; name: string } }) => void;
		unshare: null | ((id: string) => Promise<void>);
		unshareAll: null | (() => Promise<void>);
	};
	return {
		modal,
		list,
		requests,
		errors,
		remove,
		update,
		destroy: () => destroys.forEach((cb) => cb())
	};
};
const settle = async (): Promise<void> => {
	for (let n = 0; n < 12; n += 1) await Promise.resolve();
};
afterEach((): void => {
	vi.useRealTimers();
});

for (const kind of ['shared', 'user'] as const) {
	it(`${kind}: rejects an older response after a new search`, async () => {
		vi.useFakeTimers();
		const { modal, requests } = load(kind);
		void modal.refresh();
		modal.set({ query: 'new' });
		void modal.refresh();
		await vi.advanceTimersByTimeAsync(500);
		requests[1].resolve([row('new')]);
		await settle();
		expect(modal.state().chatList).toEqual([row('new')]);
		requests[0].resolve([row('old')]);
		await settle();
		expect(modal.state().chatList).toEqual([row('new')]);
		expect(modal.state().allChatsLoaded).toBe(false);
	});
	it(`${kind}: ignores a response after close and cancels delayed searches`, async () => {
		vi.useFakeTimers();
		const { modal, requests, list } = load(kind);
		void modal.refresh();
		modal.set({ show: false });
		void modal.refresh();
		requests[0].resolve([row('closed')]);
		await settle();
		expect(modal.state().chatList).toBeNull();
		modal.set({ show: true, query: 'delayed' });
		void modal.refresh();
		modal.set({ show: false });
		void modal.refresh();
		await vi.advanceTimersByTimeAsync(500);
		expect(list).toHaveBeenCalledTimes(1);
	});
}

for (const kind of ['shared', 'user'] as const) {
	it(`${kind}: retries a failed page without losing rows, skipping pages or making concurrent loads`, async () => {
		const { modal, requests, list } = load(kind);
		void modal.refresh();
		requests[0].resolve([row('one')]);
		await settle();
		const more = modal.more();
		await modal.more();
		expect(list).toHaveBeenCalledTimes(2);
		requests[1].reject(new Error('offline'));
		await more;
		expect(modal.state()).toMatchObject({
			chatList: [row('one')],
			page: 1,
			chatListLoading: false,
			error: 'offline'
		});
		modal.retry();
		expect(list.mock.calls.at(-1)?.[kind === 'user' ? 2 : 1]).toBe(2);
		requests[2].resolve([row('one'), row('two')]);
		await settle();
		expect(modal.state()).toMatchObject({
			chatList: [row('one'), row('two')],
			page: 2,
			error: null
		});
		const end = modal.more();
		requests[3].resolve([]);
		await end;
		expect(modal.state().allChatsLoaded).toBe(true);
		await modal.more();
		expect(list).toHaveBeenCalledTimes(4);
	});
	it(`${kind}: stale pagination cannot append to or release a new search`, async () => {
		vi.useFakeTimers();
		const { modal, requests } = load(kind);
		void modal.refresh();
		requests[0].resolve([row('one')]);
		await settle();
		const more = modal.more();
		modal.set({ query: 'new' });
		void modal.refresh();
		requests[1].resolve([row('old-page')]);
		await more;
		expect(modal.state()).toMatchObject({ chatList: null, page: 1, chatListLoading: true });
		await vi.advanceTimersByTimeAsync(500);
		requests[2].resolve([row('new')]);
		await settle();
		expect(modal.state()).toMatchObject({
			chatList: [row('new')],
			page: 1,
			chatListLoading: false
		});
	});
	it(`${kind}: first-page failure is retryable and destruction cancels pending search and late errors`, async () => {
		vi.useFakeTimers();
		const { modal, requests, list, destroy } = load(kind);
		const first = modal.refresh();
		requests[0].reject({ detail: 'offline' });
		await first;
		expect(modal.state()).toMatchObject({
			chatList: null,
			chatListLoading: false,
			error: 'offline'
		});
		modal.retry();
		requests[1].resolve([]);
		await settle();
		expect(modal.state()).toMatchObject({ chatList: [], allChatsLoaded: true, error: null });
		void modal.refresh();
		modal.set({ query: 'delayed' });
		void modal.refresh();
		destroy();
		requests[2].reject(new Error('stale'));
		await settle();
		await vi.advanceTimersByTimeAsync(500);
		expect(list).toHaveBeenCalledTimes(3);
		expect(modal.state().error).toBeNull();
	});
}
it('user: changing the selected user discards the previous user reply', async () => {
	const { modal, requests, list } = load('user');
	void modal.refresh();
	modal.set({ user: { id: 'two', name: 'Second' } });
	void modal.refresh();
	requests[1].resolve([row('second-user')]);
	await settle();
	requests[0].resolve([row('first-user')]);
	await settle();
	expect(list.mock.calls[1][1]).toBe('two');
	expect(modal.state().chatList).toEqual([row('second-user')]);
});
it.each(['unshare', 'unshareAll'] as const)(
	'shared: %s reports the committed server action after closing without reloading',
	async (action) => {
		const { modal, requests, remove, update, list } = load('shared');
		void modal.refresh();
		requests[0].resolve([row('shared')]);
		await settle();
		let finish: (success: boolean) => void = () => {};
		remove.mockImplementationOnce(
			() =>
				new Promise<boolean>((resolve) => {
					finish = resolve;
				})
		);
		const operation = action === 'unshare' ? modal.unshare!('shared') : modal.unshareAll!();
		modal.set({ show: false });
		void modal.refresh();
		finish(true);
		await operation;
		expect(update).toHaveBeenCalledTimes(1);
		expect(list).toHaveBeenCalledTimes(1);
		expect(modal.state().chatList).toBeNull();
	}
);
