// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { getFunctions } from '$lib/apis/functions';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
it.each(['network', 'JSON'])('rejects %s refusal instead of resolving null', async (kind) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => {
			if (kind === 'network') throw Error('network refused');
			return new Response('{');
		})
	);
	await expect(getFunctions('token')).rejects.toThrow();
});
it.each(['null', '{}', '"invalid"'])('rejects a non-list response: %s', async (body) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(body))
	);
	await expect(getFunctions('token')).rejects.toThrow();
});
it('preserves endpoint, authorization, bodyless GET and empty catalog', async () => {
	const fetch = vi.fn<[url: string, init: RequestInit], Promise<Response>>(
		async () => new Response('[]')
	);
	vi.stubGlobal('fetch', fetch);
	await expect(getFunctions()).resolves.toEqual([]);
	await getFunctions('token');
	expect(fetch.mock.calls[1][0]).toBe('/api/v1/functions/');
	expect(fetch.mock.calls[1][1].method).toBe('GET');
	expect(new Headers(fetch.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer token');
	expect(fetch.mock.calls[1][1]).not.toHaveProperty('body');
});
it('supports prior abort without starting a request', async () => {
	const fetch = vi.fn(),
		controller = new AbortController();
	vi.stubGlobal('fetch', fetch);
	controller.abort(Error('cancelled'));
	await expect(getFunctions('token', controller.signal)).rejects.toThrow('cancelled');
	expect(fetch).not.toHaveBeenCalled();
});
it('keeps the shared deadline active during body consumption', async () => {
	vi.useFakeTimers();
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, init: RequestInit) => ({
			ok: true,
			json: () =>
				new Promise((_resolve, reject) => {
					init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
				})
		}))
	);
	const pending = expect(getFunctions('token')).rejects.toThrow('timed out');
	await vi.advanceTimersByTimeAsync(60_000);
	await pending;
	expect(vi.getTimerCount()).toBe(0);
});

const consumers = [
	'src/routes/(app)/admin/functions/create/+page.svelte',
	'src/routes/(app)/admin/functions/edit/+page.svelte',
	'src/lib/components/chat/Chat.svelte',
	'src/lib/components/workspace/Models/ModelEditor.svelte',
	'src/lib/components/chat/Controls/Valves.svelte'
];
// Execute the actual complete catalog statement, including its rejection handler.
const statement = (file: string): string => {
	const source = readFileSync(`${process.env.CATALOG_SOURCE_ROOT ?? '.'}/${file}`, 'utf8');
	const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
	const ast = ts.createSourceFile('consumer.ts', script, ts.ScriptTarget.Latest, true);
	let found = '';
	const visit = (node: ts.Node): void => {
		if (
			ts.isExpressionStatement(node) &&
			/^(?:await |functions\.set\().*?getFunctions\(/s.test(node.getText(ast))
		) {
			found = node.getText(ast);
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(ast);
	if (!found) throw Error(`Missing catalog statement: ${file}`);
	return found;
};
it.each(consumers)('contains catalog refusal and preserves cached state in %s', async (file) => {
	const set = vi.fn(),
		error = vi.fn(),
		abort = new AbortController();
	const context = {
		functions: { set },
		$functions: [{ id: 'cached' }],
		getFunctions: async () => {
			throw Error('private error');
		},
		localStorage: { token: 'token' },
		toast: { error },
		$i18n: { t: (key: string) => key },
		voicesAbort: abort
	};
	const code = ts.transpileModule(`(async () => { ${statement(file)} })()`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
	await expect(runInNewContext(code, context) as Promise<unknown>).resolves.toBeUndefined();
	expect(set).not.toHaveBeenCalled();
	expect(error).toHaveBeenCalledTimes(1);
	expect(error.mock.calls[0][0]).not.toContain('private');
});
it.each(consumers)('publishes an accepted catalog in %s', async (file) => {
	const set = vi.fn(),
		error = vi.fn(),
		items = [{ id: 'accepted' }];
	const context = {
		functions: { set },
		$functions: null,
		getFunctions: async () => items,
		localStorage: { token: 'token' },
		toast: { error },
		$i18n: { t: (key: string) => key },
		voicesAbort: new AbortController()
	};
	const code = ts.transpileModule(`(async () => { ${statement(file)} })()`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
	await runInNewContext(code, context);
	expect(set).toHaveBeenCalledWith(items);
	expect(error).not.toHaveBeenCalled();
});

it('ignores a late model-editor catalog after its existing lifetime is cancelled', async () => {
	const set = vi.fn(),
		error = vi.fn(),
		controller = new AbortController();
	const context = {
		functions: { set },
		voicesAbort: controller,
		localStorage: { token: 'token' },
		getFunctions: async () => {
			controller.abort();
			return [];
		},
		toast: { error },
		$i18n: { t: (key: string) => key }
	};
	const code = ts.transpileModule(`(async () => { ${statement(consumers[3])} })()`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
	await runInNewContext(code, context);
	expect(set).not.toHaveBeenCalled();
	expect(error).not.toHaveBeenCalled();
});
