// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { parse } from 'svelte/compiler';
import { writable } from 'svelte/store';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Folder from '$lib/components/common/Folder.svelte';
import Section from '$lib/components/layout/Sidebar/Section.svelte';
import RecursiveFolder from '$lib/components/layout/Sidebar/RecursiveFolder.svelte';

const api = vi.hoisted(() => ({
	error: vi.fn(),
	importChats: vi.fn(),
	getChatById: vi.fn(),
	updateChatFolderIdById: vi.fn(),
	getChatListByFolderId: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { error: api.error, success: vi.fn() } }));
vi.mock('$lib/constants', () => ({
	WEBUI_API_BASE_URL: '/api/v1',
	WEBUI_BASE_URL: '',
	APP_NAME: 'AIRIS'
}));
vi.mock('$lib/apis/chats', () => ({ ...api }));
vi.mock('$lib/components/layout/Sidebar/ChatItem.svelte', () => ({ default: () => ({}) }));
vi.mock('$lib/components/layout/Sidebar/Folders/FolderMenu.svelte', () => ({
	default: () => ({})
}));
vi.mock('$lib/components/layout/Sidebar/Folders/FolderModal.svelte', () => ({
	default: () => ({})
}));
vi.mock('$lib/components/layout/Sidebar/Folders/FolderShareModal.svelte', () => ({
	default: () => ({})
}));
vi.mock('$lib/components/common/ConfirmDialog.svelte', () => ({ default: () => ({}) }));

const sidebar = readFileSync('src/lib/components/layout/Sidebar.svelte', 'utf8');
function action(file: string, name: string): string {
	const source = readFileSync(file, 'utf8');
	const script = parse(source).instance!;
	const ast = ts.createSourceFile(
		'component.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest
	);
	const d = ast.statements
		.filter(ts.isVariableStatement)
		.flatMap((s) => [...s.declarationList.declarations])
		.find((d) => d.name.getText(ast) === name);
	if (!d?.initializer) throw Error('Missing action ' + name);
	return d.initializer.getText(ast);
}
function evaluate(
	source: string,
	context: Record<string, unknown>
): (...args: unknown[]) => Promise<void> {
	return runInNewContext(
		ts.transpileModule('(' + source + ')', { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
			.outputText,
		context
	);
}
const sidebarPath = 'src/lib/components/layout/Sidebar.svelte';
const importAction = action(sidebarPath, 'importChatHandler');
function importContext(): Record<string, unknown> & {
	importChats: ReturnType<typeof vi.fn>;
	toast: { error: ReturnType<typeof vi.fn> };
	initChatList: ReturnType<typeof vi.fn>;
} {
	return {
		canImportChats: true,
		console: { log: vi.fn() },
		$i18n: { t: (s: string) => s },
		localStorage: { token: 'fixture' },
		importChats: vi.fn().mockResolvedValue([]),
		toast: { error: vi.fn() },
		initChatList: vi.fn()
	};
}
it.each([null, {}, [{ chat: {} }, null], [{ chat: {} }, []], [{ chat: [] }]])(
	'rejects the whole invalid import %j before any POST',
	async (items) => {
		const c = importContext();
		await expect(evaluate(importAction, c)(items)).resolves.toBeUndefined();
		expect(c.importChats).not.toHaveBeenCalled();
		expect(c.initChatList).not.toHaveBeenCalled();
		expect(c.toast.error).toHaveBeenCalledOnce();
	}
);
it('sends both valid chats once, preserving metadata, dates, destination and pin status', async () => {
	const c = importContext();
	const rows = [
		{ chat: { title: 'First' }, meta: { custom: 7 }, created_at: 1, updated_at: 2 },
		{ chat: { title: 'Second' } }
	];
	await evaluate(importAction, c)(rows, true, 'folder');
	expect(c.importChats).toHaveBeenCalledOnce();
	expect(c.importChats).toHaveBeenCalledWith(
		'fixture',
		rows.map((row) => ({
			chat: row.chat,
			meta: row.meta ?? {},
			pinned: true,
			folder_id: 'folder',
			created_at: row.created_at ?? null,
			updated_at: row.updated_at ?? null
		}))
	);
	expect(c.initChatList).toHaveBeenCalledOnce();
});
it('handles a refused POST without retrying or refreshing the list', async () => {
	const c = importContext();
	c.importChats.mockRejectedValue(Error('Import unavailable'));
	await expect(evaluate(importAction, c)([{ chat: {} }])).resolves.toBeUndefined();
	expect(c.importChats).toHaveBeenCalledOnce();
	expect(c.initChatList).not.toHaveBeenCalled();
	expect(c.toast.error).toHaveBeenCalledOnce();
});
it('preserves the import permission boundary', async () => {
	const c = importContext();
	c.canImportChats = false;
	await evaluate(importAction, c)([{ chat: {} }]);
	expect(c.importChats).not.toHaveBeenCalled();
	expect(c.toast.error).toHaveBeenCalledWith('Access prohibited');
});
function sidebarDrop(id: string): string {
	let expression = '';
	function visit(value: unknown): void {
		if (!value || typeof value !== 'object') return;
		const node = value as {
			type?: string;
			attributes?: {
				type: string;
				name: string;
				value?: { data?: string }[];
				expression?: { start: number; end: number };
			}[];
		};
		if (
			node.type === 'InlineComponent' &&
			node.attributes?.some((a) => a.name === 'id' && a.value?.[0]?.data === id)
		) {
			const a = node.attributes.find((a) => a.type === 'EventHandler' && a.name === 'drop');
			if (a?.expression) expression = sidebar.slice(a.expression.start, a.expression.end);
		}
		Object.values(value).forEach((v) => (Array.isArray(v) ? v.forEach(visit) : visit(v)));
	}
	visit(parse(sidebar).html);
	if (!expression) throw Error('Missing drop ' + id);
	return expression;
}
it.each(['sidebar-chats', 'sidebar-pinned-chats'])(
	'uses the returned chat ID for %s fallback and reports refusal',
	async (id) => {
		const pinned = id === 'sidebar-pinned-chats';
		const context = {
			...importContext(),
			getChatById: vi.fn().mockResolvedValue(null),
			toggleChatPinnedStatusById: vi.fn(),
			updateChatFolderIdById: vi.fn(),
			folderRegistry: {}
		};
		context.importChats.mockResolvedValue([{ id: 'new-chat', pinned: !pinned }]);
		const drop = evaluate(sidebarDrop(id), context);
		await drop({ detail: { type: 'chat', id: 'external', item: { chat: {} } } });
		expect(context.toggleChatPinnedStatusById).toHaveBeenCalledWith('fixture', 'new-chat');
		context.importChats.mockRejectedValue(Error('Import unavailable'));
		context.initChatList.mockClear();
		await expect(
			drop({ detail: { type: 'chat', id: 'external', item: { chat: {} } } })
		).resolves.toBeUndefined();
		expect(context.toast.error).toHaveBeenCalledOnce();
		expect(context.initChatList).not.toHaveBeenCalled();
	}
);

let readers: Reader[] = [];
class Reader {
	result: string | null = null;
	onload: ((event: { target: Reader }) => void) | null = null;
	onerror: (() => void) | null = null;
	constructor() {
		readers.push(this);
	}
	readAsText(): void {}
	finish(body: string): void {
		this.result = body;
		this.onload?.({ target: this });
	}
}
beforeEach(() => {
	readers = [];
	vi.clearAllMocks();
	vi.stubGlobal('FileReader', Reader);
	api.getChatById.mockResolvedValue(null);
	api.importChats.mockResolvedValue([{ id: 'new-chat', folder_id: null }]);
	api.updateChatFolderIdById.mockResolvedValue({ id: 'new-chat' });
	api.getChatListByFolderId.mockResolvedValue([]);
});
afterEach(() => {
	vi.unstubAllGlobals();
});
function drop(node: HTMLElement, file = true): void {
	const event = new Event('drop', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'dataTransfer', {
		value: {
			items: [
				{
					kind: file ? 'file' : 'string',
					getAsFile: () => new File(['fixture'], 'chats.json', { type: 'application/json' })
				}
			],
			getData: () => JSON.stringify({ type: 'chat', id: 'external', item: { chat: {} } })
		}
	});
	node.dispatchEvent(event);
}
async function setup(kind: string) {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const target = document.createElement('div');
	document.body.append(target);
	const imported = vi.fn();
	const options = {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		events: { import: imported }
	};
	const props = { id: 'fixture', name: 'Folder' };
	const component =
		kind === 'recursive'
			? mount(RecursiveFolder, {
					...options,
					props: {
						folderId: 'folder',
						folders: { folder: { name: 'Folder', is_expanded: false } },
						folderRegistry: {}
					}
				})
			: kind === 'folder'
				? mount(Folder, { ...options, props })
				: mount(Section, { ...options, props });
	await tick();
	const node = target.lastElementChild as HTMLElement;
	return {
		target,
		node,
		imported,
		close: async () => {
			await unmount(component);
			target.remove();
		}
	};
}
it.each(['folder', 'section', 'recursive'])(
	'%s imports a file once and reports a read failure',
	async (kind) => {
		const s = await setup(kind);
		try {
			drop(s.node);
			readers[0].finish('[{"chat":{}}]');
			expect(s.imported).toHaveBeenCalledOnce();
			const detail = s.imported.mock.calls[0][0].detail;
			expect(detail).toEqual(
				kind === 'recursive' ? { folderId: 'folder', items: [{ chat: {} }] } : [{ chat: {} }]
			);
			drop(s.node);
			readers[1].onerror?.();
			expect(api.error).toHaveBeenCalledOnce();
		} finally {
			await s.close();
		}
	}
);
it.each(['folder', 'section', 'recursive'])(
	'%s ignores late file callbacks and releases its drag handler',
	async (kind) => {
		const s = await setup(kind);
		drop(s.node);
		await s.close();
		readers[0].finish('[{"chat":{}}]');
		readers[0].onerror?.();
		expect(s.imported).not.toHaveBeenCalled();
		expect(api.error).not.toHaveBeenCalled();
		const event = new Event('dragover', { cancelable: true });
		s.node.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	}
);
it('moves an imported chat to a recursive folder using the returned ID', async () => {
	const s = await setup('recursive');
	try {
		drop(s.node, false);
		await vi.waitFor(() =>
			expect(api.updateChatFolderIdById).toHaveBeenCalledWith(
				localStorage.token,
				'new-chat',
				'folder'
			)
		);
	} finally {
		await s.close();
	}
});
it('releases recursive dragover even when no file was read', async () => {
	const s = await setup('recursive');
	await s.close();
	const event = new Event('dragover', { cancelable: true });
	s.node.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(false);
});
it('refreshing an origin folder tolerates a sparse registry entry', async () => {
	const handler = evaluate(
		action('src/lib/components/layout/Sidebar/Folders.svelte', 'onItemMove'),
		{ folderRegistry: { origin: {} } }
	);
	expect(() =>
		handler({ originFolderId: 'origin', targetFolderId: 'target', e: {} })
	).not.toThrow();
});
it('the add control is a single labelled button and never submits its parent form', async () => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const target = document.createElement('form');
	document.body.append(target);
	const add = vi.fn();
	const submit = vi.fn((event: Event) => event.preventDefault());
	target.addEventListener('submit', submit);
	const component = mount(Folder, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: { name: 'Folder', onAdd: add, onAddLabel: 'Add folder' }
	});
	try {
		await tick();
		expect(target.querySelector('button button')).toBeNull();
		const button = target.querySelector('button[aria-label="Add folder"]') as HTMLButtonElement;
		expect(button).not.toBeNull();
		button.click();
		expect(add).toHaveBeenCalledOnce();
		expect(submit).not.toHaveBeenCalled();
	} finally {
		await unmount(component);
		target.remove();
	}
});
