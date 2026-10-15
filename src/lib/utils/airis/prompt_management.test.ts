// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import * as api from '$lib/apis/prompts';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
const prompt = {
	id: 'p',
	name: 'Original',
	command: 'original',
	content: 'Text',
	tags: [],
	access_grants: [],
	version_id: 'live'
};
const entry = { id: 'old', prompt_id: 'p', snapshot: { content: '' }, created_at: 1 };
const calls: [string, () => Promise<unknown>][] = [
	['create', () => api.createNewPrompt('token', prompt)],
	['all', () => api.getPrompts('token')],
	['tags', () => api.getPromptTags('token')],
	['items', () => api.getPromptItems('token', null, null, null, null, null, 1)],
	['list', () => api.getPromptList('token')],
	['get', () => api.getPromptById('token', 'p')],
	['update', () => api.updatePromptById('token', prompt)],
	['metadata', () => api.updatePromptMetadata('token', 'p', 'Name', 'cmd')],
	['production', () => api.setProductionPromptVersion('token', 'p', 'v')],
	['toggle', () => api.togglePromptById('token', 'p')],
	['delete', () => api.deletePromptById('token', 'p')],
	['access', () => api.updatePromptAccessGrants('token', 'p', [])],
	['history', () => api.getPromptHistory('token', 'p')],
	['delete history', () => api.deletePromptHistoryVersion('token', 'p', 'v')],
	['entry', () => api.getPromptHistoryEntry('token', 'p', 'v')],
	['diff', () => api.getPromptDiff('token', 'p', 'a', 'b')]
];
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});
it.each(calls)('%s API rejects a network failure', async (_name, call) => {
	vi.spyOn(console, 'error').mockImplementation(() => undefined);
	vi.spyOn(console, 'log').mockImplementation(() => undefined);
	vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
	await expect(call()).rejects.toThrow('offline');
});
it('preserves create slash normalization and tags', async () => {
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(prompt)));
	vi.stubGlobal('fetch', fetch);
	await api.createNewPrompt('token', { ...prompt, command: '/cmd', tags: ['tag'] });
	expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ command: 'cmd', tags: ['tag'] });
});
const deferred = <T>() => {
	let resolve!: (v: T) => void;
	let reject!: (e: Error) => void;
	const promise = new Promise<T>((r, j) => {
		resolve = r;
		reject = j;
	});
	return { promise, resolve, reject };
};
const editor = () => {
	const source = readFileSync('src/lib/components/workspace/Prompts/PromptEditor.svelte', 'utf8');
	const ast = ts.createSourceFile(
		'editor.ts',
		source.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1],
		ts.ScriptTarget.Latest,
		true
	);
	const code = ast.statements
		.filter((n) => !ts.isImportDeclaration(n) && !ts.isLabeledStatement(n))
		.map((n) => n.getText(ast).replace(/^export /, ''))
		.join('\n');
	const mounts: (() => unknown)[] = [],
		destroys: (() => void)[] = [],
		cleanups: (() => void)[] = [];
	const errors: string[] = [],
		successes: string[] = [];
	const save = vi.fn<unknown[], Promise<typeof prompt | null>>(async () => ({ ...prompt }));
	const history = vi.fn<unknown[], Promise<(typeof entry)[]>>(async () => [{ ...entry }]);
	const context = {
		AbortController,
		Error,
		DOMException,
		setTimeout,
		clearTimeout,
		dayjs: Object.assign(() => ({ format: () => '' }), { extend: () => undefined }),
		localizedFormat: {},
		getContext: () => ({}),
		$i18n: { t: (s: string) => s },
		$user: {},
		localStorage: { token: 'fixture' },
		slugify: (s: string) => s.toLowerCase(),
		formatDate: () => '',
		copyToClipboard: async () => true,
		toast: { error: (s: string) => errors.push(s), success: (s: string) => successes.push(s) },
		getPromptHistory: history,
		getPromptTags: vi.fn(async () => []),
		updatePromptMetadata: save,
		setProductionPromptVersion: save,
		updatePromptAccessGrants: save,
		deletePromptHistoryVersion: vi.fn(async () => true),
		onMount: (f: () => unknown) => mounts.push(f),
		onDestroy: (f: () => void) => destroys.push(f),
		tick: async () => undefined,
		console: { log: () => undefined, error: () => undefined }
	};
	const methods = runInNewContext(
		ts.transpileModule(
			code +
				`
  prompt=${JSON.stringify(prompt)};edit=true;onSubmit=async()=>false;
  ({submit:submitHandler,history:loadHistory,production:setAsProduction,remove:handleDeleteHistory,
    metadata:debouncedSaveMetadata,access:saveAccess,setGrants:v=>accessGrants=v,setName:v=>name=v,name:()=>name,setContent:v=>content=v,
    setSubmit:v=>onSubmit=v,open:()=>{showEditModal=true;commitMessage='Draft';},
    state:()=>({loading,showEditModal,commitMessage,history,selectedHistoryEntry,prompt}),
    seed:()=>{history=[${JSON.stringify(entry)}];selectedHistoryEntry=history[0];}})
 `,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		submit: () => Promise<void>;
		history: (reset?: boolean) => Promise<void>;
		production: (e: typeof entry) => Promise<void>;
		remove: (id: string) => Promise<void>;
		metadata: () => void;
		access: () => Promise<void>;
		setGrants: (v: import('$lib/apis/tools').ToolAccessGrantInput[]) => void;
		setName: (s: string) => void;
		name: () => string;
		setContent: (s: string) => void;
		setSubmit: (f: () => Promise<boolean>) => void;
		open: () => void;
		seed: () => void;
		state: () => {
			loading: boolean;
			showEditModal: boolean;
			commitMessage: string;
			history: (typeof entry)[];
			selectedHistoryEntry: typeof entry | null;
			prompt: typeof prompt;
		};
	};
	return {
		...methods,
		context,
		save,
		fetchHistory: history,
		errors,
		successes,
		mount: async () => {
			for (const f of mounts) {
				const r = await f();
				if (typeof r === 'function') cleanups.push(r as () => void);
			}
		},
		destroy: () => {
			cleanups.forEach((f) => f());
			destroys.forEach((f) => f());
		}
	};
};
it('editor keeps the modal and message on refused submit', async () => {
	const r = editor();
	await r.mount();
	r.open();
	await r.submit();
	expect(r.state()).toMatchObject({ loading: false, showEditModal: true, commitMessage: 'Draft' });
});
it('editor prevents a repeated submit', async () => {
	const r = editor();
	await r.mount();
	const pending = deferred<boolean>();
	const save = vi.fn(() => pending.promise);
	r.setSubmit(save);
	const first = r.submit();
	await r.submit();
	expect(save).toHaveBeenCalledTimes(1);
	pending.resolve(true);
	await first;
});
it('editor preserves loaded history on refresh failure', async () => {
	const r = editor();
	await r.mount();
	r.seed();
	r.fetchHistory.mockRejectedValueOnce(new Error('offline'));
	await r.history(true);
	expect(r.state().history).toEqual([entry]);
});
it('editor refuses a null production update', async () => {
	const r = editor();
	await r.mount();
	r.save.mockResolvedValueOnce(null);
	await r.production(entry);
	expect(r.state().prompt.version_id).toBe('live');
	expect(r.successes).toEqual([]);
});
it('editor refuses an unconfirmed history deletion', async () => {
	const r = editor();
	await r.mount();
	r.seed();
	r.context.deletePromptHistoryVersion.mockResolvedValueOnce(false);
	await r.remove(entry.id);
	expect(r.state().history).toEqual([entry]);
	expect(r.successes).toEqual([]);
});
it('editor removes a confirmed deleted version even when refresh fails', async () => {
	const r = editor();
	await r.mount();
	r.seed();
	r.fetchHistory.mockRejectedValueOnce(new Error('offline'));
	await r.remove(entry.id);
	expect(r.state().history).toEqual([]);
	expect(r.state().selectedHistoryEntry).toBeNull();
});
it('editor preserves a newer draft when autosave fails', async () => {
	vi.useFakeTimers();
	const r = editor();
	await r.mount();
	const pending = deferred<typeof prompt | null>();
	r.save.mockReturnValueOnce(pending.promise);
	r.setName('Submitted');
	r.metadata();
	await vi.advanceTimersByTimeAsync(500);
	r.setName('New draft');
	r.metadata();
	pending.reject(new Error('offline'));
	await vi.advanceTimersByTimeAsync(0);
	expect(r.name()).toBe('New draft');
	r.destroy();
});
it('editor cancels deferred autosave when destroyed', async () => {
	vi.useFakeTimers();
	const r = editor();
	await r.mount();
	r.setName('Draft');
	r.metadata();
	r.destroy();
	await vi.advanceTimersByTimeAsync(600);
	expect(r.save).not.toHaveBeenCalled();
});

it.each(calls)('%s API rejects invalid JSON and contains HTTP errors', async (_name, call) => {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json')));
	await expect(call()).rejects.toBeDefined();
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'denied' }), { status: 403 }))
	);
	await expect(call()).rejects.toThrow('denied');
});
it('API preserves page shape, history page zero, null records and encoded ids', async () => {
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 })));
	vi.stubGlobal('fetch', fetch);
	expect(await api.getPromptList()).toEqual({ items: [], total: 0 });
	fetch.mockResolvedValueOnce(new Response('[]'));
	await api.getPromptHistory('t', 'p /?', 0);
	expect(fetch.mock.calls.at(-1)?.[0]).toBe('/api/v1/prompts/id/p%20%2F%3F/history?page=0');
	fetch.mockResolvedValueOnce(new Response('null'));
	expect(await api.getPromptById('t', 'p')).toBeNull();
	fetch.mockResolvedValueOnce(new Response('false'));
	await expect(api.deletePromptHistoryVersion('t', 'p', 'v')).rejects.toThrow();
	fetch.mockResolvedValueOnce(new Response('false'));
	await expect(api.deletePromptById('t', 'p')).rejects.toThrow();
	fetch.mockResolvedValueOnce(new Response('null'));
	await expect(api.getPrompts()).rejects.toThrow();
	fetch.mockResolvedValueOnce(new Response('[]'));
	await expect(api.getPromptList()).rejects.toThrow();
	fetch.mockResolvedValueOnce(new Response(JSON.stringify(prompt)));
	await api.togglePromptById('t', 'p');
	expect(fetch.mock.calls.at(-1)?.[1]).toMatchObject({ method: 'POST' });
	expect(fetch.mock.calls.at(-1)?.[1]).not.toHaveProperty('body');
});
it('editor serializes autosaves and preserves the submitted snapshot', async () => {
	vi.useFakeTimers();
	const r = editor();
	await r.mount();
	const pending = deferred<typeof prompt | null>();
	r.save.mockReturnValueOnce(pending.promise);
	r.setName('First');
	r.metadata();
	await vi.advanceTimersByTimeAsync(500);
	r.setName('Second');
	r.metadata();
	await vi.advanceTimersByTimeAsync(500);
	expect(r.save).toHaveBeenCalledTimes(1);
	pending.resolve(prompt);
	await vi.advanceTimersByTimeAsync(0);
	expect(r.save.mock.calls.map((c) => c[2])).toEqual(['First', 'Second']);
	r.destroy();
});
it('editor ignores late history and production responses after destroy', async () => {
	const r = editor();
	await r.mount();
	const pending = deferred<(typeof entry)[]>();
	r.fetchHistory.mockReturnValueOnce(pending.promise);
	const load = r.history(true);
	const write = deferred<typeof prompt | null>();
	r.save.mockReturnValueOnce(write.promise);
	const save = r.production(entry);
	r.destroy();
	pending.resolve([]);
	write.resolve({ ...prompt, version_id: 'old' });
	await Promise.all([load, save]);
	expect(r.state().history).toEqual([entry]);
	expect(r.state().prompt.version_id).toBe('live');
	expect(r.successes).toEqual([]);
});

const manager = () => {
	const source = readFileSync(
		process.env.PROMPT_MANAGER_SOURCE ?? 'src/lib/components/workspace/Prompts.svelte',
		'utf8'
	);
	const ast = ts.createSourceFile(
		'manager.ts',
		source.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1],
		ts.ScriptTarget.Latest,
		true
	);
	const code = ast.statements
		.filter((n) => !ts.isImportDeclaration(n) && !ts.isLabeledStatement(n))
		.map((n) => n.getText(ast).replace(/^export /, ''))
		.join('\n');
	const input = source.slice(source.indexOf('type="file"'));
	const legacy = input.includes('on:change={() => {')
		? input.slice(
				input.indexOf('on:change={') + 'on:change={'.length,
				input.indexOf('\n\t\t}}') + 4
			)
		: 'null';
	const jobs: Promise<unknown>[] = [];
	const mounts: (() => unknown)[] = [],
		destroys: (() => void)[] = [],
		cleanups: (() => void)[] = [];
	const listeners = new Map<string, Set<unknown>>();
	const errors: string[] = [],
		successes: string[] = [];
	const list = vi.fn<unknown[], Promise<{ items: (typeof prompt)[]; total: number }>>(async () => ({
		items: [{ ...prompt }],
		total: 1
	}));
	const create = vi.fn<unknown[], Promise<typeof prompt | null>>(async () => ({ ...prompt }));
	const toggle = vi.fn<unknown[], Promise<(typeof prompt & { is_active: boolean }) | null>>(
		async () => ({ ...prompt, is_active: false })
	);
	const remove = vi.fn<unknown[], Promise<boolean>>(async () => true);
	const context = {
		FileReader: class {
			onload!: (e: { target: { result: string } }) => Promise<void> | void;
			readAsText(file: { text: () => Promise<string> }): void {
				const job = file.text().then((result) => this.onload({ target: { result } }));
				void job.catch(() => undefined);
				jobs.push(job);
			}
		},
		AbortController,
		Error,
		Blob,
		setTimeout,
		clearTimeout,
		Element: class {},
		dayjs: { extend: () => undefined },
		relativeTime: {},
		fileSaver: { saveAs: vi.fn() },
		getContext: () => ({}),
		$i18n: {
			t: (s: string, v?: { count: number }) => (v ? s.replace('{{count}}', String(v.count)) : s)
		},
		$user: {},
		localStorage: { token: 'fixture' },
		sessionStorage: { prompt: '', removeItem: () => undefined },
		goto: vi.fn(async () => undefined),
		toast: { error: (s: string) => errors.push(s), success: (s: string) => successes.push(s) },
		getPromptItems: list,
		getPromptTags: vi.fn(async () => ['tag']),
		createNewPrompt: create,
		togglePromptById: toggle,
		deletePromptById: remove,
		parsePromptImport,
		slugify: (s: string) => s.toLowerCase(),
		copyToClipboard: async () => true,
		workspaceActions: { set: vi.fn() },
		onMount: (f: () => unknown) => mounts.push(f),
		onDestroy: (f: () => void) => destroys.push(f),
		tick: async () => undefined,
		window: {
			location: { origin: 'https://local.test' },
			addEventListener: (n: string, f: unknown) => {
				if (!listeners.has(n)) listeners.set(n, new Set());
				listeners.get(n)!.add(f);
			},
			removeEventListener: (n: string, f: unknown) => listeners.get(n)?.delete(f)
		},
		console: { log: () => undefined, error: () => undefined }
	};
	const methods = runInNewContext(
		ts.transpileModule(
			code +
				`
  loaded=true;prompts=[${JSON.stringify(prompt)}];
  ({load:getPromptList,remove:deleteHandler,create:createPromptHandler,
   toggle:typeof toggleHandler==='undefined'?async p=>{togglePromptById(localStorage.token,p.id);}:toggleHandler,
   importFile:typeof importHandler==='undefined'?${legacy}:importHandler,
   setFile:f=>{importFiles=[f];promptsImportInputElement={value:'selected'};},
   items:()=>prompts,tags:()=>tags,loading:()=>loading,
   setQuery:v=>query=v})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		load: () => Promise<void>;
		remove: (p: typeof prompt) => Promise<void>;
		create: (p: typeof prompt) => Promise<boolean>;
		toggle: (p: typeof prompt) => Promise<void>;
		importFile: () => Promise<void>;
		setFile: (f: { text: () => Promise<string> }) => void;
		items: () => (typeof prompt & { is_active?: boolean })[];
		tags: () => string[];
		loading: () => boolean;
		setQuery: (s: string) => void;
	};
	return {
		...methods,
		context,
		list,
		createApi: create,
		toggleApi: toggle,
		removeApi: remove,
		errors,
		successes,
		listeners,
		mount: () => {
			for (const f of mounts) {
				const r = f();
				if (typeof r === 'function') cleanups.push(r as () => void);
			}
		},
		destroy: () => {
			cleanups.forEach((f) => f());
			destroys.forEach((f) => f());
		},
		import: async (text: string) => {
			methods.setFile({ text: async () => text });
			await methods.importFile();
			await Promise.all(jobs);
		}
	};
};
import { parsePromptImport } from './prompt_import';
it('manager keeps the newest list and loaded tags on errors', async () => {
	const r = manager();
	const stale = deferred<{ items: (typeof prompt)[]; total: number }>();
	r.list.mockReturnValueOnce(stale.promise);
	const first = r.load();
	r.list.mockResolvedValueOnce({ items: [{ ...prompt, name: 'New' }], total: 1 });
	await r.load();
	stale.resolve({ items: [], total: 0 });
	await first;
	expect(r.items()[0].name).toBe('New');
	r.context.getPromptTags.mockRejectedValueOnce(new Error('offline'));
	await r.load();
	expect(r.tags()).toEqual(['tag']);
});
it('manager preserves confirmed deletion/toggle through refresh failure', async () => {
	const r = manager();
	r.list.mockRejectedValueOnce(new Error('offline'));
	await r.remove(prompt);
	expect(r.items()).toEqual([]);
	const s = manager();
	s.list.mockRejectedValueOnce(new Error('offline'));
	await s.toggle(prompt);
	expect(s.items()[0].is_active).toBe(false);
});
it('manager contains toggle refusal and prevents repeated writes', async () => {
	const r = manager();
	const write = deferred<(typeof prompt & { is_active: boolean }) | null>();
	r.toggleApi.mockReturnValueOnce(write.promise);
	const first = r.toggle(prompt);
	await r.toggle(prompt);
	await r.remove(prompt);
	expect(r.toggleApi).toHaveBeenCalledTimes(1);
	expect(r.removeApi).not.toHaveBeenCalled();
	write.resolve(null);
	await first;
	expect(r.items()[0].is_active).not.toBe(false);
	expect(r.errors).toHaveLength(1);
});
it('manager stops partial import and reports the accepted count', async () => {
	const r = manager();
	r.createApi.mockResolvedValueOnce(prompt).mockResolvedValueOnce(null);
	await r.import(
		JSON.stringify([prompt, { ...prompt, command: 'two' }, { ...prompt, command: 'three' }])
	);
	expect(r.createApi).toHaveBeenCalledTimes(2);
	expect(r.errors[0]).toContain('Imported 1 prompts');
	expect(r.successes).toEqual([]);
});
it('manager validates the whole import before writing and preserves metadata', async () => {
	const r = manager();
	await r.import(JSON.stringify([prompt, { ...prompt, tags: [1] }]));
	expect(r.createApi).not.toHaveBeenCalled();
	await r.import(
		JSON.stringify({ ...prompt, meta: { custom: 1 }, data: { key: 'value' }, access_grants: null })
	);
	expect(r.createApi.mock.calls[0][1]).toMatchObject({
		meta: { custom: 1 },
		data: { key: 'value' },
		access_grants: null
	});
});
it('manager ignores late file and list completion after destroy', async () => {
	const r = manager();
	const pending = deferred<string>();
	r.setFile({ text: () => pending.promise });
	const file = r.importFile();
	const list = deferred<{ items: (typeof prompt)[]; total: number }>();
	r.list.mockReturnValueOnce(list.promise);
	const load = r.load();
	r.destroy();
	pending.resolve(JSON.stringify(prompt));
	list.resolve({ items: [], total: 0 });
	await Promise.all([file, load]);
	expect(r.items()).toEqual([prompt]);
	expect(r.createApi).not.toHaveBeenCalled();
	expect(r.errors).toEqual([]);
});
it('manager removes owned listeners on destroy', () => {
	const r = manager();
	r.mount();
	expect([...r.listeners.values()].reduce((n, s) => n + s.size, 0)).toBe(4);
	r.destroy();
	expect([...r.listeners.values()].reduce((n, s) => n + s.size, 0)).toBe(0);
});
it('manager returns explicit acceptance to the editor', async () => {
	const r = manager();
	r.createApi.mockResolvedValueOnce(null);
	expect(await r.create(prompt)).toBe(false);
	expect(await r.create(prompt)).toBe(true);
});
it('prompt import preserves absent/null/empty/populated grants and legacy title', () => {
	for (const grants of [
		undefined,
		null,
		[],
		[{ principal_type: 'anyone', principal_id: '*', permission: 'read' }]
	]) {
		const parsed = parsePromptImport(
			JSON.stringify({
				title: 'Legacy',
				command: '/old',
				content: '',
				access_grants: grants,
				tags: ['tag', null],
				meta: null
			})
		)[0];
		expect(parsed).toMatchObject({
			name: 'Legacy',
			command: '/old',
			content: '',
			meta: null,
			tags: ['tag', null]
		});
		expect(parsed.access_grants).toEqual(grants);
	}
	expect(() =>
		parsePromptImport(JSON.stringify([prompt, { ...prompt, command: '/original' }]))
	).toThrow('duplicate');
	expect(() =>
		parsePromptImport(JSON.stringify({ ...prompt, access_grants: [{ permission: 'admin' }] }))
	).toThrow();
});

it('editor serializes access changes and contains refusals without reporting success', async () => {
	const r = editor();
	await r.mount();
	const first = deferred<typeof prompt | null>();
	r.save.mockReturnValueOnce(first.promise);
	r.setGrants([{ principal_type: 'user', principal_id: 'one', permission: 'read' }]);
	const a = r.access();
	await Promise.resolve();
	r.setGrants([{ principal_type: 'user', principal_id: 'two', permission: 'write' }]);
	const b = r.access();
	expect(r.save).toHaveBeenCalledTimes(1);
	first.resolve(null);
	await a;
	await b;
	expect(
		r.save.mock.calls.map((c) => (c[2] as { principal_id: string }[])[0].principal_id)
	).toEqual(['one', 'two']);
	expect(r.errors).toHaveLength(1);
	expect(r.successes).toHaveLength(1);
});
it('manager failure keeps the list unknown and allows retry', async () => {
	const r = manager();
	r.list.mockRejectedValueOnce(new Error('offline'));
	await r.load();
	expect(r.items()).toEqual([prompt]);
	expect(r.loading()).toBe(false);
	await r.load();
	expect(r.items()[0]).toMatchObject(prompt);
});
