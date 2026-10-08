// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

it.each(['before-tick', 'after-tick', 'sorting-failed'])(
	'sidebar releases owned resources: %s',
	async (order) => {
		const source = readFileSync('src/lib/components/layout/Sidebar.svelte', 'utf8');
		const instance = parse(source).instance;
		if (!instance) throw new Error('Missing sidebar script');
		const parsed = ts.createSourceFile(
			'sidebar.ts',
			source.slice(instance.content.start, instance.content.end),
			ts.ScriptTarget.Latest,
			true
		);
		const mount = parsed.statements.find(
			(s) =>
				ts.isExpressionStatement(s) &&
				ts.isCallExpression(s.expression) &&
				s.expression.expression.getText(parsed) === 'onMount'
		);
		if (!mount || !ts.isExpressionStatement(mount) || !ts.isCallExpression(mount.expression)) {
			throw new Error('Missing actual sidebar mount');
		}
		const code = ts.transpileModule(`(${mount.expression.arguments[0].getText(parsed)})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText;
		const unsubscribers: (() => void)[] = [];
		const store = (): { subscribe: () => () => void; set: () => void } => ({
			subscribe: (): (() => void) => {
				const stop = vi.fn();
				unsubscribers.push(stop);
				return stop;
			},
			set: vi.fn()
		});
		const events = (): {
			addEventListener: ReturnType<typeof vi.fn>;
			removeEventListener: ReturnType<typeof vi.fn>;
		} => ({
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		});
		const window = events();
		const dropZone = events();
		const socket = { on: vi.fn(), off: vi.fn() };
		const folderCleanup = vi.fn();
		const sortableCleanup = vi.fn();
		const initSortable = vi.fn((): (() => void) => {
			if (order === 'sorting-failed') throw new Error('Sorting unavailable');
			return sortableCleanup;
		});
		let resume: () => void = () => {
			throw new Error('Tick not ready');
		};
		const pendingTick = new Promise<void>((resolve) => {
			resume = resolve;
		});
		const errors = vi.fn();
		const context = {
			console: { error: errors },
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
			document: {
				documentElement: { style: { setProperty: vi.fn() } },
				getElementById: () => dropZone
			},
			window,
			onKeyDown: vi.fn(),
			onKeyUp: vi.fn(),
			onTouchStart: vi.fn(),
			onTouchEnd: vi.fn(),
			onFocus: vi.fn(),
			onBlur: vi.fn(),
			onDragOver: vi.fn(),
			onDrop: vi.fn(),
			onDragLeave: vi.fn(),
			chatActiveEventHandler: vi.fn(),
			refreshChatRows: vi.fn(),
			registerFolderRefreshHandler: vi.fn(() => folderCleanup),
			tick: () => pendingTick,
			initPinnedMenuSortable: initSortable
		};
		const cleanup = (runInNewContext(code, context) as () => unknown)();
		// Svelte registers only a synchronous function return as component teardown.
		expect(typeof cleanup).toBe('function');
		expect(unsubscribers).toHaveLength(4);
		expect(window.addEventListener).toHaveBeenCalledTimes(6);
		expect(dropZone.addEventListener).toHaveBeenCalledTimes(3);
		expect(socket.on).toHaveBeenCalledTimes(2);
		if (order !== 'before-tick') {
			resume();
			await pendingTick;
		}
		(cleanup as () => void)();
		if (order === 'before-tick') {
			resume();
			await pendingTick;
		}
		await Promise.resolve();
		unsubscribers.forEach((stop) => expect(stop).toHaveBeenCalledTimes(1));
		expect(window.removeEventListener.mock.calls).toEqual(window.addEventListener.mock.calls);
		expect(dropZone.removeEventListener.mock.calls).toEqual(dropZone.addEventListener.mock.calls);
		expect(socket.off.mock.calls).toEqual(socket.on.mock.calls);
		expect(folderCleanup).toHaveBeenCalledTimes(1);
		expect(initSortable).toHaveBeenCalledTimes(order === 'before-tick' ? 0 : 1);
		expect(errors).toHaveBeenCalledTimes(order === 'sorting-failed' ? 1 : 0);
		expect(sortableCleanup).toHaveBeenCalledTimes(order === 'after-tick' ? 1 : 0);
	}
);
