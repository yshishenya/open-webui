// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { executeToolServer } from '$lib/apis';
vi.mock('$lib/constants', () => ({ WEBUI_BASE_URL: '' }));
const server = (method = 'post') => ({
	openapi: {
		paths: {
			'/file/{id}': {
				parameters: [
					{ name: 'id', in: 'path' },
					{ name: 'q', in: 'path' }
				],
				'x-ignore': { operationId: 'write_file' },
				[method]: {
					operationId: 'write_file',
					parameters: [{ name: 'q', in: 'query' }],
					requestBody: { content: {} }
				}
			}
		}
	},
	info: {},
	specs: []
});
const call = (headers?: Record<string, string>, signal?: AbortSignal) =>
	(executeToolServer as (...args: unknown[]) => Promise<unknown>)(
		'fixture',
		'https://tool.invalid',
		'write_file',
		{ id: 'a/b', q: 'x y' },
		server(),
		'chat',
		headers,
		signal
	);
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
	vi.restoreAllMocks();
});
it('passes custom headers, bearer and session while keeping operation parameter override', async () => {
	const fetcher = vi.fn<[string, RequestInit], Promise<Response>>(
		async () =>
			new Response('{"path":"/saved"}', {
				headers: { 'Content-Type': 'application/json', 'X-Result': 'ok' }
			})
	);
	vi.stubGlobal('fetch', fetcher);
	expect(await call({ 'X-Custom': 'yes' })).toEqual([
		{ path: '/saved' },
		{ 'content-type': 'application/json', 'x-result': 'ok' }
	]);
	expect(fetcher.mock.calls[0]?.[0]).toBe('https://tool.invalid/file/a%2Fb?q=x+y');
	const options = (fetcher.mock.calls as unknown as [string, RequestInit][])[0]?.[1];
	expect(new Headers(options?.headers).get('X-Custom')).toBe('yes');
	expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer fixture');
	expect(new Headers(options?.headers).get('X-Session-Id')).toBe('chat');
	expect(options?.body).toBe('{"id":"a/b","q":"x y"}');
});
it('does not publish or log a raw failed response body', async () => {
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('private-fixture', { status: 403 }))
	);
	const result = await call();
	expect(JSON.stringify(result)).not.toContain('private-fixture');
	expect(JSON.stringify(log.mock.calls)).not.toContain('private-fixture');
	expect(result).toEqual([{ error: 'Tool request failed (403).' }, null]);
});
it('aborts a pending request at 60 seconds, without retry', async () => {
	vi.useFakeTimers();
	const fetcher = vi.fn(
		(_url: string, opts: RequestInit) =>
			new Promise<Response>((_resolve, reject) =>
				opts.signal?.addEventListener('abort', () => reject(opts.signal?.reason))
			)
	);
	vi.stubGlobal('fetch', fetcher);
	const pending = call();
	await vi.advanceTimersByTimeAsync(60_000);
	expect((fetcher.mock.calls[0]?.[1].signal as AbortSignal | undefined)?.aborted).toBe(true);
	expect(await pending).toEqual([{ error: 'Tool request timed out.' }, null]);
	expect(fetcher).toHaveBeenCalledOnce();
	expect(vi.getTimerCount()).toBe(0);
});
it('does not start an already cancelled execution', async () => {
	const controller = new AbortController();
	controller.abort();
	const fetcher = vi.fn();
	vi.stubGlobal('fetch', fetcher);
	expect(await call(undefined, controller.signal)).toEqual([
		{ error: 'Tool request cancelled.' },
		null
	]);
	expect(fetcher).not.toHaveBeenCalled();
});
it.each([
	['text/plain', 'hello', 'hello'],
	[
		'application/octet-stream',
		new Uint8Array([0, 255]),
		'data:application/octet-stream;base64,AP8='
	]
])('keeps %s response encoding', async (type, body, expected) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(body, { headers: { 'Content-Type': type } }))
	);
	expect(await call()).toEqual([expected, { 'content-type': type }]);
});
const layout = (result: unknown, reject = false) => {
	const source = readFileSync('src/routes/+layout.svelte', 'utf8');
	const instance = parse(source).instance!;
	const ast = ts.createSourceFile(
		'layout.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const statements = ast.statements.filter(
		(s) =>
			ts.isVariableStatement(s) &&
			s.declarationList.declarations.some((d) =>
				['resolveToolServer', 'executeTool'].includes(d.name.getText(ast))
			)
	);
	const script = statements.map((s) => s.getText(ast)).join('\n');
	const logs = { log: vi.fn(), error: vi.fn() };
	const callback = vi.fn();
	const display = vi.fn();
	const setDir = vi.fn();
	const execute = vi.fn<unknown[], Promise<unknown>>(async () => {
		if (reject) throw new Error('private-fixture');
		return result;
	});
	const fn = runInNewContext(
		ts.transpileModule(script + '\nexecuteTool', {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		{
			$settings: {
				toolServers: [
					{ url: 'https://tool.invalid', key: 'private-fixture', headers: { 'X-Custom': 'yes' } }
				]
			},
			$toolServers: [server()],
			$terminalServers: [],
			localStorage: { token: 'fixture' },
			executeToolServer: execute,
			console: logs,
			structuredClone,
			displayFileHandler: display,
			showControls: {},
			showFileNavPath: {},
			showFileNavDir: { set: setDir }
		}
	) as (data: object, cb: typeof callback, chatId: string) => Promise<void>;
	return { fn, callback, display, setDir, logs, execute };
};
it('reads file UI fields from result, passes headers and does not log execution data', async () => {
	const r = layout([{ exists: false, path: '/saved' }, { 'content-type': 'application/json' }]);
	await r.fn(
		{
			name: 'display_file',
			params: { path: '/requested' },
			server: { url: 'https://tool.invalid' }
		},
		r.callback,
		'chat'
	);
	expect(r.display).not.toHaveBeenCalled();
	await r.fn(
		{ name: 'write_file', params: { path: '/requested' }, server: { url: 'https://tool.invalid' } },
		r.callback,
		'chat'
	);
	expect(r.setDir).toHaveBeenCalledWith('/saved');
	expect(r.execute.mock.calls[0]?.[6]).toEqual({ 'X-Custom': 'yes' });
	expect(JSON.stringify(r.logs.log.mock.calls)).not.toContain('private-fixture');
	expect(r.callback).toHaveBeenCalledTimes(2);
});
it('acknowledges an unexpected executor rejection exactly once', async () => {
	const r = layout(undefined, true);
	await r
		.fn(
			{
				name: 'write_file',
				params: { path: '/requested' },
				server: { url: 'https://tool.invalid' }
			},
			r.callback,
			'chat'
		)
		.catch(() => {});
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback).toHaveBeenCalledWith([{ error: 'Tool execution failed.' }, null]);
	expect(r.setDir).not.toHaveBeenCalled();
});
it('does not open a file after an executor error', async () => {
	const r = layout([{ error: 'failed' }, null]);
	await r.fn(
		{
			name: 'display_file',
			params: { path: '/requested' },
			server: { url: 'https://tool.invalid' }
		},
		r.callback,
		'chat'
	);
	expect(r.display).not.toHaveBeenCalled();
	expect(r.callback).toHaveBeenCalledOnce();
});
it('acknowledges a successful tool result even if file display fails', async () => {
	const r = layout([{ exists: true }, { 'content-type': 'application/json' }]);
	r.display.mockImplementation(() => {
		throw new Error('fixture');
	});
	await r.fn(
		{
			name: 'display_file',
			params: { path: '/requested' },
			server: { url: 'https://tool.invalid' }
		},
		r.callback,
		'chat'
	);
	expect(r.callback).toHaveBeenCalledWith([
		{ exists: true },
		{ 'content-type': 'application/json' }
	]);
	expect(r.callback).toHaveBeenCalledOnce();
});
it('keeps JSON null responses and omits mutation bodies for GET', async () => {
	const fetcher = vi.fn<[string, RequestInit], Promise<Response>>(
		async () => new Response('null', { headers: { 'Content-Type': 'application/json' } })
	);
	vi.stubGlobal('fetch', fetcher);
	expect(
		await executeToolServer(null, 'https://tool.invalid', 'write_file', { id: 'x' }, server('get'))
	).toEqual([null, { 'content-type': 'application/json' }]);
	expect(fetcher.mock.calls[0]?.[1].body).toBeUndefined();
});
