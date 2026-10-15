// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import * as functionsAPI from '$lib/apis/functions';
import { parseFunctionImport } from './function_import';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));

const item = {
	id: 'test',
	name: 'Test',
	content: 'code',
	meta: {},
	type: 'filter',
	is_active: false,
	is_global: false
};
const rig = () => {
	const source = readFileSync(
		process.env.FUNCTION_SOURCE ?? 'src/lib/components/admin/Functions.svelte',
		'utf8'
	);
	const script = parse(source).instance!;
	const parsed = ts.createSourceFile(
		'functions.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const code = parsed.statements
		.filter((s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s))
		.map((s) => s.getText(parsed))
		.join('\n');
	const mount: (() => unknown)[] = [],
		destroy: (() => void)[] = [];
	const listeners = new Map<string, Set<unknown>>();
	const jobs: Promise<unknown>[] = [];
	const errors: string[] = [],
		successes: string[] = [];
	const create = vi.fn<[token: string, payload: object], Promise<typeof item>>(async () => ({
		...item
	}));
	const list = vi.fn(async () => [{ ...item }]);
	const remove = vi.fn(async () => true);
	const toggle = vi.fn(async () => ({ ...item, is_active: true }));
	const global = vi.fn(async () => ({ ...item, is_global: true }));
	const models = vi.fn(async () => []);
	const oldImport = source.match(
		/on:confirm=\{(\(\) => \{\n\t\t\tconst reader[\s\S]+?)\}\n\t>/
	)?.[1];
	const context = {
		parseFunctionImport,
		AbortController,
		Error,
		setTimeout,
		clearTimeout,
		dayjs: { extend: () => undefined },
		relativeTime: {},
		getContext: () => ({}),
		$i18n: { t: (s: string) => s },
		fileSaver: { saveAs: vi.fn() },
		localStorage: { token: 'current' },
		$user: { id: 'user' },
		$config: {},
		$settings: {},
		toast: { error: (s: string) => errors.push(s), success: (s: string) => successes.push(s) },
		getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
		createNewFunction: create,
		getFunctionList: list,
		deleteFunctionById: remove,
		toggleFunctionById: toggle,
		toggleGlobalById: global,
		getFunctions: vi.fn(async () => []),
		getModels: models,
		_functions: { set: vi.fn() },
		models: { set: vi.fn() },
		onMount: (fn: () => unknown) => mount.push(fn),
		onDestroy: (fn: () => void) => destroy.push(fn),
		tick: async () => undefined,
		window: {
			addEventListener: (name: string, fn: unknown) => {
				if (!listeners.has(name)) listeners.set(name, new Set());
				listeners.get(name)!.add(fn);
			},
			removeEventListener: (name: string, fn: unknown) => listeners.get(name)?.delete(fn)
		},
		console: { log: () => undefined },
		FileReader: class {
			onload!: (e: { target: { result: string } }) => Promise<void>;
			readAsText(file: { text: () => Promise<string> }): void {
				const job = file.text().then((result) => this.onload({ target: { result } }));
				void job.catch(() => undefined);
				jobs.push(job);
			}
		}
	};
	const api = runInNewContext(
		ts.transpileModule(
			code +
				`\n({remove:deleteHandler,global:toggleGlobalHandler,active:typeof toggleActiveHandler === 'undefined' ? null : toggleActiveHandler,importFile:typeof importHandler === 'undefined' ? ${oldImport ?? 'null'} : importHandler,setFile:(f)=>{importFiles=[f]; functionsImportInputElement={value:'selected'};},items:()=>functions,setItems:(v)=>functions=v,loaded:()=>loaded})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		remove: (v: typeof item) => Promise<void>;
		global: (v: typeof item) => Promise<void>;
		active: ((v: typeof item) => Promise<void>) | null;
		importFile: () => Promise<void> | void;
		setFile: (v: { text: () => Promise<string> }) => void;
		items: () => (typeof item)[];
		setItems: (v: (typeof item)[]) => void;
		loaded: () => boolean;
	};
	const cleanup: (() => void)[] = [];
	return {
		api,
		context,
		create,
		list,
		remove,
		toggle,
		global,
		models,
		errors,
		successes,
		listeners,
		mount: () => {
			for (const fn of mount) {
				const result = fn();
				if (typeof result === 'function') cleanup.push(result as () => void);
			}
		},
		destroy: () => {
			cleanup.forEach((fn) => fn());
			destroy.forEach((fn) => fn());
		},
		import: async (text: string) => {
			api.setFile({ text: async () => text });
			await api.importFile();
			await Promise.all(jobs);
		}
	};
};
const deferred = <T>() => {
	let resolve!: (v: T) => void;
	const promise = new Promise<T>((fn) => {
		resolve = fn;
	});
	return { promise, resolve };
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
it('removes all keyboard listeners at destruction', async () => {
	const r = rig();
	r.mount();
	await setImmediate();
	r.destroy();
	expect([...r.listeners.values()].reduce((n, v) => n + v.size, 0)).toBe(0);
});
it('does not register listeners or mark loaded after destruction during load', async () => {
	const r = rig(),
		d = deferred<(typeof item)[]>();
	r.list.mockImplementation(() => d.promise);
	r.mount();
	r.destroy();
	d.resolve([{ ...item }]);
	await setImmediate();
	expect([...r.listeners.values()].reduce((n, v) => n + v.size, 0)).toBe(0);
	expect(r.api.loaded()).toBe(false);
});
it('uses the accepted global flag from the server', async () => {
	const r = rig(),
		func = { ...item };
	r.api.setItems([func]);
	r.global.mockResolvedValue({ ...item, is_global: false });
	// The previous template bound this field before calling the handler.
	if (process.env.FUNCTION_SOURCE) func.is_global = true;
	await r.api.global(func);
	expect(r.api.items()[0].is_global).toBe(false);
});
it('contains a refresh refusal after an accepted delete', async () => {
	const r = rig();
	r.api.setItems([{ ...item }]);
	r.models.mockRejectedValue(Error('refresh refused'));
	await expect(r.api.remove(item)).resolves.toBeUndefined();
	expect(r.api.items()).toEqual([]);
	expect(r.errors).toHaveLength(1);
});
it('contains a catalog refusal after an accepted delete without clearing either store', async () => {
	const r = rig();
	r.api.setItems([{ ...item }]);
	r.context.getFunctions.mockRejectedValue(Error('catalog refused'));
	await expect(r.api.remove(item)).resolves.toBeUndefined();
	expect(r.remove).toHaveBeenCalledTimes(1);
	expect(r.api.items()).toEqual([]);
	expect(r.context._functions.set).not.toHaveBeenCalled();
	expect(r.context.models.set).not.toHaveBeenCalled();
	expect(r.errors).toEqual(['catalog refused']);
});
it('never reports complete success after a refused import', async () => {
	const r = rig();
	r.create.mockRejectedValue(Error('save refused'));
	await r.import(JSON.stringify([item])).catch(() => undefined);
	expect(r.successes).toEqual([]);
	expect(r.errors).toEqual(['save refused']);
});
it('validates every import entry before the first write', async () => {
	const r = rig();
	await r.import(JSON.stringify([item, { ...item, id: 'bad-id' }])).catch(() => undefined);
	expect(r.create).not.toHaveBeenCalled();
	expect(r.successes).toEqual([]);
	expect(r.errors).toHaveLength(1);
});
it('does not start import after a late file read at destruction', async () => {
	const r = rig(),
		d = deferred<string>();
	r.api.setFile({ text: () => d.promise });
	const pending = r.api.importFile();
	r.destroy();
	d.resolve(JSON.stringify([item]));
	await pending;
	await setImmediate();
	expect(r.create).not.toHaveBeenCalled();
});
const calls: [string, () => Promise<unknown>][] = [
	['create', () => functionsAPI.createNewFunction('token', item)],
	['list', () => functionsAPI.getFunctionList('token')],
	['load URL', () => functionsAPI.loadFunctionByUrl('token', 'https://example.test')],
	['export', () => functionsAPI.exportFunctions('token')],
	['get', () => functionsAPI.getFunctionById('token', 'test')],
	['update', () => functionsAPI.updateFunctionById('token', 'test', item)],
	['delete', () => functionsAPI.deleteFunctionById('token', 'test')],
	['toggle', () => functionsAPI.toggleFunctionById('token', 'test')],
	['global', () => functionsAPI.toggleGlobalById('token', 'test')]
];
it.each(calls)('rejects a network refusal for %s', async (_name, call) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => {
			throw Error('network refused');
		})
	);
	await expect(call()).rejects.toThrow('network refused');
});

it('preserves a refused active flag and blocks overlapping actions for one id', async () => {
	const r = rig(),
		d = deferred<typeof item>();
	r.api.setItems([{ ...item }]);
	r.toggle.mockImplementation(() => d.promise);
	const first = r.api.active!(item);
	await r.api.global(item);
	await r.api.remove(item);
	expect(r.global).not.toHaveBeenCalled();
	expect(r.remove).not.toHaveBeenCalled();
	d.resolve({ ...item, is_active: false });
	await first;
	expect(r.api.items()[0].is_active).toBe(false);
	r.toggle.mockRejectedValue(Error('refused'));
	await r.api.active!(item);
	expect(r.api.items()[0].is_active).toBe(false);
	expect(r.errors).toEqual(['refused']);
});
it('stops a partial import on refusal and reports no complete success', async () => {
	const r = rig();
	r.create.mockResolvedValueOnce({ ...item }).mockRejectedValueOnce(Error('refused'));
	await r.import(JSON.stringify([item, { ...item, id: 'second' }, { ...item, id: 'third' }]));
	expect(r.create).toHaveBeenCalledTimes(2);
	expect(r.successes).toEqual([]);
	expect(r.errors).toHaveLength(1);
});
it('contains invalid JSON and file read failures', async () => {
	const r = rig();
	await r.import('{');
	r.api.setFile({
		text: async () => {
			throw Error('file refused');
		}
	});
	await r.api.importFile();
	expect(r.create).not.toHaveBeenCalled();
	expect(r.errors).toHaveLength(2);
});
it('preserves bodyless POST and DELETE methods and encodes ids', async () => {
	const fetch = vi.fn(async () => new Response('null', { status: 200 }));
	vi.stubGlobal('fetch', fetch);
	await functionsAPI.toggleFunctionById('token', 'a/b');
	await functionsAPI.toggleGlobalById('token', 'test');
	await functionsAPI.deleteFunctionById('token', 'test');
	expect(fetch.mock.calls.map((c) => (c as unknown as [string, RequestInit])[1].method)).toEqual([
		'POST',
		'POST',
		'DELETE'
	]);
	expect(
		fetch.mock.calls.every((c) => !('body' in (c as unknown as [string, RequestInit])[1]))
	).toBe(true);
	expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[0]).toContain('a%2Fb');
});
it('keeps the deadline active during JSON consumption and supports cancellation', async () => {
	vi.useFakeTimers();
	let signal!: AbortSignal;
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, init: RequestInit) => {
			signal = init.signal!;
			return {
				ok: true,
				json: () =>
					new Promise((resolve, reject) => {
						signal.addEventListener('abort', () => reject(signal.reason), { once: true });
					})
			};
		})
	);
	const timed = functionsAPI.getFunctionList('token');
	const timedAssertion = expect(timed).rejects.toThrow('timed out');
	await vi.advanceTimersByTimeAsync(60_000);
	await timedAssertion;
	const controller = new AbortController();
	const cancelled = functionsAPI.getFunctionList('token', controller.signal);
	const cancelAssertion = expect(cancelled).rejects.toThrow('cancelled');
	await vi.advanceTimersByTimeAsync(0);
	controller.abort(Error('cancelled'));
	await cancelAssertion;
	expect(vi.getTimerCount()).toBe(0);
});

it('imports a valid file and refreshes the accepted records', async () => {
	const r = rig();
	await r.import(JSON.stringify([item]));
	expect(r.create).toHaveBeenCalledTimes(1);
	expect(r.successes).toEqual(['Functions imported successfully']);
	expect(r.errors).toEqual([]);
	expect(r.list).toHaveBeenCalledTimes(1);
});
