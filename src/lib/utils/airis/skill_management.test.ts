// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import * as api from '$lib/apis/skills';
import { parseSkillImport } from './skill_import';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
const item = {
	id: 'sample',
	name: 'Sample',
	content: 'code',
	description: '',
	meta: { tags: [] },
	is_active: true,
	write_access: true
};
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { promise, resolve };
};
const rig = () => {
	const source = readFileSync(
		process.env.SKILL_SOURCE ?? 'src/lib/components/workspace/Skills.svelte',
		'utf8'
	);
	const ast = ts.createSourceFile(
		'skills.ts',
		source.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1],
		ts.ScriptTarget.Latest,
		true
	);
	const code = ast.statements
		.filter((n) => !ts.isImportDeclaration(n) && !ts.isLabeledStatement(n))
		.map((n) => n.getText(ast))
		.join('\n');
	const input = source.slice(source.indexOf('type="file"'));
	const legacy = input.includes('on:change={() => {')
		? input.slice(
				input.indexOf('on:change={') + 'on:change={'.length,
				input.indexOf('\n\t\t}}') + 4
			)
		: 'null';
	const mounts: (() => unknown)[] = [],
		destroys: (() => void)[] = [],
		cleanups: (() => void)[] = [],
		jobs: Promise<unknown>[] = [];
	const listeners = new Map<string, Set<unknown>>(),
		errors: string[] = [],
		successes: string[] = [];
	const list = vi.fn(async () => ({ items: [{ ...item }], total: 1 })),
		catalog = vi.fn(async () => [{ ...item }]),
		create = vi.fn(async () => ({ ...item })),
		remove = vi.fn(async () => true),
		get = vi.fn(async () => ({ ...item })),
		toggle = vi.fn<[], Promise<typeof item | null>>(async () => ({ ...item, is_active: false }));
	const context = {
		parseSkillImport,
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
		$user: { id: 'u' },
		localStorage: { token: 'fixture' },
		sessionStorage: { skill: '' },
		goto: vi.fn(async () => undefined),
		fileSaver: { saveAs: vi.fn() },
		getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
		parseFrontmatter: () => ({ name: 'from-md', description: 'Description' }),
		formatSkillName: (s: string) => s,
		toast: { error: (s: string) => errors.push(s), success: (s: string) => successes.push(s) },
		getSkillItems: list,
		getSkills: catalog,
		createNewSkill: create,
		deleteSkillById: remove,
		getSkillById: get,
		toggleSkillById: toggle,
		workspaceActions: { set: vi.fn() },
		_skills: { set: vi.fn(), update: vi.fn() },
		onMount: (fn: () => unknown) => mounts.push(fn),
		onDestroy: (fn: () => void) => destroys.push(fn),
		tick: async () => undefined,
		window: {
			addEventListener: (n: string, f: unknown) => {
				if (!listeners.has(n)) listeners.set(n, new Set());
				listeners.get(n)!.add(f);
			},
			removeEventListener: (n: string, f: unknown) => listeners.get(n)?.delete(f)
		},
		console: { log: () => undefined, error: () => undefined },
		FileReader: class {
			onload!: (e: { target: { result: string } }) => Promise<void> | void;
			readAsText(file: { text: () => Promise<string> }): void {
				const job = file.text().then((result) => this.onload({ target: { result } }));
				void job.catch(() => undefined);
				jobs.push(job);
			}
		}
	};
	const codeAPI = runInNewContext(
		ts.transpileModule(
			code +
				`\n({load:loadSkillItems,toggle:typeof toggleHandler==='undefined'?null:toggleHandler,remove:deleteHandler,clone:cloneHandler,export:exportHandler,importFile:typeof importHandler==='undefined'?${legacy}:importHandler,items:()=>filteredItems,setItems:v=>filteredItems=v,loading:()=>loading,setFile:f=>{importFiles=[f];importInputElement={value:'selected'};},activate:()=>loaded=true})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		load: () => Promise<void>;
		toggle: (v: typeof item) => Promise<void>;
		remove: (v: typeof item) => Promise<void>;
		clone: (v: typeof item) => Promise<void>;
		export: (v: typeof item) => Promise<void>;
		importFile: () => Promise<void> | void;
		items: () => (typeof item)[];
		setItems: (v: (typeof item)[]) => void;
		loading: () => boolean;
		setFile: (f: { name: string; text: () => Promise<string> }) => void;
		activate: () => void;
	};
	codeAPI.activate();
	return {
		api: codeAPI,
		context,
		list,
		catalog,
		create,
		remove,
		get,
		toggle,
		errors,
		successes,
		listeners,
		mount: () =>
			mounts.forEach((f) => {
				const r = f();
				if (typeof r === 'function') cleanups.push(r as () => void);
				else void Promise.resolve(r).catch(() => undefined);
			}),
		destroy: () => {
			cleanups.forEach((f) => f());
			destroys.forEach((f) => f());
		},
		import: async (text: string, name = 'skills.json') => {
			codeAPI.setFile({ name, text: async () => text });
			await codeAPI.importFile();
			await Promise.all(jobs);
		}
	};
};
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
it('removes owned keyboard and blur listeners', async () => {
	const r = rig();
	r.mount();
	await setImmediate();
	r.destroy();
	expect([...r.listeners.values()].reduce((n, s) => n + s.size, 0)).toBe(0);
});
it('does not publish an older page response over a newer one', async () => {
	const r = rig(),
		d = deferred<{ items: (typeof item)[]; total: number }>();
	r.list.mockImplementationOnce(() => d.promise);
	const first = r.api.load();
	await r.api.load();
	d.resolve({ items: [{ ...item, id: 'stale' }], total: 1 });
	await first;
	expect(r.api.items()[0].id).toBe('sample');
});
it('does not publish a list after destruction', async () => {
	const r = rig(),
		d = deferred<{ items: (typeof item)[]; total: number }>();
	r.list.mockImplementationOnce(() => d.promise);
	const first = r.api.load();
	r.destroy();
	d.resolve({ items: [{ ...item }], total: 1 });
	await first;
	expect(r.api.items() ?? []).toEqual([]);
});
it('preserves accepted deletion when refresh refuses', async () => {
	const r = rig();
	r.api.setItems([{ ...item }]);
	r.list.mockRejectedValue(Error('list refused'));
	r.catalog.mockRejectedValue(Error('catalog refused'));
	await r.api.remove(item);
	expect(r.api.items()).toEqual([]);
	expect(r.successes).toEqual(['Skill deleted successfully']);
});
it('sends one delete per id while pending', async () => {
	const r = rig(),
		d = deferred<boolean>();
	r.remove.mockImplementationOnce(() => d.promise);
	const first = r.api.remove(item);
	await r.api.remove(item);
	expect(r.remove).toHaveBeenCalledTimes(1);
	d.resolve(true);
	await first;
});
it('contains refused import without a success notice', async () => {
	const r = rig();
	r.create.mockRejectedValue(Error('refused'));
	await r.import(JSON.stringify([item]));
	expect(r.successes).toEqual([]);
	expect(r.errors).toHaveLength(1);
});
it('validates all entries before the first write', async () => {
	const r = rig();
	await r.import(JSON.stringify([item, { ...item, id: 7 }]));
	expect(r.create).not.toHaveBeenCalled();
});
it('stops partial import at first refusal and reports accepted count', async () => {
	const r = rig();
	r.create.mockResolvedValueOnce({ ...item }).mockRejectedValueOnce(Error('refused'));
	await r.import(JSON.stringify([item, { ...item, id: 'second' }, { ...item, id: 'third' }]));
	expect(r.create).toHaveBeenCalledTimes(2);
	expect(r.successes).toEqual([]);
	expect(r.errors[0]).toContain('1');
});
it('ignores late JSON reads after destruction', async () => {
	const r = rig(),
		d = deferred<string>();
	r.api.setFile({ name: 'skills.json', text: () => d.promise });
	const pending = r.api.importFile();
	r.destroy();
	d.resolve(JSON.stringify([item]));
	await pending;
	await setImmediate();
	expect(r.create).not.toHaveBeenCalled();
});
it('ignores late Markdown reads after destruction', async () => {
	const r = rig(),
		d = deferred<string>();
	r.api.setFile({ name: 'skill.md', text: () => d.promise });
	const pending = r.api.importFile();
	r.destroy();
	d.resolve('markdown');
	await pending;
	await setImmediate();
	expect(r.context.goto).not.toHaveBeenCalled();
	expect(r.context.sessionStorage.skill).toBe('');
});
it.each(['clone', 'export'] as const)('ignores late %s results', async (name) => {
	const r = rig(),
		d = deferred<typeof item>();
	r.get.mockImplementationOnce(() => d.promise);
	const pending = r.api[name](item);
	r.destroy();
	d.resolve({ ...item });
	await pending;
	expect(r.context.goto).not.toHaveBeenCalled();
	expect(r.context.fileSaver.saveAs).not.toHaveBeenCalled();
	expect(r.context.sessionStorage.skill).toBe('');
});
const calls: [string, () => Promise<unknown>][] = [
	['create', () => api.createNewSkill('t', item)],
	['catalog', () => api.getSkills('t')],
	['list', () => api.getSkillList('t')],
	['page', () => api.getSkillItems('t')],
	['export', () => api.exportSkills('t')],
	['get', () => api.getSkillById('t', 'id')],
	['update', () => api.updateSkillById('t', 'id', item)],
	['access', () => api.updateSkillAccessGrants('t', 'id', [])],
	['toggle', () => api.toggleSkillById('t', 'id')],
	['delete', () => api.deleteSkillById('t', 'id')]
];
it.each(calls)('rejects network refusal: %s', async (_name, call) => {
	vi.stubGlobal('fetch', async () => {
		throw Error('network refused');
	});
	await expect(call()).rejects.toThrow('network refused');
});
it.each(calls)('rejects invalid JSON: %s', async (_name, call) => {
	vi.stubGlobal('fetch', async () => new Response('{'));
	await expect(call()).rejects.toThrow();
});
it('loads an ordinary page as a positive control', async () => {
	const r = rig();
	await r.api.load();
	expect(r.api.items()[0].id).toBe('sample');
	expect(r.errors).toEqual([]);
});
it('preserves the Markdown editor path as a positive control', async () => {
	const r = rig();
	await r.import('markdown', 'skill.md');
	expect(r.create).not.toHaveBeenCalled();
	expect(r.context.goto).toHaveBeenCalledWith('/workspace/skills/create');
	expect(JSON.parse(r.context.sessionStorage.skill)).toMatchObject({
		id: 'from-md',
		content: 'markdown'
	});
});
it.each(['refused', 'null', 'accepted'])(
	'only confirms accepted editor access update: %s',
	async (mode) => {
		const source = readFileSync(
			process.env.SKILL_EDITOR_SOURCE ?? 'src/lib/components/workspace/Skills/SkillEditor.svelte',
			'utf8'
		);
		const fn = source.match(/onChange=\{(async \(\) => \{[\s\S]*?)\}\n\/>/)![1];
		const error = vi.fn(),
			success = vi.fn();
		const run = runInNewContext(`(${fn})`, {
			edit: true,
			skill: { id: 'id' },
			accessGrants: [],
			localStorage: { token: 't' },
			$i18n: { t: (s: string) => s },
			Error,
			toast: { error, success },
			updateSkillAccessGrants: async () => {
				if (mode === 'refused') throw Error('refused');
				return mode === 'null' ? null : {};
			}
		}) as () => Promise<void>;
		await run();
		expect(success).toHaveBeenCalledTimes(mode === 'accepted' ? 1 : 0);
		expect(error).toHaveBeenCalledTimes(mode === 'accepted' ? 0 : 1);
	}
);
it('recovers editor loading after submit refusal and preserves inactive state', async () => {
	const source = readFileSync(
		process.env.SKILL_EDITOR_SOURCE ?? 'src/lib/components/workspace/Skills/SkillEditor.svelte',
		'utf8'
	);
	const body = source.slice(source.indexOf('const submitHandler ='), source.indexOf('\n\tonMount'));
	const error = vi.fn(),
		onSubmit = vi.fn(async () => {
			throw Error('save refused');
		});
	const run = runInNewContext(
		ts.transpileModule(`let loading=false;${body};({submit:submitHandler,loading:()=>loading})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		{
			onSubmit,
			Error,
			disabled: false,
			edit: true,
			skill: { is_active: false, meta: { tags: ['saved'] } },
			id: 'id',
			name: 'Name',
			description: '',
			content: 'code',
			accessGrants: [],
			toast: { error },
			$i18n: { t: (s: string) => s },
			getErrorMessage: (e: Error) => e.message
		}
	) as { submit: () => Promise<void>; loading: () => boolean };
	await run.submit().catch(() => undefined);
	expect(run.loading()).toBe(false);
	expect(onSubmit.mock.calls[0]).toMatchObject([{ is_active: false, meta: { tags: ['saved'] } }]);
	expect(error).toHaveBeenCalledTimes(1);
});
it.each(['refused', 'null', 'accepted'] as const)(
	'preserves a toggle result and contains %s',
	async (mode) => {
		const r = rig();
		r.api.setItems([{ ...item }]);
		if (mode === 'refused') r.toggle.mockRejectedValue(Error('refused'));
		else if (mode === 'null') r.toggle.mockResolvedValue(null);
		else r.catalog.mockRejectedValue(Error('refresh refused'));
		await r.api.toggle(item);
		expect(r.api.items()[0].is_active).toBe(mode === 'accepted' ? false : true);
		expect(r.errors).toHaveLength(1);
		expect(r.toggle).toHaveBeenCalledTimes(1);
	}
);
it('blocks duplicate toggles and invalidates an older page without keeping the spinner', async () => {
	const r = rig(),
		d = deferred<typeof item>(),
		page = deferred<{ items: (typeof item)[]; total: number }>();
	r.api.setItems([{ ...item }]);
	r.list.mockImplementationOnce(() => page.promise);
	const load = r.api.load();
	r.toggle.mockImplementationOnce(() => d.promise);
	const first = r.api.toggle(item);
	await r.api.toggle(item);
	expect(r.toggle).toHaveBeenCalledTimes(1);
	d.resolve({ ...item, is_active: false });
	await first;
	page.resolve({ items: [{ ...item }], total: 1 });
	await load;
	expect(r.api.items()[0].is_active).toBe(false);
	expect(r.api.loading()).toBe(false);
});
it.each([null, false, 'true', {}])('rejects an unconfirmed delete: %j', async (value) => {
	vi.stubGlobal('fetch', async () => new Response(JSON.stringify(value)));
	await expect(api.deleteSkillById('t', 'id')).rejects.toThrow();
});
it.each([null, [], { items: [], total: -1 }, { items: [], total: 1.5 }, { items: null, total: 0 }])(
	'rejects a malformed page: %j',
	async (value) => {
		vi.stubGlobal('fetch', async () => new Response(JSON.stringify(value)));
		await expect(api.getSkillItems('t')).rejects.toThrow('Invalid skills list');
	}
);
it('preserves empty arrays/pages and nullable records', async () => {
	vi.stubGlobal(
		'fetch',
		async (url: string) =>
			new Response(
				url.includes('/list') ? ' {"items":[],"total":0}' : url.includes('/id/') ? 'null' : '[]'
			)
	);
	await expect(api.getSkillList('t')).resolves.toEqual({ items: [], total: 0 });
	await expect(api.getSkills('t')).resolves.toEqual([]);
	await expect(api.exportSkills('t')).resolves.toEqual([]);
	await expect(api.getSkillById('t', 'id')).resolves.toBeNull();
});
it('preserves URL query, methods, grant semantics and bodyless toggle without retries', async () => {
	const fetch = vi.fn<[string, RequestInit], Promise<Response>>(
		async (url) =>
			new Response(
				url.endsWith('/delete')
					? 'true'
					: url.includes('/list?')
						? '{"items":[],"total":0}'
						: 'null'
			)
	);
	vi.stubGlobal('fetch', fetch);
	const form = { ...item, access_grants: null };
	await api.createNewSkill('t', form);
	await api.updateSkillById('t', 'a/b', form);
	await api.updateSkillAccessGrants('t', 'a/b', []);
	await api.toggleSkillById('t', 'a/b');
	await api.deleteSkillById('t', 'a/b');
	await api.getSkillItems('t', 'a & b', 'created', 2, 'name', 'asc');
	expect(fetch.mock.calls.map((c) => c[1].method)).toEqual([
		'POST',
		'POST',
		'POST',
		'POST',
		'DELETE',
		'GET'
	]);
	expect(fetch.mock.calls.slice(1, 5).every((c) => c[0].includes('a%2Fb'))).toBe(true);
	expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual(form);
	expect(JSON.parse(fetch.mock.calls[2][1].body as string)).toEqual({ access_grants: [] });
	expect(fetch.mock.calls[3][1]).not.toHaveProperty('body');
	expect(fetch.mock.calls[4][1]).not.toHaveProperty('body');
	expect(new Headers(fetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer t');
	expect(fetch.mock.calls[5][0]).toBe(
		'/api/v1/skills/list?query=a+%26+b&view_option=created&page=2&order_by=name&direction=asc'
	);
});
it('aborts before fetch and enforces deadline through response body', async () => {
	vi.useFakeTimers();
	const controller = new AbortController(),
		fetch = vi.fn();
	vi.stubGlobal('fetch', fetch);
	controller.abort(Error('cancelled'));
	await expect(api.getSkills('t', controller.signal)).rejects.toThrow('cancelled');
	expect(fetch).not.toHaveBeenCalled();
	fetch.mockImplementation(async (_url: string, init: RequestInit) => ({
		ok: true,
		json: () =>
			new Promise((_resolve, reject) =>
				init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
			)
	}));
	const pending = expect(api.getSkills('t')).rejects.toThrow('timed out');
	await vi.advanceTimersByTimeAsync(60_000);
	await pending;
	expect(vi.getTimerCount()).toBe(0);
});
it('contains file/JSON failures and blocks a duplicate pending import', async () => {
	const r = rig(),
		d = deferred<string>();
	r.api.setFile({ name: 'skills.json', text: () => d.promise });
	const first = r.api.importFile();
	await r.api.importFile();
	d.resolve(JSON.stringify(item));
	await first;
	expect(r.create).toHaveBeenCalledTimes(1);
	await r.import('{');
	r.api.setFile({
		name: 'skills.json',
		text: async () => {
			throw Error('read refused');
		}
	});
	await r.api.importFile();
	expect(r.errors).toHaveLength(2);
});
it.each([undefined, null, [], [{ principal_type: 'user', principal_id: 'u', permission: 'read' }]])(
	'preserves import grants: %j',
	(grants) => {
		const value = { ...item, ...(grants === undefined ? {} : { access_grants: grants }) };
		const parsed = parseSkillImport(JSON.stringify(value))[0];
		expect(parsed.access_grants).toEqual(grants);
		expect(parsed).not.toHaveProperty('write_access');
		expect(parsed).not.toHaveProperty('user_id');
	}
);
it.each([
	[],
	null,
	{ ...item, id: 3 },
	{ ...item, description: 3 },
	{ ...item, is_active: null },
	{ ...item, meta: null },
	{ ...item, meta: { tags: [3] } },
	{ ...item, access_grants: [{ principal_type: ['user'], principal_id: 'u', permission: 'read' }] },
	[item, { ...item, id: 'SAMPLE' }],
	[
		{ ...item, id: 'a b' },
		{ ...item, id: 'a-b' }
	]
])('rejects malformed complete imports: %j', (value) => {
	expect(() => parseSkillImport(JSON.stringify(value))).toThrow();
});
it('preserves backend defaults and nullable metadata fields in valid single/array imports', () => {
	const minimal = { id: 'a b', name: 'A', content: 'code' };
	expect(parseSkillImport(JSON.stringify(minimal))).toEqual([minimal]);
	expect(
		parseSkillImport(
			JSON.stringify([{ ...minimal, description: null, meta: { tags: null }, is_active: false }])
		)
	).toEqual([{ ...minimal, description: null, meta: { tags: null }, is_active: false }]);
});
