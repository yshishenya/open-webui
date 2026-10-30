// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const source = readFileSync('src/routes/+layout.svelte', 'utf8');
const instance = parse(source).instance!;
const ast = ts.createSourceFile(
	'layout.js',
	source.slice(instance.content.start, instance.content.end),
	ts.ScriptTarget.Latest,
	true
);
function callback(name: string): string {
	for (const node of ast.statements)
		if (
			ts.isExpressionStatement(node) &&
			ts.isCallExpression(node.expression) &&
			node.expression.expression.getText(ast) === name
		)
			return node.expression.arguments[0].getText(ast);
	throw new Error('Missing actual ' + name);
}
it.each(['resolve', 'reject'] as const)(
	'root teardown releases listeners and fetch ownership before a late config %s',
	async (mode) => {
		let resolve!: (value: object) => void, reject!: (error: Error) => void;
		const waiting = new Promise<object>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		const originalFetch = vi.fn(async () => ({ status: 200 }));
		const window = {
			fetch: originalFetch,
			innerWidth: 1000,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		};
		const document = {
			visibilityState: 'hidden',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		};
		const unsubscribe = vi.fn(),
			set = vi.fn();
		const context = {
			rootDestroyed: false,
			rootCleanups: [] as (() => void)[],
			window,
			document,
			localStorage: { locale: 'en' },
			$user: null,
			$socket: null,
			$page: { url: new URL('https://fixture.test/c/one') },
			BroadcastChannel: undefined,
			bc: null,
			tokenTimer: null,
			BREAKPOINT: 768,
			windowMessageEventHandler: vi.fn(),
			theme: { set },
			mobile: { set },
			user: { subscribe: () => unsubscribe },
			clearDisconnectToastTimer: vi.fn(),
			initI18n: vi.fn(),
			isPublicMarketingRoute: () => false,
			getBackendConfig: () => waiting,
			config: { set },
			WEBUI_NAME: { set },
			chatEventHandler: vi.fn(),
			channelEventHandler: vi.fn(),
			console: { log: vi.fn(), error: vi.fn() },
			clearInterval: vi.fn()
		};
		const api = runInNewContext(
			`({mount:${callback('onMount')},destroy:${callback('onDestroy')}})`,
			context
		) as { mount: () => Promise<void>; destroy: () => void };
		const pending = api.mount();
		expect(window.fetch).not.toBe(originalFetch);
		expect(window.addEventListener).toHaveBeenCalledTimes(4);
		expect(document.addEventListener).toHaveBeenCalledTimes(4);
		api.destroy();
		expect(window.fetch).toBe(originalFetch);
		expect(unsubscribe).toHaveBeenCalledOnce();
		expect(window.removeEventListener.mock.calls).toEqual(
			window.addEventListener.mock.calls.toReversed()
		);
		expect(document.removeEventListener.mock.calls).toEqual(
			document.addEventListener.mock.calls.toReversed()
		);
		set.mockClear();
		if (mode === 'resolve') resolve({ name: 'late' });
		else reject(new Error('late'));
		await expect(pending).resolves.toBeUndefined();
		expect(set).not.toHaveBeenCalled();
	}
);
