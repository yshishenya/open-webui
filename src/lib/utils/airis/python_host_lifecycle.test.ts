// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { PyodideSandboxHost } from '$lib/pyodide/pyodideSandboxHost';

afterEach(() => {
	vi.useRealTimers();
});

function extract(path: string, name: string): string {
	const source = readFileSync(path, 'utf8');
	const instance = path.endsWith('.svelte') ? parse(source).instance : null;
	const script = instance ? source.slice(instance.content.start, instance.content.end) : source;
	const ast = ts.createSourceFile('source.ts', script, ts.ScriptTarget.Latest, true);
	const node = ast.statements.find(
		(s) =>
			(ts.isVariableStatement(s) &&
				s.declarationList.declarations.some((d) => d.name.getText(ast) === name)) ||
			(ts.isFunctionDeclaration(s) && s.name?.text === name)
	);
	if (!node) throw new Error(`Missing actual ${name}`);
	return ts.transpileModule(`${node.getText(ast).replace(/^export /, '')}\n${name}`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
}

function setup() {
	vi.useFakeTimers();
	const listeners = { message: new Set<EventListener>(), error: new Set<EventListener>() };
	const worker = {
		postMessage: vi.fn<[{ id: string; files?: { name: string; data: ArrayBuffer }[] }], void>(),
		terminate: vi.fn(),
		addEventListener: (type: 'message' | 'error', listener: EventListener): void => {
			listeners[type].add(listener);
		},
		removeEventListener: (type: 'message' | 'error', listener: EventListener): void => {
			listeners[type].delete(listener);
		}
	};
	const create = vi.fn(() => worker);
	const fetchFile = vi.fn<[string, AbortSignal?], Promise<ArrayBuffer>>(
		async () => new ArrayBuffer(0)
	);
	const callback = vi.fn<[Record<string, unknown>], void>();
	const reset = vi.fn();
	const log = vi.fn();
	const context = {
		getOrCreateWorker: create,
		getFileContentById: fetchFile,
		$pyodideWorker: worker,
		pyodideWorker: { set: reset },
		setTimeout,
		clearTimeout,
		AbortController,
		console: { log, error: log, warn: log }
	};
	const run = runInNewContext(
		extract(
			process.env.AIRIS_PYTHON_HOST_SOURCE ?? 'src/routes/+layout.svelte',
			'executePythonAsWorker'
		),
		context
	) as (
		id: string,
		code: string,
		cb: typeof callback,
		files?: { id?: string; filename?: string }[]
	) => Promise<void>;
	const reply = (data: unknown): void => {
		for (const listener of [...listeners.message]) listener(new MessageEvent('message', { data }));
	};
	const fail = (): void => {
		for (const listener of [...listeners.error])
			listener(new ErrorEvent('error', { message: 'private fixture secret' }));
	};
	const clean = (): void => {
		expect(listeners.message.size).toBe(0);
		expect(listeners.error.size).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	};
	return {
		run,
		worker,
		listeners,
		create,
		fetchFile,
		callback,
		reset,
		log,
		reply,
		fail,
		clean,
		context
	};
}

it.each([0, false, '', 1, 'text', { value: 1 }, [0, false], 123n])(
	'preserves Python result %s and completes once',
	async (result) => {
		const r = setup();
		await r.run('rpc', 'fixture', r.callback);
		r.reply({ id: 'rpc', stdout: '', stderr: '', result });
		r.reply({ id: 'rpc', result: 'late' });
		r.fail();
		expect(r.callback).toHaveBeenCalledOnce();
		expect(r.callback.mock.calls[0][0]).toEqual({
			stdout: '',
			stderr: '',
			result: typeof result === 'bigint' ? '123' : result
		});
		r.clean();
	}
);

it.each(['create', 'send', 'worker', 'file'])(
	'%s failure returns one explicit safe error and releases listeners',
	async (mode) => {
		const r = setup();
		const privateError = new Error('private fixture secret');
		if (mode === 'create')
			r.create.mockImplementationOnce(() => {
				throw privateError;
			});
		if (mode === 'send')
			r.worker.postMessage.mockImplementationOnce(() => {
				throw privateError;
			});
		if (mode === 'file') r.fetchFile.mockRejectedValueOnce(privateError);
		await expect(
			r.run('rpc', 'fixture', r.callback, mode === 'file' ? [{ id: 'file' }] : [])
		).resolves.toBeUndefined();
		if (mode === 'worker') r.fail();
		expect(r.callback).toHaveBeenCalledOnce();
		expect(r.callback.mock.calls[0][0].stderr).toEqual(expect.any(String));
		expect(JSON.stringify(r.callback.mock.calls)).not.toContain('private fixture secret');
		expect(JSON.stringify(r.log.mock.calls)).not.toContain('private fixture secret');
		if (mode === 'file') expect(r.worker.postMessage).not.toHaveBeenCalled();
		r.clean();
	}
);

it('registers listeners before sending, including an immediate reply', async () => {
	const r = setup();
	r.worker.postMessage.mockImplementation(({ id }) => r.reply({ id, result: 0 }));
	await r.run('rpc', 'fixture', r.callback);
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback.mock.calls[0][0].result).toBe(0);
	r.clean();
});

it('ignores malformed/foreign/filesystem events and preserves other listeners', async () => {
	const r = setup(),
		foreign = vi.fn();
	r.listeners.message.add(foreign);
	await r.run('rpc', 'fixture', r.callback);
	for (const data of [null, 'invalid', { id: 'other', result: 1 }, { id: 'rpc', type: 'fs:list' }])
		expect(() => r.reply(data)).not.toThrow();
	expect(r.callback).not.toHaveBeenCalled();
	r.reply({ id: 'rpc', result: false });
	expect(r.callback).toHaveBeenCalledOnce();
	expect([...r.listeners.message]).toEqual([foreign]);
	r.listeners.message.delete(foreign);
	r.clean();
});

it('rejects an unserialisable matching result explicitly', async () => {
	const r = setup(),
		cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	await r.run('rpc', 'fixture', r.callback);
	expect(() => r.reply({ id: 'rpc', result: cyclic })).not.toThrow();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback.mock.calls[0][0].stderr).toEqual(expect.any(String));
	r.clean();
});

it('deadline covers a stalled file; late completion cannot send code or stop the shared worker', async () => {
	const r = setup();
	let release!: (buffer: ArrayBuffer) => void;
	r.fetchFile.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				release = resolve;
			})
	);
	const work = r.run('rpc', 'fixture', r.callback, [{ id: 'file', filename: 'sample.csv' }]);
	await Promise.resolve();
	vi.advanceTimersByTime(60000);
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback.mock.calls[0][0].stderr).toBe('Execution Time Limit Exceeded');
	expect(r.fetchFile.mock.calls[0][1]?.aborted).toBe(true);
	expect(r.worker.terminate).not.toHaveBeenCalled();
	release(new ArrayBuffer(0));
	await work;
	expect(r.worker.postMessage).not.toHaveBeenCalled();
	r.clean();
});

it('timeout after sending terminates only its worker and never clears a replacement', async () => {
	const r = setup();
	await r.run('rpc', 'fixture', r.callback);
	r.context.$pyodideWorker = { ...r.worker };
	vi.advanceTimersByTime(60000);
	r.reply({ id: 'rpc', result: 'late' });
	expect(r.worker.terminate).toHaveBeenCalledOnce();
	expect(r.reset).not.toHaveBeenCalled();
	expect(r.callback).toHaveBeenCalledOnce();
	r.clean();
});

it('one failed selected file prevents execution with an incomplete set', async () => {
	const r = setup();
	r.fetchFile.mockRejectedValueOnce(new Error('not available'));
	await r.run('rpc', 'fixture', r.callback, [{ id: 'missing' }, { id: 'available' }]);
	expect(r.worker.postMessage).not.toHaveBeenCalled();
	expect(r.callback).toHaveBeenCalledOnce();
	r.clean();
});

it('rejects a selected file with no id', async () => {
	const r = setup();
	await r.run('rpc', 'fixture', r.callback, [{ filename: 'unavailable' }]);
	expect(r.worker.postMessage).not.toHaveBeenCalled();
	expect(r.callback).toHaveBeenCalledOnce();
	r.clean();
});

it('passes even empty file bytes with the original file name', async () => {
	const r = setup(),
		bytes = new ArrayBuffer(0);
	r.fetchFile.mockResolvedValueOnce(bytes);
	await r.run('rpc', 'fixture', r.callback, [{ id: 'file', filename: 'sample.csv' }]);
	expect(r.worker.postMessage.mock.calls[0][0].files).toEqual([
		{ name: 'sample.csv', data: bytes }
	]);
	r.reply({ id: 'rpc', result: 0 });
	r.clean();
});

it.each(['network', 'HTTP JSON', 'HTTP HTML', 'body'])(
	'file API rejects %s instead of returning successful null',
	async (mode) => {
		const fetch = vi.fn();
		if (mode === 'network') fetch.mockRejectedValue(new TypeError('private fixture secret'));
		else
			fetch.mockResolvedValue({
				ok: mode === 'body',
				json: async () => {
					if (mode === 'HTTP HTML') throw new SyntaxError('HTML');
					return { detail: 'missing' };
				},
				arrayBuffer: async () => {
					throw new Error('body unavailable');
				}
			});
		const getFile = runInNewContext(
			extract(
				process.env.AIRIS_FILE_CONTENT_SOURCE ?? 'src/lib/apis/files/index.ts',
				'getFileContentById'
			),
			{ fetch, WEBUI_API_BASE_URL: '/api', AbortSignal, console: { error: vi.fn() } }
		) as (id: string, signal?: AbortSignal) => Promise<ArrayBuffer>;
		await expect(getFile('fixture')).rejects.toBeDefined();
	}
);

it('file API preserves credentialed empty binary download and accepts caller cancellation', async () => {
	const bytes = new ArrayBuffer(0),
		fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => bytes }));
	const getFile = runInNewContext(
		extract(
			process.env.AIRIS_FILE_CONTENT_SOURCE ?? 'src/lib/apis/files/index.ts',
			'getFileContentById'
		),
		{ fetch, WEBUI_API_BASE_URL: '/api', AbortSignal, console: { error: vi.fn() } }
	) as (id: string, signal?: AbortSignal) => Promise<ArrayBuffer>;
	const signal = new AbortController().signal;
	expect(await getFile('fixture', signal)).toBe(bytes);
	expect(fetch).toHaveBeenCalledWith(
		'/api/files/fixture/content',
		expect.objectContaining({ credentials: 'include', signal })
	);
});

it.each([true, false])('factory stop notifies all %s-persistent consumers once', (persistent) => {
	class NativeWorker extends EventTarget {
		terminate = vi.fn();
	}
	const factory = runInNewContext(
		extract('src/lib/pyodide/createPyodideWorker.ts', 'createPyodideWorker'),
		{
			get: () => ({ features: { enable_pyodide_file_persistence: persistent } }),
			config: {},
			PyodideWorker: NativeWorker,
			PyodideSandboxHost,
			ErrorEvent
		}
	) as () => Worker;
	const worker = factory();
	const first = vi.fn(() => worker.terminate()),
		second = vi.fn<[Event], void>();
	worker.addEventListener('error', first);
	worker.addEventListener('error', second);
	if (!persistent) {
		expect(document.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts');
		expect(document.querySelector('iframe')?.srcdoc).toContain('event.source !== parent');
	}
	worker.terminate();
	worker.terminate();
	expect(first).toHaveBeenCalledOnce();
	expect(second).toHaveBeenCalledOnce();
	expect((second.mock.calls[0][0] as ErrorEvent).message).toBe('Python worker stopped.');
	if (!persistent) expect(document.querySelector('iframe')).toBeNull();
});

it.each(['send', 'error', 'stderr', 'failure', 'immediate', 'timeout', 'success'])(
	'filesystem RPC handles %s and cleans only its own listeners',
	async (mode) => {
		const r = setup();
		const foreign = vi.fn();
		r.listeners.message.add(foreign);
		const send = runInNewContext(
			extract('src/lib/components/chat/PyodideFileNav.svelte', 'sendWorkerMessage'),
			{
				ensureWorker: () => r.worker,
				setTimeout,
				clearTimeout,
				crypto
			}
		) as (msg: { type: string }) => Promise<unknown>;
		if (mode === 'send')
			r.worker.postMessage.mockImplementationOnce(() => {
				throw new Error('private');
			});
		if (mode === 'immediate')
			r.worker.postMessage.mockImplementationOnce(({ id }) =>
				r.reply({ id, type: 'fs:list', entries: [] })
			);
		const work = send({ type: 'fs:list' });
		const assertion =
			mode === 'immediate' || mode === 'success'
				? expect(work).resolves.toMatchObject({ entries: [] })
				: expect(work).rejects.toBeDefined();
		const id = r.worker.postMessage.mock.calls[0][0].id;
		if (mode === 'error') r.fail();
		if (mode === 'stderr') r.reply({ id, stderr: 'initialization failed' });
		if (mode === 'failure') r.reply({ id, type: 'fs:list', success: false });
		if (mode === 'timeout') vi.advanceTimersByTime(30000);
		if (mode === 'success') r.reply({ id, type: 'fs:list', entries: [] });
		await assertion;
		expect([...r.listeners.message]).toEqual([foreign]);
		r.listeners.message.delete(foreign);
		r.clean();
	}
);
