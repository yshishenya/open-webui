// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import * as tools from '$lib/apis/tools';
import * as functions from '$lib/apis/functions';
import { convertValveArrays, readValveSpec, type ValveValues, type ValveSpec } from './userValves';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
const schema: ValveSpec = {
	properties: {
		tags: { type: 'array' },
		unset: { type: 'array' },
		defaults: { type: 'array' },
		choices: { type: 'array', input: { type: 'multiselect' } }
	}
};
const stored = { tags: ['one'], defaults: null, choices: ['a'] };
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((fn) => (resolve = fn));
	return { promise, resolve };
};
const modes = [
	['tool', false],
	['tool', true],
	['function', false],
	['function', true]
] as const;
const rig = (category: string = 'tool', personal = false) => {
	const source = readFileSync(
			process.env.VALVES_SOURCE ?? 'src/lib/components/workspace/common/ValvesModal.svelte',
			'utf8'
		),
		script = parse(source).instance!;
	const parsed = ts.createSourceFile(
		'modal.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const code = parsed.statements
		.filter((s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s))
		.map((s) => s.getText(parsed))
		.join('\n');
	const reactive = parsed.statements
		.filter(ts.isLabeledStatement)
		.map((s) => s.statement.getText(parsed))
		.join('\n');
	const errors: string[] = [],
		successes: string[] = [],
		events: string[] = [],
		routes: string[] = [],
		destroy: (() => void)[] = [];
	const values = vi.fn<[string, string, AbortSignal?], Promise<ValveValues | null>>(async () => ({
		...stored
	}));
	const spec = vi.fn<[string, string, AbortSignal?], Promise<ValveSpec | null>>(async () => schema);
	const save = vi.fn<[string, string, ValveValues, AbortSignal?], Promise<ValveValues | null>>(
		async () => ({ ...stored, tags: ['server'] })
	);
	const adapters: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
	for (const kind of ['Tool', 'Function'])
		for (const scope of ['', 'User']) {
			for (const action of ['values', 'spec', 'save']) {
				const name =
					action === 'save'
						? `update${kind}${scope}ValvesById`
						: action === 'spec'
							? `get${kind}${scope}ValvesSpecById`
							: `get${kind}${scope}ValvesById`;
				adapters[name] = async (...args: unknown[]) => {
					routes.push(name);
					if (action === 'save') return save(...(args as Parameters<typeof save>));
					if (action === 'spec') return spec(...(args as Parameters<typeof spec>));
					return values(...(args as Parameters<typeof values>));
				};
			}
		}
	const api = runInNewContext(
		ts.transpileModule(
			code.replace(/\bexport\s+/g, '') +
				`\nshow=true;type=category;id='a';userValves=personal;if(typeof wasOpen!=='undefined')wasOpen=true;
 ({init:()=>initHandler(),submit:submitHandler,state:()=>({valves,valvesSpec,loading,saving,show,loadFailed:typeof loadFailed==='undefined'?false:loadFailed}),edit:v=>valves=v,select:(v,t,u)=>{id=v;type=t;userValves=u;},setShow:v=>{show=v;${reactive}}})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022, alwaysStrict: true } }
		).outputText,
		{
			...adapters,
			AbortController,
			Error,
			convertValveArrays,
			readValveSpec,
			category,
			personal,
			getContext: () => ({}),
			$i18n: { t: (s: string) => s },
			createEventDispatcher: () => (e: string) => events.push(e),
			onDestroy: (fn: () => void) => destroy.push(fn),
			localStorage: { token: 'token' },
			toast: { error: (s: string) => errors.push(s), success: (s: string) => successes.push(s) }
		}
	) as {
		init: () => Promise<void>;
		submit: () => Promise<void>;
		state: () => {
			valves: ValveValues;
			valvesSpec: ValveSpec | null;
			loading: boolean;
			saving: boolean;
			show: boolean;
			loadFailed: boolean;
		};
		edit: (v: ValveValues) => void;
		select: (id: string, type: string, user: boolean) => void;
		setShow: (show: boolean) => void;
	};
	return {
		api,
		values,
		spec,
		save,
		errors,
		successes,
		events,
		routes,
		destroy: () => destroy.forEach((fn) => fn())
	};
};
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
it.each(modes)(
	'loads and saves the selected %s / user=%s with server canonical values',
	async (type, user) => {
		const r = rig(type, user);
		await r.api.init();
		expect(r.api.state().valves).toEqual({ ...stored, tags: 'one' });
		r.api.edit({ ...stored, tags: ' draft, two ' });
		await r.api.submit();
		expect(r.api.state().valves.tags).toBe('server');
		expect(r.events).toEqual(['save']);
		expect(r.api.state().saving).toBe(false);
		const kind = type === 'tool' ? 'Tool' : 'Function',
			scope = user ? 'User' : '';
		expect(r.routes).toEqual([
			`get${kind}${scope}ValvesById`,
			`get${kind}${scope}ValvesSpecById`,
			`update${kind}${scope}ValvesById`
		]);
		expect(r.save.mock.calls[0][2]).toEqual({ ...stored, tags: ['draft', 'two'] });
		expect('unset' in r.save.mock.calls[0][2]).toBe(false);
	}
);
it('preserves the editable draft and multiselect on a refused save', async () => {
	const r = rig();
	await r.api.init();
	const draft = { ...stored, tags: 'draft, two' };
	r.api.edit(draft);
	r.save.mockRejectedValue(Error('refused'));
	await r.api.submit();
	expect(r.api.state().valves).toEqual(draft);
	expect(draft.tags).toBe('draft, two');
	expect(r.successes).toEqual([]);
	expect(r.events).toEqual([]);
	expect(r.errors).toHaveLength(1);
	expect(r.api.state().saving).toBe(false);
});
it('does not mutate frozen fetched settings', async () => {
	const r = rig();
	r.values.mockResolvedValue(Object.freeze({ ...stored }));
	await r.api.init();
	expect(r.api.state().valves.tags).toBe('one');
	expect(r.errors).toEqual([]);
	expect(r.api.state().loading).toBe(false);
});
it.each(['values', 'spec'] as const)(
	'releases a refused %s load, blocks save and permits explicit retry',
	async (part) => {
		const r = rig();
		r[part].mockRejectedValue(Error('refused'));
		await r.api.init();
		expect(r.api.state()).toMatchObject({ loading: false, loadFailed: true, show: true });
		await r.api.submit();
		expect(r.save).not.toHaveBeenCalled();
		r.values.mockResolvedValue({ ...stored });
		r.spec.mockResolvedValue(schema);
		await r.api.init();
		expect(r.api.state()).toMatchObject({ loading: false, loadFailed: false, valvesSpec: schema });
	}
);
it('blocks duplicate save and leaves arrays editable during the request', async () => {
	const r = rig(),
		d = deferred<ValveValues | null>();
	await r.api.init();
	r.api.edit({ ...stored, tags: 'one,two' });
	r.save.mockImplementation(() => d.promise);
	const first = r.api.submit(),
		second = r.api.submit();
	expect(r.save).toHaveBeenCalledTimes(1);
	expect(r.api.state().valves.tags).toBe('one,two');
	d.resolve(stored);
	await Promise.all([first, second]);
});
it('contains array conversion refusal and missing save response', async () => {
	const r = rig();
	await r.api.init();
	r.api.edit({ tags: 42 });
	await expect(r.api.submit()).resolves.toBeUndefined();
	expect(r.api.state().saving).toBe(false);
	expect(r.save).not.toHaveBeenCalled();
	r.api.edit({ tags: 'draft' });
	r.save.mockResolvedValue(null);
	await r.api.submit();
	expect(r.successes).toEqual([]);
	expect(r.events).toEqual([]);
	expect(r.api.state().valves.tags).toBe('draft');
});
it.each(['close', 'destroy'] as const)('cancels and ignores late loading at %s', async (action) => {
	const r = rig(),
		d = deferred<ValveValues | null>();
	r.values.mockImplementation(() => d.promise);
	const pending = r.api.init();
	if (action === 'close') r.api.setShow(false);
	else r.destroy();
	expect(r.values.mock.calls[0][2]?.aborted).toBe(true);
	d.resolve(stored);
	await pending;
	expect(r.spec).not.toHaveBeenCalled();
	expect(r.api.state()).toMatchObject({
		loading: false,
		saving: false,
		valves: {},
		valvesSpec: null
	});
	expect(r.errors).toEqual([]);
});
it.each([
	['b', 'tool', false],
	['a', 'function', false],
	['a', 'tool', true]
] as const)('ignores stale load after selection %s/%s/%s', async (id, type, user) => {
	const r = rig(),
		d = deferred<ValveValues | null>();
	r.values.mockImplementationOnce(() => d.promise);
	const old = r.api.init();
	r.api.select(id, type, user);
	await r.api.init();
	d.resolve({ tags: ['old'] });
	await old;
	expect(r.api.state().valves.tags).toBe('one');
	expect(r.values.mock.calls[0][2]?.aborted).toBe(true);
});
it('ignores an old save response after changing the selected id', async () => {
	const r = rig(),
		d = deferred<ValveValues | null>();
	await r.api.init();
	r.save.mockImplementation(() => d.promise);
	const pending = r.api.submit();
	r.api.select('b', 'tool', false);
	await r.api.init();
	d.resolve({ tags: ['old'] });
	await pending;
	expect(r.api.state().valves.tags).toBe('one');
	expect(r.events).toEqual([]);
	expect(r.successes).toEqual([]);
	expect(r.api.state().saving).toBe(false);
});
it('emits close exactly once per closure', async () => {
	const r = rig();
	await r.api.init();
	r.api.setShow(false);
	r.api.setShow(false);
	expect(r.events).toEqual(['close']);
});
const adminCalls = [
	['tool values', tools.getToolValvesById],
	['tool spec', tools.getToolValvesSpecById],
	[
		'tool save',
		(t: string, id: string, s?: AbortSignal) => tools.updateToolValvesById(t, id, {}, s)
	],
	['function values', functions.getFunctionValvesById],
	['function spec', functions.getFunctionValvesSpecById],
	[
		'function save',
		(t: string, id: string, s?: AbortSignal) => functions.updateFunctionValvesById(t, id, {}, s)
	]
] as const;
it.each(adminCalls)('rejects network failure for %s', async (_name, call) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => {
			throw Error('network refused');
		})
	);
	await expect(call('token', 'a')).rejects.toThrow('network refused');
});
it.each(adminCalls)('rejects malformed settings for %s', async (name, call) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify(name.includes('spec') ? { properties: [] } : [])))
	);
	await expect(call('token', 'a')).rejects.toThrow();
});
it('control: ordinary loading follows the selected mode and finishes', async () => {
	const r = rig('function', true);
	r.spec.mockResolvedValue({
		properties: {
			tags: { type: 'array' },
			choices: { type: 'array', input: { type: 'multiselect' } }
		}
	});
	await r.api.init();
	expect(r.api.state()).toMatchObject({
		loading: false,
		show: true,
		valves: { ...stored, tags: 'one' }
	});
	expect(r.routes).toEqual(['getFunctionUserValvesById', 'getFunctionUserValvesSpecById']);
});

const userCalls = [
	['tool user values', tools.getUserValvesById],
	['tool user spec', tools.getUserValvesSpecById],
	[
		'tool user save',
		(t: string, id: string, s?: AbortSignal) => tools.updateUserValvesById(t, id, {}, s)
	],
	['function user values', functions.getUserValvesById],
	['function user spec', functions.getUserValvesSpecById],
	[
		'function user save',
		(t: string, id: string, s?: AbortSignal) => functions.updateUserValvesById(t, id, {}, s)
	]
] as const;
const allCalls = [...adminCalls, ...userCalls];
it.each(allCalls)(
	'preserves null, URL encoding and GET/POST contracts for %s',
	async (name, call) => {
		const fetch = vi.fn(async () => new Response('null'));
		vi.stubGlobal('fetch', fetch);
		await expect(call('token', 'a/b')).resolves.toBeNull();
		const family = name.startsWith('tool') ? 'tools' : 'functions',
			scope = name.includes('user') ? '/user' : '',
			suffix = name.endsWith('spec') ? '/spec' : name.endsWith('save') ? '/update' : '';
		const save = name.endsWith('save');
		expect(fetch.mock.calls[0]).toEqual([
			`/api/v1/${family}/id/a%2Fb/valves${scope}${suffix}`,
			expect.objectContaining({
				method: save ? 'POST' : 'GET',
				headers: expect.objectContaining({ authorization: 'Bearer token' }),
				...(save ? { body: '{}' } : {})
			})
		]);
		expect('body' in (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]).toBe(save);
	}
);
it.each(allCalls)(
	'supports caller cancellation and a body deadline for %s',
	async (_name, call) => {
		vi.useFakeTimers();
		let signal!: AbortSignal;
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init: RequestInit) => {
				signal = init.signal!;
				return {
					ok: true,
					json: () =>
						new Promise((_resolve, reject) =>
							signal.addEventListener('abort', () => reject(signal.reason), { once: true })
						)
				};
			})
		);
		const controller = new AbortController(),
			cancelled = call('token', 'a', controller.signal),
			assertCancelled = expect(cancelled).rejects.toThrow('cancelled');
		await vi.advanceTimersByTimeAsync(0);
		controller.abort(Error('cancelled'));
		await assertCancelled;
		expect(vi.getTimerCount()).toBe(0);
		const timed = call('token', 'a'),
			assertTimed = expect(timed).rejects.toThrow('timed out');
		await vi.advanceTimersByTimeAsync(25000);
		await assertTimed;
		expect(vi.getTimerCount()).toBe(0);
	}
);
it('does not expose private HTTP error details or fetch after a prior cancellation', async () => {
	const fetch = vi.fn(
		async () => new Response('{"detail":"private settings payload"}', { status: 403 })
	);
	vi.stubGlobal('fetch', fetch);
	for (const [, call] of allCalls)
		await expect(call('token', 'a')).rejects.toThrow('Settings request failed (403)');
	fetch.mockClear();
	const controller = new AbortController();
	controller.abort(Error('cancelled'));
	for (const [, call] of allCalls)
		await expect(call('token', 'a', controller.signal)).rejects.toThrow('cancelled');
	expect(fetch).not.toHaveBeenCalled();
});
it.each(['close', 'destroy'] as const)(
	'ignores a save response after %s without reporting success',
	async (action) => {
		const r = rig(),
			d = deferred<ValveValues | null>();
		await r.api.init();
		r.save.mockImplementation(() => d.promise);
		const pending = r.api.submit();
		if (action === 'close') r.api.setShow(false);
		else r.destroy();
		expect(r.save.mock.calls[0][3]?.aborted).toBe(true);
		d.resolve(stored);
		await pending;
		expect(r.successes).toEqual([]);
		expect(r.events).not.toContain('save');
		expect(r.api.state()).toMatchObject({ saving: false, loading: false, valves: {} });
	}
);
it('ignores a late schema after close/reopen and permits no-schema/null settings without save', async () => {
	const r = rig(),
		d = deferred<ValveSpec | null>();
	r.spec.mockImplementationOnce(() => d.promise);
	const first = r.api.init();
	await setImmediate();
	r.api.setShow(false);
	r.api.select('b', 'tool', false);
	r.api.setShow(true);
	await setImmediate();
	await setImmediate();
	d.resolve({ properties: { old: { type: 'array' } } });
	await first;
	expect(r.api.state().valvesSpec).toEqual(schema);
	const empty = rig();
	empty.values.mockResolvedValue(null);
	empty.spec.mockResolvedValue(null);
	await empty.api.init();
	await empty.api.submit();
	expect(empty.api.state()).toMatchObject({
		loading: false,
		loadFailed: false,
		valves: {},
		valvesSpec: null
	});
	expect(empty.save).not.toHaveBeenCalled();
});
it('allows an empty array through the actual native input constraint while retaining scalar constraints', () => {
	const source = readFileSync('src/lib/components/common/Valves.svelte', 'utf8');
	const block = source
		.split("{:else if (valvesSpec.properties[property]?.type ?? null) !== 'string'}")[1]
		?.split('{:else if')[0];
	expect(block).toBeDefined();
	const attribute = block!.match(/\brequired(?:=\{([^}]+)\})?/);
	expect(attribute).not.toBeNull();
	const expression = attribute![1] ?? 'true';
	const required = (type: string): boolean =>
		runInNewContext(expression, {
			valvesSpec: { properties: { tags: { type } } },
			property: 'tags'
		}) as boolean;
	expect(required('array')).toBe(false);
	expect(required('number')).toBe(true);
});
