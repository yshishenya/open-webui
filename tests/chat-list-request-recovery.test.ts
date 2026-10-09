import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { compile } from 'svelte/compiler';
import { expect, it, vi } from 'vitest';
import type { ChatTitleIdResponse } from '../src/lib/utils/airis/frontend-contracts';

type Row = ChatTitleIdResponse & { time_range: string };
const row = (id: string): Row => ({
	id,
	title: id,
	created_at: 1,
	updated_at: 1,
	time_range: 'Today'
});
const handlers = (file: string, names: string[]): string => {
	const text = readFileSync(file, 'utf8').split('</script>')[0].replace('<script lang="ts">', '');
	const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	const code: string[] = [];
	for (const statement of ast.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const node of statement.declarationList.declarations) {
			const name = node.name.getText(ast);
			if (names.includes(name) && node.initializer)
				code.push(`const ${name}=${node.initializer.getText(ast)};`);
		}
	}
	return ts.transpileModule(code.join('\n'), {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
};
const setupSearch = () => {
	const context = {
		show: true,
		query: '',
		page: 1,
		chatList: [row('retained')] as Row[] | null,
		chatListLoading: false,
		chatListFailed: false,
		allChatsLoaded: false,
		searchGeneration: 0,
		previewGeneration: 0,
		editGeneration: 0,
		generating: false,
		editingChatId: null as string | null,
		editingChatTitle: '',
		searchDebounceTimeout: null,
		selectedChat: null,
		messages: null,
		history: null,
		selectedModels: [''],
		localStorage: { token: 'test' },
		toast: { error: vi.fn() },
		getChatList: vi.fn<[string, number], Promise<Row[]>>(),
		getChatListBySearchText: vi.fn<[string, string, number], Promise<Row[]>>(),
		setTimeout,
		clearTimeout
	};
	const api = runInNewContext(
		`${handlers('src/lib/components/layout/SearchModal.svelte', ['requestChatPage', 'loadMoreChats', 'searchHandler', 'cancelSearch', 'cancelRename'])};({loadMoreChats,searchHandler,cancelSearch})`,
		context
	) as {
		loadMoreChats: () => Promise<void>;
		searchHandler: () => Promise<void>;
		cancelSearch: () => void;
	};
	return { context, ...api };
};
it('search keeps rows and failed page, releases loading and deduplicates a successful retry', async () => {
	const s = setupSearch();
	s.context.getChatList
		.mockRejectedValueOnce(new Error('503'))
		.mockResolvedValueOnce([row('retained'), row('next')]);
	await expect(s.loadMoreChats()).resolves.toBeUndefined();
	expect(s.context.chatList?.map((r) => r.id)).toEqual(['retained']);
	expect(s.context.page).toBe(1);
	expect(s.context.chatListLoading).toBe(false);
	expect(s.context.chatListFailed).toBe(true);
	await s.loadMoreChats();
	expect(s.context.getChatList.mock.calls.map((c) => c[1])).toEqual([2, 2]);
	expect(s.context.chatList?.map((r) => r.id)).toEqual(['retained', 'next']);
	expect(s.context.chatListFailed).toBe(false);
});
it('initial search failure releases loading and allows retry', async () => {
	const s = setupSearch();
	s.context.editingChatId = 'retained';
	s.context.editingChatTitle = 'old edit';
	s.context.generating = true;
	s.context.getChatList
		.mockRejectedValueOnce(new Error('503'))
		.mockResolvedValueOnce([row('loaded')]);
	await expect(s.searchHandler()).resolves.toBeUndefined();
	expect(s.context.chatListLoading).toBe(false);
	expect(s.context.chatListFailed).toBe(true);
	expect(s.context.editingChatId).toBeNull();
	expect(s.context.generating).toBe(false);
	expect(s.context.previewGeneration).toBe(1);
	await s.searchHandler();
	expect(s.context.chatList?.map((r) => r.id)).toEqual(['loaded']);
	expect(s.context.getChatList.mock.calls.map((c) => c[1])).toEqual([1, 1]);
});
it('old search failure cannot override a newer successful request', async () => {
	const s = setupSearch();
	let reject!: (error: Error) => void;
	s.context.getChatList
		.mockImplementationOnce(
			() =>
				new Promise<Row[]>((_resolve, no) => {
					reject = no;
				})
		)
		.mockResolvedValueOnce([row('latest')]);
	const old = s.loadMoreChats();
	await s.searchHandler();
	reject(new Error('late503'));
	await old;
	expect(s.context.chatList?.map((r) => r.id)).toEqual(['latest']);
	expect(s.context.page).toBe(1);
	expect(s.context.chatListFailed).toBe(false);
	expect(s.context.chatListLoading).toBe(false);
});
it('sidebar handles initial and page failures without leaving UI loading active', async () => {
	const context = {
		chatListLoading: false,
		chatListFailed: false,
		chatListReady: true,
		allChatsLoaded: false,
		chatListRequestGeneration: 0,
		localStorage: { token: 'test' },
		refreshChatList: vi
			.fn()
			.mockRejectedValueOnce(new Error('503'))
			.mockResolvedValueOnce({ accepted: true, allLoaded: false }),
		loadNextChatListPage: vi
			.fn()
			.mockRejectedValueOnce(new Error('503'))
			.mockResolvedValueOnce({ accepted: true, allLoaded: false }),
		initFolders: vi.fn(),
		folderRegistry: {},
		toast: { error: vi.fn() }
	};
	const api = runInNewContext(
		`${handlers('src/lib/components/layout/Sidebar.svelte', ['refreshChatRows', 'loadMoreChats'])};({refreshChatRows,loadMoreChats})`,
		context
	) as { refreshChatRows: () => Promise<void>; loadMoreChats: () => Promise<void> };
	await expect(api.refreshChatRows()).resolves.toBeUndefined();
	expect(context.chatListReady).toBe(false);
	expect(context.chatListFailed).toBe(true);
	expect(context.chatListLoading).toBe(false);
	await api.refreshChatRows();
	expect(context.chatListReady).toBe(true);
	await expect(api.loadMoreChats()).resolves.toBeUndefined();
	expect(context.chatListFailed).toBe(true);
	expect(context.chatListLoading).toBe(false);
	await api.loadMoreChats();
	expect(context.chatListFailed).toBe(false);
});

it('old successful page and duplicate clicks cannot change a newer search', async () => {
	const s = setupSearch();
	let resolve!: (rows: Row[]) => void;
	s.context.getChatList
		.mockImplementationOnce(
			() =>
				new Promise<Row[]>((yes) => {
					resolve = yes;
				})
		)
		.mockResolvedValueOnce([row('latest')]);
	const old = s.loadMoreChats();
	await s.loadMoreChats();
	expect(s.context.getChatList).toHaveBeenCalledTimes(1);
	await s.searchHandler();
	resolve([row('old')]);
	await old;
	expect(s.context.chatList?.map((r) => r.id)).toEqual(['latest']);
	expect(s.context.page).toBe(1);
});
it('debounced search retries page one and closing cancels pending and in-flight results', async () => {
	vi.useFakeTimers();
	try {
		const s = setupSearch();
		s.context.query = 'topic';
		s.context.getChatListBySearchText
			.mockRejectedValueOnce(new Error('503'))
			.mockResolvedValueOnce([row('topic')]);
		await s.searchHandler();
		await vi.advanceTimersByTimeAsync(500);
		expect(s.context.chatListFailed).toBe(true);
		await s.searchHandler();
		await vi.advanceTimersByTimeAsync(500);
		expect(s.context.chatList?.map((r) => r.id)).toEqual(['topic']);
		expect(s.context.getChatListBySearchText.mock.calls).toEqual([
			['test', 'topic', 1],
			['test', 'topic', 1]
		]);
		let resolve!: (rows: Row[]) => void;
		s.context.getChatListBySearchText.mockImplementationOnce(
			() =>
				new Promise<Row[]>((yes) => {
					resolve = yes;
				})
		);
		const old = s.loadMoreChats();
		s.context.show = false;
		s.cancelSearch();
		resolve([row('closed')]);
		await old;
		expect(s.context.chatList?.map((r) => r.id)).toEqual(['topic']);
		s.context.show = true;
		await s.searchHandler();
		s.context.show = false;
		s.cancelSearch();
		await vi.advanceTimersByTimeAsync(500);
		expect(s.context.getChatListBySearchText).toHaveBeenCalledTimes(3);
	} finally {
		vi.useRealTimers();
	}
});
it('compiled show reaction depends only on show, so cancellation cannot re-trigger search', () => {
	const file = 'src/lib/components/layout/SearchModal.svelte';
	const code = compile(readFileSync(file, 'utf8'), { filename: file, generate: 'client' }).js.code;
	const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
	const dependencies: string[] = [];
	const visit = (node: ts.Node): void => {
		if (
			ts.isCallExpression(node) &&
			node.expression.getText(ast) === '$.legacy_pre_effect' &&
			node.arguments[1]?.getText(ast).includes('cancelSearch()')
		)
			dependencies.push(node.arguments[0].getText(ast));
		ts.forEachChild(node, visit);
	};
	visit(ast);
	expect(dependencies).toHaveLength(1);
	expect(dependencies[0]).toContain('show');
	expect(dependencies[0]).not.toMatch(/searchGeneration|searchDebounceTimeout/);
});
