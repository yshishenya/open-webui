import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { Component } from 'svelte';
import { compile, parse } from 'svelte/compiler';
import { render } from 'svelte/server';
import { expect, it, vi } from 'vitest';
import { searchRig, response, deferred } from './fixtures/workspace-search-actual';
const server = createRequire(import.meta.url)('svelte/internal/server') as Record<string, unknown>;
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
it('opening the sidebar keeps an initial request or failed list until explicit retry', async () => {
	const context = {
		chatListLoading: true,
		chatListFailed: false,
		chatListReady: false,
		console: { log: vi.fn() },
		localStorage: { token: 'test' },
		$config: { features: { enable_notes: false } },
		getAllTags: vi.fn().mockResolvedValue([]),
		tags: { set: vi.fn() },
		refreshChatRows: vi.fn()
	};
	const init = runInNewContext(
		`${handlers('src/lib/components/layout/Sidebar.svelte', ['initChatList'])};initChatList`,
		context
	) as () => Promise<void>;
	await init();
	context.chatListLoading = false;
	context.chatListFailed = true;
	await init();
	expect(context.refreshChatRows).not.toHaveBeenCalled();
	context.chatListFailed = false;
	await init();
	expect(context.refreshChatRows).toHaveBeenCalledOnce();
});

it('sidebar handles initial and page failures without leaving UI loading active', async () => {
	const context = {
		$showSidebar: true,
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

it('search retries the failed page and deduplicates successful pagination', async () => {
	const s = searchRig();
	s.searchWorkspace
		.mockResolvedValueOnce(response(['retained'], true))
		.mockRejectedValueOnce(new Error('503'))
		.mockResolvedValueOnce(response(['retained', 'next']));
	await s.api.fetch(1);
	await s.api.fetch(2);
	expect(s.api.state()).toMatchObject({ page: 1, loading: false });
	expect(s.api.state().error).toBeTruthy();
	expect(s.api.state().results.map((r) => r.id)).toEqual(['retained']);
	await s.api.fetch(2);
	expect(s.searchWorkspace.mock.calls.map((c) => c[1].page)).toEqual([1, 2, 2]);
	expect(s.api.state().results.map((r) => r.id)).toEqual(['retained', 'next']);
	expect(s.api.state().error).toBe('');
});
it('initial failure releases loading and permits retry', async () => {
	const s = searchRig();
	s.searchWorkspace
		.mockRejectedValueOnce(new Error('503'))
		.mockResolvedValueOnce(response(['retry']));
	await s.api.fetch(1);
	expect(s.api.state().loading).toBe(false);
	await s.api.fetch(1);
	expect(s.api.state().results[0].id).toBe('retry');
});
it('duplicate load-more clicks share a request', async () => {
	const s = searchRig();
	s.searchWorkspace.mockResolvedValueOnce(response(['initial'], true));
	await s.api.fetch(1);
	const waiting = deferred<ReturnType<typeof response>>();
	s.searchWorkspace.mockReturnValueOnce(waiting.promise);
	const request = s.api.fetch(2);
	await s.api.fetch(2);
	expect(s.searchWorkspace).toHaveBeenCalledTimes(2);
	waiting.resolve(response(['next']));
	await request;
	expect(s.api.state().page).toBe(2);
});
it('query debounce sends the current filters once and close cancels its timer', async () => {
	vi.useFakeTimers();
	try {
		const s = searchRig();
		s.searchWorkspace.mockResolvedValue(response(['match']));
		s.api.change({ query: 'old' });
		s.api.schedule();
		s.api.change({ query: 'new', kind: 'note', sharing: 'shared', scope: 'folder' });
		s.api.schedule();
		await vi.advanceTimersByTimeAsync(179);
		expect(s.searchWorkspace).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(s.searchWorkspace).toHaveBeenCalledWith(
			'fixture',
			{ q: 'new', kind: 'note', sharing: 'shared', scope: 'folder', page: 1 },
			expect.any(AbortSignal)
		);
		s.api.schedule();
		s.api.close();
		await vi.advanceTimersByTimeAsync(500);
		expect(s.searchWorkspace).toHaveBeenCalledOnce();
	} finally {
		vi.useRealTimers();
	}
});
it('compiled search reaction depends on inputs without request state loops', () => {
	const file = 'src/lib/components/layout/SearchModal.svelte';
	const code = compile(readFileSync(file, 'utf8'), { filename: file, generate: 'client' }).js.code;
	const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
	const deps: string[] = [];
	const visit = (node: ts.Node): void => {
		if (
			ts.isCallExpression(node) &&
			node.expression.getText(ast) === '$.legacy_pre_effect' &&
			node.arguments[1]?.getText(ast).includes('schedule(')
		)
			deps.push(node.arguments[0].getText(ast));
		ts.forEachChild(node, visit);
	};
	visit(ast);
	expect(deps).toHaveLength(1);
	for (const name of ['show', 'query', 'kind', 'sharing', 'scope']) expect(deps[0]).toContain(name);
	expect(deps[0]).not.toMatch(/generation|timer|results/);
});

// Compile the actual list markup: handler-only tests miss a Retry hidden by the null-list branch.
const sidebarListMarkup = (): string => {
	const source = readFileSync('src/lib/components/layout/Sidebar.svelte', 'utf8');
	const start = source.indexOf('<div class="pt-1.5">');
	const find = (value: unknown): { start: number; end: number } | null => {
		if (value === null || typeof value !== 'object') return null;
		const node = value as Record<string, unknown>;
		if (node.type === 'Element' && node.start === start && typeof node.end === 'number')
			return { start, end: node.end };
		for (const child of Object.values(node)) {
			const match = find(child);
			if (match) return match;
		}
		return null;
	};
	const element = find(parse(source).html);
	if (!element) throw new Error('Missing Sidebar list markup');
	return source
		.slice(element.start, element.end)
		.replaceAll('$chats', 'rows')
		.replaceAll('$i18n.t', 'translate');
};
const renderSidebarList = (props: {
	rows: { id: string; title: string; time_range?: string }[] | null;
	chatListFailed: boolean;
	chatListReady: boolean;
	chatListLoading?: boolean;
	allChatsLoaded?: boolean;
}): string => {
	const source = `<script>
		export let rows=null; export let chatListFailed=false; export let chatListReady=false;
		export let chatListLoading=false; export let allChatsLoaded=false;
		const translate=value=>value; const shiftKey=false; let selectedChatId=null;
		const initChatList=()=>{}; const refreshChatRows=()=>{}; const loadMoreChats=()=>{};
		const applyChatReadState=()=>{}; const tagEventHandler=()=>{};
	</script>${sidebarListMarkup()}`;
	const code = compile(source, { generate: 'server', name: 'SidebarList' }).js.code;
	type Renderer = { push: (html: string) => void };
	const component = runInNewContext(
		code.replace(/^import .*;\n/gm, '').replace('export default ', '') + ';SidebarList',
		{
			$: server,
			ChatItem: (renderer: Renderer, item: { title: string }): void => renderer.push(item.title),
			Spinner: (): void => {},
			Loader: (renderer: Renderer, item: { children: (renderer: Renderer) => void }): void =>
				item.children(renderer)
		}
	) as Component<typeof props>;
	return render(component, { props }).body;
};
it('compiled Sidebar shows Retry after first-page failure with a null shared list', () => {
	const html = renderSidebarList({ rows: null, chatListFailed: true, chatListReady: false });
	expect(html).toContain('>Retry</button>');
	expect(html).not.toContain('Loading...');
});
it('compiled Sidebar retains rows and Retry after a later-page failure', () => {
	const html = renderSidebarList({
		rows: [{ id: 'one', title: 'Retained recovery chat' }],
		chatListFailed: true,
		chatListReady: true
	});
	expect(html).toContain('Retained recovery chat');
	expect(html).toContain('>Retry</button>');
	expect(html).not.toContain('Loading...');
});
it('compiled Sidebar distinguishes an initial pending request from an empty completed list', () => {
	const pending = renderSidebarList({ rows: null, chatListFailed: false, chatListReady: false });
	expect(pending).toContain('Loading...');
	expect(pending).not.toContain('>Retry</button>');
	const empty = renderSidebarList({
		rows: [],
		chatListFailed: false,
		chatListReady: true,
		allChatsLoaded: true
	});
	expect(empty).not.toContain('Loading...');
	expect(empty).not.toContain('>Retry</button>');
});
it('mount initialization and immediate subscription share the pending list request and preserve failure', async () => {
	const pending = deferred<{ accepted: boolean; allLoaded: boolean }>();
	const context = {
		chatListLoading: false,
		chatListFailed: false,
		chatListReady: false,
		chatListRequestGeneration: 0,
		allChatsLoaded: false,
		console: { log: vi.fn() },
		localStorage: { token: 'test' },
		$config: { features: { enable_notes: false, enable_channels: false } },
		getAllTags: vi.fn().mockResolvedValue([]),
		tags: { set: vi.fn() },
		refreshChatList: vi.fn().mockReturnValue(pending.promise),
		initFolders: vi.fn(),
		folderRegistry: {}
	};
	const api = runInNewContext(
		`${handlers('src/lib/components/layout/Sidebar.svelte', ['initChatList', 'initSidebarData', 'refreshChatRows'])};({initChatList,initSidebarData})`,
		context
	) as { initChatList: () => Promise<void>; initSidebarData: () => Promise<void> };
	const mounting = api.initSidebarData();
	await api.initChatList();
	expect(context.refreshChatList).toHaveBeenCalledOnce();
	pending.reject(new Error('503'));
	await mounting;
	await api.initChatList();
	expect(context.refreshChatList).toHaveBeenCalledOnce();
	expect(context.chatListLoading).toBe(false);
	expect(context.chatListFailed).toBe(true);
	expect(renderSidebarList({ rows: null, ...context })).toContain('>Retry</button>');
});
it('a stale Sidebar request cannot release the newer request loading or overwrite its failure', async () => {
	const old = deferred<{ accepted: boolean; allLoaded: boolean }>();
	const current = deferred<{ accepted: boolean; allLoaded: boolean }>();
	const context = {
		chatListLoading: false,
		chatListFailed: false,
		chatListReady: false,
		chatListRequestGeneration: 0,
		allChatsLoaded: false,
		localStorage: { token: 'test' },
		refreshChatList: vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise),
		initFolders: vi.fn(),
		folderRegistry: {}
	};
	const refresh = runInNewContext(
		`${handlers('src/lib/components/layout/Sidebar.svelte', ['refreshChatRows'])};refreshChatRows`,
		context
	) as () => Promise<void>;
	const first = refresh();
	const second = refresh();
	old.resolve({ accepted: false, allLoaded: false });
	await first;
	expect(context.chatListLoading).toBe(true);
	expect(context.chatListFailed).toBe(false);
	current.reject(new Error('503'));
	await second;
	expect(context.chatListLoading).toBe(false);
	expect(context.chatListFailed).toBe(true);
	expect(renderSidebarList({ rows: null, ...context })).toContain('>Retry</button>');
});
