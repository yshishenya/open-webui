// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import * as toolsAPI from '$lib/apis/tools';
import { parseCodeImport } from './function_import';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
const item = { id: 'sample', name: 'Sample', content: 'code', meta: {}, write_access: true };
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((fn) => {
		resolve = fn;
	});
	return { promise, resolve };
};
const rig = () => {
	const source = readFileSync(
		process.env.TOOL_SOURCE ?? 'src/lib/components/workspace/Tools.svelte',
		'utf8'
	);
	const ast = ts.createSourceFile(
		'tools.ts',
		source.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1],
		ts.ScriptTarget.Latest,
		true
	);
	const code = ast.statements
		.filter((n) => !ts.isImportDeclaration(n) && !ts.isLabeledStatement(n))
		.map((n) => n.getText(ast))
		.join('\n');
	const oldImport = source.match(
		/on:confirm=\{(\(\) => \{\n\t\t\tconst reader[\s\S]+?)\}\n\t>/
	)?.[1];
	const mounts: (() => unknown)[] = [],
		destroys: (() => void)[] = [],
		cleanup: (() => void)[] = [],
		jobs: Promise<unknown>[] = [];
	const listeners = new Map<string, Set<unknown>>();
	const errors: string[] = [],
		successes: string[] = [];
	const create = vi.fn<[token: string, form: object], Promise<typeof item>>(async () => ({
		...item
	}));
	const list = vi.fn(async () => [{ ...item }]),
		catalog = vi.fn(async () => [{ ...item }]),
		remove = vi.fn(async () => true),
		get = vi.fn(async () => ({ ...item }));
	const context = {
		AbortController,
		Error,
		Blob,
		setTimeout,
		clearTimeout,
		dayjs: { extend: () => undefined },
		relativeTime: {},
		getContext: () => ({}),
		$i18n: {
			t: (s: string, v?: { count: number }) => (v ? s.replace('{{count}}', String(v.count)) : s)
		},
		$user: { id: 'user' },
		$config: {},
		localStorage: { token: 'synthetic' },
		sessionStorage: { tool: '' },
		goto: vi.fn(async () => undefined),
		fileSaver: { saveAs: vi.fn() },
		getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
		parseCodeImport,
		toast: { error: (s: string) => errors.push(s), success: (s: string) => successes.push(s) },
		createNewTool: create,
		getToolList: list,
		getTools: catalog,
		deleteToolById: remove,
		getToolById: get,
		workspaceActions: { set: vi.fn() },
		_tools: { set: vi.fn() },
		onMount: (fn: () => unknown) => mounts.push(fn),
		onDestroy: (fn: () => void) => destroys.push(fn),
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
				`\n({remove:deleteHandler,clone:cloneHandler,init,importFile:typeof importHandler==='undefined'?${oldImport ?? 'null'}:importHandler,items:()=>tools,setItems:v=>tools=v,loaded:()=>loaded,setFile:f=>{importFiles=[f];toolsImportInputElement={value:'selected'};}})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		remove: (v: typeof item) => Promise<void>;
		clone: (v: typeof item) => Promise<void>;
		init: () => Promise<void>;
		importFile: () => Promise<void> | void;
		items: () => (typeof item)[];
		setItems: (v: (typeof item)[]) => void;
		loaded: () => boolean;
		setFile: (v: { text: () => Promise<string> }) => void;
	};
	return {
		api,
		context,
		create,
		list,
		catalog,
		remove,
		get,
		errors,
		successes,
		listeners,
		mount: () => {
			for (const fn of mounts) {
				const result = fn();
				if (typeof result === 'function') cleanup.push(result as () => void);
				else void Promise.resolve(result).catch(() => undefined);
			}
		},
		destroy: () => {
			cleanup.forEach((fn) => fn());
			destroys.forEach((fn) => fn());
		},
		import: async (text: string) => {
			api.setFile({ text: async () => text });
			await api.importFile();
			await Promise.all(jobs);
		}
	};
};
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
it('removes all owned keyboard listeners at destruction', async () => {
	const r = rig();
	r.mount();
	await setImmediate();
	r.destroy();
	expect([...r.listeners.values()].reduce((n, s) => n + s.size, 0)).toBe(0);
});
it('contains initialization failure and makes the section retryable', async () => {
	const r = rig();
	r.list.mockRejectedValue(Error('list refused'));
	r.mount();
	await setImmediate();
	expect(r.api.loaded()).toBe(true);
	expect(r.errors).toHaveLength(1);
	r.list.mockResolvedValue([{ ...item }]);
	await r.api.init();
	expect(r.api.items()[0].id).toBe('sample');
	r.destroy();
});
it('ignores a list result after destruction', async () => {
	const r = rig(),
		d = deferred<(typeof item)[]>();
	r.list.mockImplementation(() => d.promise);
	r.mount();
	r.destroy();
	d.resolve([{ ...item }]);
	await setImmediate();
	expect(r.api.loaded()).toBe(false);
	expect(r.api.items()).toEqual([]);
	expect([...r.listeners.values()].reduce((n, s) => n + s.size, 0)).toBe(0);
});
it('contains catalog refusal after an accepted delete without clearing the store', async () => {
	const r = rig();
	r.api.setItems([{ ...item }]);
	r.list.mockResolvedValue([]);
	r.catalog.mockRejectedValue(Error('catalog refused'));
	await expect(r.api.remove(item)).resolves.toBeUndefined();
	expect(r.api.items()).toEqual([]);
	expect(r.context._tools.set).not.toHaveBeenCalled();
	expect(r.errors).toHaveLength(1);
	expect(r.remove).toHaveBeenCalledTimes(1);
});
it('blocks two simultaneous deletes of one id', async () => {
	const r = rig(),
		d = deferred<boolean>();
	r.remove.mockImplementation(() => d.promise);
	r.list.mockResolvedValue([]);
	const first = r.api.remove(item);
	const second = r.api.remove(item);
	d.resolve(true);
	await Promise.all([first, second]);
	expect(r.remove).toHaveBeenCalledTimes(1);
});
it('never reports complete success after an import refusal', async () => {
	const r = rig();
	r.create.mockRejectedValue(Error('save refused'));
	await r.import(JSON.stringify([item])).catch(() => undefined);
	expect(r.successes).toEqual([]);
	expect(r.errors).toHaveLength(1);
});
it('validates the complete import before the first POST', async () => {
	const r = rig();
	await r.import(JSON.stringify([item, { ...item, id: 'bad-id' }])).catch(() => undefined);
	expect(r.create).not.toHaveBeenCalled();
	expect(r.successes).toEqual([]);
});
it('stops partial import after a refusal and reports partial acceptance', async () => {
	const r = rig();
	r.create.mockResolvedValueOnce({ ...item }).mockRejectedValueOnce(Error('refused'));
	await r.import(JSON.stringify([item, { ...item, id: 'second' }, { ...item, id: 'third' }]));
	expect(r.create).toHaveBeenCalledTimes(2);
	expect(r.successes).toEqual([]);
	expect(r.errors).toHaveLength(1);
	expect(r.errors[0]).toContain('1');
});
it('does not start a write after a late file read at destruction', async () => {
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
it('does not navigate or create a clone after a late result at destruction', async () => {
	const r = rig(),
		d = deferred<typeof item>();
	r.get.mockImplementation(() => d.promise);
	const pending = r.api.clone(item);
	r.destroy();
	d.resolve({ ...item });
	await pending;
	expect(r.context.goto).not.toHaveBeenCalled();
	expect(r.context.sessionStorage.tool).toBe('');
});
const calls: [string, () => Promise<unknown>][] = [
	['create', () => toolsAPI.createNewTool('token', item)],
	['catalog', () => toolsAPI.getTools('token')],
	['list', () => toolsAPI.getToolList('token')],
	['export', () => toolsAPI.exportTools('token')],
	['get', () => toolsAPI.getToolById('token', 'id')],
	['update', () => toolsAPI.updateToolById('token', 'id', item)],
	['access', () => toolsAPI.updateToolAccessGrants('token', 'id', [])],
	['delete', () => toolsAPI.deleteToolById('token', 'id')]
];
it.each(calls)('rejects network refusal: %s', async (_name, call) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => {
			throw Error('network refused');
		})
	);
	await expect(call()).rejects.toThrow('network refused');
});
it.each(calls)('rejects invalid JSON: %s', async (_name, call) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('{'))
	);
	await expect(call()).rejects.toThrow();
});

it('loads an ordinary catalog as a positive control', async () => {
	const r = rig();
	await r.api.init();
	expect(r.api.items()[0].id).toBe('sample');
	expect(r.errors).toEqual([]);
});
it('preserves empty tools catalogs as a positive control', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('[]'))
	);
	await expect(toolsAPI.getTools('token')).resolves.toEqual([]);
});

it.each(['getTools', 'getToolList', 'exportTools'] as const)(
	'rejects a null list container: %s',
	async (name) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('null'))
		);
		await expect(toolsAPI[name]('token')).rejects.toThrow('Invalid tools list');
	}
);
it('preserves request methods, encoded ids, metadata and grant semantics without retries', async () => {
	const fetch = vi.fn<[url: string, init: RequestInit], Promise<Response>>(
		async (url) => new Response(url.endsWith('/delete') ? 'true' : 'null')
	);
	vi.stubGlobal('fetch', fetch);
	const payload = { ...item, access_grants: null };
	await toolsAPI.createNewTool('token', payload);
	await toolsAPI.updateToolById('token', 'a/b', payload);
	await toolsAPI.updateToolAccessGrants('token', 'a/b', []);
	await toolsAPI.deleteToolById('token', 'a/b');
	expect(fetch.mock.calls.map((c) => c[1].method)).toEqual(['POST', 'POST', 'POST', 'DELETE']);
	expect(fetch.mock.calls.slice(1).every((c) => c[0].includes('a%2Fb'))).toBe(true);
	expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual(payload);
	expect(JSON.parse(fetch.mock.calls[2][1].body as string)).toEqual({ access_grants: [] });
	expect(fetch.mock.calls[3][1]).not.toHaveProperty('body');
	expect(new Headers(fetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer token');
});
it('supports prior abort without a request and a deadline while reading the body', async () => {
	vi.useFakeTimers();
	const controller = new AbortController(),
		fetch = vi.fn();
	vi.stubGlobal('fetch', fetch);
	controller.abort(Error('cancelled'));
	await expect(toolsAPI.getTools('token', controller.signal)).rejects.toThrow('cancelled');
	expect(fetch).not.toHaveBeenCalled();
	fetch.mockImplementation(async (_url: string, init: RequestInit) => ({
		ok: true,
		json: () =>
			new Promise((_resolve, reject) => {
				init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
			})
	}));
	const pending = expect(toolsAPI.getToolList('token')).rejects.toThrow('timed out');
	await vi.advanceTimersByTimeAsync(60_000);
	await pending;
	expect(vi.getTimerCount()).toBe(0);
});
it('does not import twice while a file is pending and contains file/JSON errors', async () => {
	const r = rig(),
		d = deferred<string>();
	r.api.setFile({ text: () => d.promise });
	const first = r.api.importFile();
	await r.api.importFile();
	d.resolve(JSON.stringify([item]));
	await first;
	expect(r.create).toHaveBeenCalledTimes(1);
	await r.import('{');
	r.api.setFile({
		text: async () => {
			throw Error('read refused');
		}
	});
	await r.api.importFile();
	expect(r.errors).toHaveLength(2);
});
it.each(['refused', 'null', 'accepted'])(
	'only confirms an accepted permission update: %s',
	async (mode) => {
		const source = readFileSync(
			process.env.TOOLKIT_SOURCE ?? 'src/lib/components/workspace/Tools/ToolkitEditor.svelte',
			'utf8'
		);
		const fn = source.match(/onChange=\{(async \(\) => \{[\s\S]*?)\}\n\/>/)![1];
		const error = vi.fn(),
			success = vi.fn();
		const run = runInNewContext(`(${fn})`, {
			edit: true,
			id: 'id',
			accessGrants: [],
			localStorage: { token: 'token' },
			$i18n: { t: (s: string) => s },
			Error,
			toast: { error, success },
			updateToolAccessGrants: async () => {
				if (mode === 'refused') throw Error('refused');
				return mode === 'null' ? null : {};
			}
		}) as () => Promise<void>;
		await run();
		expect(success).toHaveBeenCalledTimes(mode === 'accepted' ? 1 : 0);
		expect(error).toHaveBeenCalledTimes(mode === 'accepted' ? 0 : 1);
	}
);

it.each([null, false, 'true', {}])('rejects an unconfirmed delete result: %j', async (result) => {
	const fetch = vi.fn(async () => new Response(JSON.stringify(result)));
	vi.stubGlobal('fetch', fetch);
	await expect(toolsAPI.deleteToolById('token', 'id')).rejects.toThrow();
	expect(fetch).toHaveBeenCalledTimes(1);
});
