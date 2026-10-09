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
		expect(context.draggedOver).toBe(false);
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
