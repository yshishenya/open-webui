// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const source = readFileSync('src/lib/components/layout/Sidebar.svelte', 'utf8');
const instance = parse(source).instance;
if (!instance) throw new Error('Missing sidebar script');
const parsed = ts.createSourceFile(
	'sidebar.ts',
	source.slice(instance.content.start, instance.content.end),
	ts.ScriptTarget.Latest,
	true
);
const evaluate = (expression: string, context: Record<string, unknown>): unknown =>
	runInNewContext(
		ts.transpileModule(`(${expression})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	);
const actionSource = (name: string): string => {
	for (const statement of parsed.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const declaration = statement.declarationList.declarations.find(
			(d) => d.name.getText(parsed) === name
		);
		if (declaration?.initializer) return declaration.initializer.getText(parsed);
	}
	throw new Error(`Missing actual sidebar action: ${name}`);
};
const events = (): {
	addEventListener: ReturnType<typeof vi.fn>;
	removeEventListener: ReturnType<typeof vi.fn>;
} => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() });

it('folder children remain sorted and shared children are deduplicated', async () => {
	const context = {
		$config: { features: { enable_folders: true } },
		localStorage: { token: 'fixture' },
		newFolderId: null,
		folders: {},
		sharedFolders: [],
		_folders: { set: vi.fn() },
		toast: { error: vi.fn() },
		getFolders: vi.fn().mockResolvedValue([
			{ id: 'first', parent_id: 'parent', updated_at: 1 },
			{ id: 'second', parent_id: 'parent', updated_at: 2 },
			{ id: 'root', parent_id: null, updated_at: 0 }
		]),
		getSharedFolders: vi.fn().mockResolvedValue([
			{ id: 'shared', parent_id: 'parent' },
			{ id: 'shared', parent_id: 'parent' }
		])
	};
	await (evaluate(actionSource('initFolders'), context) as () => Promise<void>)();
	expect(context.folders).toMatchObject({
		parent: { childrenIds: ['second', 'first', 'shared'] },
		root: { parent_id: null },
		shared: { shared: true }
	});
	expect(context.toast.error).not.toHaveBeenCalled();
});

it('repeated sidebar mounts synchronously release all component resources', () => {
	const mount = parsed.statements.find(
		(s) =>
			ts.isExpressionStatement(s) &&
			ts.isCallExpression(s.expression) &&
			s.expression.expression.getText(parsed) === 'onMount'
	);
	if (!mount || !ts.isExpressionStatement(mount) || !ts.isCallExpression(mount.expression)) {
		throw new Error('Missing actual sidebar mount');
	}
	for (let cycle = 0; cycle < 21; cycle++) {
		const unsubscribers: (() => void)[] = [];
		const store = (): { subscribe: () => () => void; set: () => void } => ({
			subscribe: (): (() => void) => {
				const stop = vi.fn();
				unsubscribers.push(stop);
				return stop;
			},
			set: vi.fn()
		});
		const window = events();
		const socket = { on: vi.fn(), off: vi.fn() };
		const folderCleanup = vi.fn();
		const cleanup = (
			evaluate(mount.expression.arguments[0].getText(parsed), {
				localStorage: { getItem: () => '245', sidebar: 'true' },
				MIN_WIDTH: 220,
				MAX_WIDTH: 480,
				$sidebarWidth: 245,
				$mobile: false,
				$socket: socket,
				sidebarWidth: store(),
				showSidebar: store(),
				mobile: store(),
				settings: store(),
				document: { documentElement: { style: { setProperty: vi.fn() } } },
				window,
				onKeyDown: vi.fn(),
				onKeyUp: vi.fn(),
				onTouchStart: vi.fn(),
				onTouchEnd: vi.fn(),
				onFocus: vi.fn(),
				onBlur: vi.fn(),
				chatActiveEventHandler: vi.fn(),
				refreshChatRows: vi.fn(),
				registerFolderRefreshHandler: vi.fn(() => folderCleanup)
			}) as () => unknown
		)();
		// Svelte registers only a synchronous function as component teardown.
		expect(typeof cleanup).toBe('function');
		expect(unsubscribers).toHaveLength(4);
		expect(window.addEventListener).toHaveBeenCalledTimes(6);
		expect(socket.on).toHaveBeenCalledTimes(2);
		(cleanup as () => void)();
		unsubscribers.forEach((stop) => expect(stop).toHaveBeenCalledTimes(1));
		expect(window.removeEventListener.mock.calls).toEqual(window.addEventListener.mock.calls);
		expect(socket.off.mock.calls).toEqual(socket.on.mock.calls);
		expect(folderCleanup).toHaveBeenCalledTimes(1);
	}
});

it('replacement sidebar elements own and release their drop handlers', () => {
	expect(source.match(/use:sidebarDropZone/g)).toHaveLength(2);
	const context = { onDragOver: vi.fn(), onDrop: vi.fn(), onDragLeave: vi.fn(), draggedOver: true };
	const bind = evaluate(actionSource('sidebarDropZone'), context) as (
		node: ReturnType<typeof events>
	) => { destroy: () => void };
	for (let cycle = 0; cycle < 21; cycle++) {
		const closed = events();
		const open = events();
		const closedAction = bind(closed);
		closedAction.destroy();
		const openAction = bind(open);
		expect(closed.removeEventListener.mock.calls).toEqual(closed.addEventListener.mock.calls);
		expect(open.addEventListener).toHaveBeenCalledTimes(3);
		expect(open.removeEventListener).not.toHaveBeenCalled();
		openAction.destroy();
		expect(open.removeEventListener.mock.calls).toEqual(open.addEventListener.mock.calls);
	}
});

it('pin list sorting follows element replacement and mobile changes', () => {
	expect(source).toMatch(/id="pinned-menu-items-list" use:initPinnedMenuSortable=\{\$mobile\}/);
	const instances: { node: object; destroy: ReturnType<typeof vi.fn> }[] = [];
	class Sortable {
		destroy = vi.fn();
		constructor(node: object) {
			instances.push({ node, destroy: this.destroy });
		}
	}
	const bind = evaluate(actionSource('initPinnedMenuSortable'), { Sortable }) as (
		node: object,
		isMobile: boolean
	) => { update: (isMobile: boolean) => void; destroy: () => void };
	const mobile = bind({}, true);
	mobile.destroy();
	expect(instances).toHaveLength(0);
	for (let cycle = 0; cycle < 21; cycle++) {
		const node = {};
		const action = bind(node, false);
		expect(instances.at(-1)?.node).toBe(node);
		const desktop = instances.at(-1)!;
		action.update(false);
		expect(instances.at(-1)).toBe(desktop);
		action.update(true);
		expect(desktop.destroy).toHaveBeenCalledTimes(1);
		action.update(false);
		expect(instances.at(-1)).not.toBe(desktop);
		expect(instances.at(-1)?.node).toBe(node);
		action.destroy();
	}
	instances.forEach((item) => expect(item.destroy).toHaveBeenCalledTimes(1));
});

it('reorders visible pins when a hidden item occupies the middle slot', async () => {
	let onUpdate: (event: {
		item: { dataset: { id: string } };
		newIndex: number;
	}) => Promise<void> = async () => {
		throw new Error('Not initialized');
	};
	let persisted: string[] = [];
	class Sortable {
		constructor(node: object, options: { onUpdate: typeof onUpdate }) {
			onUpdate = options.onUpdate;
		}
		destroy = vi.fn();
	}
	const context = {
		Sortable,
		pinnedItems: ['notes', 'automations', 'calendar'],
		$settings: {},
		settings: {
			set: (value: { pinnedMenuItems: string[] }) => {
				persisted = value.pinnedMenuItems;
			}
		},
		localStorage: { token: 'fixture' },
		updateUserSettings: vi.fn(),
		isMenuItemVisible: (id: string) => id !== 'automations'
	};
	const bind = evaluate(actionSource('initPinnedMenuSortable'), context) as (
		node: object,
		isMobile: boolean
	) => { destroy: () => void };
	const action = bind(
		{ children: [{ getAttribute: () => 'calendar' }, { getAttribute: () => 'notes' }] },
		false
	);
	await onUpdate({ item: { dataset: { id: 'notes' } }, newIndex: 1 });
	expect(persisted.filter((id) => id !== 'automations')).toEqual(['calendar', 'notes']);
	expect(persisted).toEqual(['calendar', 'automations', 'notes']);
	action.destroy();
});

it('touch end without a recorded start does not navigate or throw', () => {
	const declaration = parsed.statements.find(
		(s) => ts.isFunctionDeclaration(s) && s.name?.text === 'checkDirection'
	);
	if (!declaration) throw new Error('Missing actual swipe handler');
	const set = vi.fn();
	const check = evaluate(declaration.getText(parsed), {
		touchstart: undefined,
		touchend: { screenX: 100 },
		window: { innerWidth: 400 },
		showSidebar: { set }
	}) as () => void;
	expect(() => check()).not.toThrow();
	expect(set).not.toHaveBeenCalled();
});

it.each(['{}', '[null]', '[[]]', 'invalid'])(
	'invalid imported file %s never reaches the API',
	async (result) => {
		const readers: Reader[] = [];
		class Reader {
			result = result;
			onload: (() => Promise<void>) | null = null;
			readAsText = vi.fn();
			constructor() {
				readers.push(this);
			}
		}
		const error = vi.fn();
		const importChatHandler = vi.fn();
		const handler = evaluate(actionSource('inputFilesHandler'), {
			FileReader: Reader,
			console: { log: () => {} },
			toast: { error },
			$i18n: { t: (s: string) => s },
			importChatHandler
		}) as (files: object[]) => Promise<void>;
		await handler([{}]);
		const load = readers[0].onload;
		if (!load) throw new Error('Missing load handler');
		await load();
		expect(error).toHaveBeenCalledOnce();
		expect(importChatHandler).not.toHaveBeenCalled();
	}
);

it('valid imported data reaches the handler and an asynchronous failure is caught', async () => {
	let load: () => Promise<void> = async () => {};
	class Reader {
		result = '[{"chat":{"messages":[]},"meta":{"custom":"preserved"}}]';
		set onload(callback: () => Promise<void>) {
			load = callback;
		}
		readAsText = vi.fn();
	}
	const error = vi.fn();
	const importChatHandler = vi.fn().mockRejectedValue(new Error('API unavailable'));
	const handler = evaluate(actionSource('inputFilesHandler'), {
		FileReader: Reader,
		console: { log: () => {} },
		toast: { error },
		$i18n: { t: (s: string) => s },
		importChatHandler
	}) as (files: object[]) => Promise<void>;
	await handler([{}]);
	await expect(load()).resolves.toBeUndefined();
	expect(importChatHandler).toHaveBeenCalledWith([
		{ chat: { messages: [] }, meta: { custom: 'preserved' } }
	]);
	expect(error).toHaveBeenCalledOnce();
});
