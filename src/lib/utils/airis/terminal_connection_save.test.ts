// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import {
	getTerminalServerConnections,
	setTerminalServerConnections,
	putOrchestratorPolicy,
	putOrchestratorLifecycle,
	getOrchestratorPolicy,
	refreshOrchestratorTerminals,
	verifyTerminalServerConnection
} from '$lib/apis/configs';
import { getTerminalConfig } from '$lib/apis/terminal';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api', WEBUI_BASE_URL: '' }));
const modalPath = 'src/lib/components/AddTerminalServerModal.svelte';
const listPath = 'src/lib/components/chat/Settings/Integrations/Terminals.svelte';
const rowPath = 'src/lib/components/chat/Settings/Integrations/Terminals/Connection.svelte';
const userPath = 'src/lib/components/chat/Settings/Integrations.svelte';
const adminPath = 'src/lib/components/admin/Settings/Integrations.svelte';
const fixture = () => ({
	url: 'https://terminal.invalid',
	key: 'fixture',
	enabled: true,
	name: 'old'
});
const read = (path: string): string =>
	readFileSync(
		(process.env.AIRIS_TERMINAL_SAVE_BEFORE_ROOT
			? process.env.AIRIS_TERMINAL_SAVE_BEFORE_ROOT + '/'
			: '') + path,
		'utf8'
	);
const script = (path: string) => {
	const source = read(path);
	const instance = parse(source).instance!;
	const ast = ts.createSourceFile(
		'terminal.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	return ast.statements
		.filter(
			(s) =>
				!ts.isImportDeclaration(s) &&
				!ts.isLabeledStatement(s) &&
				!(
					ts.isVariableStatement(s) &&
					s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
				)
		)
		.map((s) => s.getText(ast))
		.join('\n');
};
const run = <T>(path: string, expose: string, extra: Record<string, unknown> = {}) => {
	const destroy: (() => void)[] = [];
	const mounts: (() => unknown)[] = [];
	const context = {
		show: true,
		connection: fixture(),
		direct: false,
		edit: true,
		onSubmit: vi.fn(async () => true),
		onDelete: vi.fn(async () => true),
		onChange: vi.fn(async () => true),
		onEnable: vi.fn(async () => true),
		onDisable: vi.fn(async () => true),
		getContext: () => ({}),
		onDestroy: (f: () => void) => destroy.push(f),
		onMount: (f: () => unknown) => mounts.push(f),
		structuredClone,
		AbortController,
		crypto,
		localStorage: { token: 'session' },
		$i18n: { t: (s: string) => s },
		toast: { error: vi.fn(), success: vi.fn() },
		getTerminalConfig: vi.fn<[string, string, AbortSignal?], Promise<object>>(async () => ({
			features: { terminal: true }
		})),
		verifyTerminalServerConnection: vi.fn(async () => ({ status: true, type: 'terminal' })),
		getOrchestratorPolicy: vi.fn(async () => ({ data: {} })),
		getOrchestratorLifecycle: vi.fn(async () => ({ data: {} })),
		putOrchestratorPolicy: vi.fn(async () => ({})),
		putOrchestratorLifecycle: vi.fn(async () => ({})),
		refreshOrchestratorTerminals: vi.fn(async () => ({ refreshed: 1 })),
		$settings: { toolServers: [], terminalServers: [fixture()] },
		$terminalServers: [{ id: 'system', url: '/system', name: 'system' }],
		saveSettings: vi.fn(async () => {}),
		getToolServersData: vi.fn(async () => []),
		toolServers: { set: vi.fn() },
		terminalServers: { set: vi.fn() },
		getTerminalServers: vi.fn(async () => []),
		WEBUI_API_BASE_URL: '/api',
		getToolServerConnections: vi.fn(async () => ({ TOOL_SERVER_CONNECTIONS: [] })),
		getTerminalServerConnections: vi.fn(async () => ({ TERMINAL_SERVER_CONNECTIONS: [fixture()] })),
		setTerminalServerConnections: vi.fn(async () => ({ TERMINAL_SERVER_CONNECTIONS: [fixture()] })),
		servers: [fixture()],
		console: { log: vi.fn(), error: vi.fn() },
		...extra
	};
	const api = runInNewContext(
		ts.transpileModule(script(path) + '\n' + expose, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as T;
	return { api, context, destroy, mounts };
};
type Modal = {
	init: () => void;
	submitHandler: () => Promise<void>;
	deleteHandler: () => Promise<void>;
	verifyHandler: () => Promise<void>;
	loadPolicy: () => Promise<void>;
	set: (url: string, auth?: string, policy?: string) => void;
	read: () => {
		show: boolean;
		saving: boolean;
		url: string;
		policyImage: string;
		accessGrants: unknown[];
	};
};
const legacyDelete = (): string => {
	const match = read(modalPath).match(/on:confirm={([\s\S]*?)\n\t}}/);
	return match ? match[1] + '\n}' : 'async()=>{}';
};
const modal = (extra: Record<string, unknown> = {}) =>
	run<Modal>(
		modalPath,
		'({init,submitHandler,verifyHandler,loadPolicy,deleteHandler:typeof deleteHandler === "undefined" ? (' +
			legacyDelete() +
			') : deleteHandler,set:(u,a="bearer",p="")=>{url=u;auth_type=a;policyId=p;serverType=p?"orchestrator":null;},read:()=>({show,saving:typeof saving === "undefined" ? false:saving,url,policyImage,accessGrants})})',
		extra
	);
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
});
it.each([false, 'reject'])('keeps draft and finishes saving after %s', async (result) => {
	const r = modal({
		onSubmit: vi.fn(async () => {
			if (result === 'reject') throw new Error('fixture');
			return false;
		})
	});
	r.api.init();
	await r.api.submitHandler().catch(() => {});
	expect(r.api.read()).toMatchObject({ show: true, saving: false, url: fixture().url });
});
it('prevents duplicate saves and ignores a late result after a new draft opens', async () => {
	let resolve!: (v: boolean) => void;
	const r = modal({
		onSubmit: vi.fn(
			() =>
				new Promise<boolean>((r) => {
					resolve = r;
				})
		)
	});
	r.api.init();
	const pending = r.api.submitHandler();
	await r.api.submitHandler();
	expect(r.context.onSubmit).toHaveBeenCalledOnce();
	r.api.init();
	r.api.set('https://new.invalid');
	resolve(true);
	await pending;
	expect(r.api.read()).toMatchObject({ show: true, url: 'https://new.invalid' });
});
it('keeps delete modal open after false', async () => {
	const r = modal({ onDelete: vi.fn(async () => false) });
	r.api.init();
	await r.api.deleteHandler();
	expect(r.context.onDelete).toHaveBeenCalledOnce();
	expect(r.api.read().show).toBe(true);
});
it('clones access grants before editing', () => {
	const grants = [{ principal_type: 'user', principal_id: 'fixture', permission: 'read' }];
	const r = modal({ connection: { ...fixture(), config: { access_grants: grants } } });
	r.api.init();
	expect(r.api.read().accessGrants).toEqual(grants);
	expect(r.api.read().accessGrants).not.toBe(grants);
});
it.each(['none', 'session'])('direct verification respects %s auth', async (auth) => {
	const r = modal({ direct: true });
	r.api.init();
	r.api.set(fixture().url, auth);
	await r.api.verifyHandler();
	expect(r.context.getTerminalConfig.mock.calls[0]?.[1]).toBe(auth === 'none' ? '' : 'session');
});
it('ignores late policy loading after draft replacement', async () => {
	let resolve!: (r: object) => void;
	const r = modal({
		getOrchestratorPolicy: () =>
			new Promise<object>((r) => {
				resolve = r;
			})
	});
	r.api.init();
	r.api.set(fixture().url, 'bearer', 'fixture');
	const pending = r.api.loadPolicy();
	r.api.init();
	resolve({ data: { image: 'old-response' } });
	await pending;
	expect(r.api.read().policyImage).toBe('');
});
type List = {
	addServer: (s: ReturnType<typeof fixture>) => Promise<boolean>;
	enableServer: (idx: number) => Promise<boolean>;
	deleteServer: (idx: number) => Promise<boolean>;
	read: () => ReturnType<typeof fixture>[];
};
it.each(['addServer', 'enableServer', 'deleteServer'] as const)(
	'list %s preserves saved list on failed parent save',
	async (name) => {
		const r = run<List>(listPath, '({addServer,enableServer,deleteServer,read:()=>servers})', {
			servers: [fixture(), { ...fixture(), url: 'second', enabled: false }],
			onChange: vi.fn(async () => false)
		});
		const before = structuredClone(r.api.read());
		await (r.api[name] as (arg: unknown) => Promise<boolean>)(
			name === 'addServer' ? { ...fixture(), url: 'new' } : 1
		);
		expect(r.api.read()).toEqual(before);
	}
);
it('allows exactly one active direct terminal after successful enable', async () => {
	const r = run<List>(listPath, '({addServer,enableServer,deleteServer,read:()=>servers})', {
		servers: [fixture(), { ...fixture(), url: 'new', enabled: false }]
	});
	await r.api.enableServer(1);
	expect(r.api.read().map((s) => s.enabled)).toEqual([false, true]);
});
type Admin = {
	addTerminalConnection: (s: ReturnType<typeof fixture>) => Promise<boolean>;
	removeTerminalConnection: (idx: number) => Promise<boolean>;
	updateTerminalConnection: (idx: number, s: ReturnType<typeof fixture>) => Promise<boolean>;
	saveTerminalServers: () => Promise<boolean>;
	read: () => ReturnType<typeof fixture>[];
};
const admin = (extra: Record<string, unknown> = {}) =>
	run<Admin>(
		adminPath,
		'({addTerminalConnection,removeTerminalConnection,updateTerminalConnection,saveTerminalServers,read:()=>terminalConnections})',
		extra
	);
it.each(['add', 'update', 'delete'])(
	'admin %s preserves saved config on rejection',
	async (mode) => {
		const r = admin({
			setTerminalServerConnections: vi.fn(async () => {
				throw new Error('fixture');
			})
		});
		for (const m of r.mounts) await m();
		const before = structuredClone(r.api.read());
		const next = { ...fixture(), url: 'new' };
		await (mode === 'add'
			? r.api.addTerminalConnection(next)
			: mode === 'update'
				? r.api.updateTerminalConnection(0, next)
				: r.api.removeTerminalConnection(0));
		expect(r.api.read()).toEqual(before);
	}
);
it('does not overwrite unknown config after load failure', async () => {
	const r = admin({
		getTerminalServerConnections: vi.fn(async () => {
			throw new Error('fixture');
		})
	});
	for (const m of r.mounts) await m();
	await r.api.addTerminalConnection(fixture());
	expect(r.context.setTerminalServerConnections).not.toHaveBeenCalled();
});
it('user parent saves terminal snapshot before publishing', async () => {
	const r = run<{
		saveConnections: (tools: object[], terminals: object[]) => Promise<boolean>;
		read: () => unknown[];
	}>(userPath, '({saveConnections,read:()=>terminalServerConfigs})', {
		saveSettings: vi.fn(async () => {
			throw new Error('fixture');
		})
	});
	for (const m of r.mounts) await m();
	const before = structuredClone(r.api.read());
	expect(await r.api.saveConnections([], [{ ...fixture(), url: 'new' }])).toBe(false);
	expect(r.api.read()).toEqual(before);
});
it.each([
	['config', () => getTerminalServerConnections('fixture')],
	['save', () => setTerminalServerConnections('fixture', { TERMINAL_SERVER_CONNECTIONS: [] })],
	['policy', () => putOrchestratorPolicy('fixture', 'url', 'key', 'id', {})],
	['lifecycle', () => putOrchestratorLifecycle('fixture', 'url', 'key', 'id', {})],
	['refresh', () => refreshOrchestratorTerminals('fixture', 'url', 'key', {})],
	['verify', () => verifyTerminalServerConnection('fixture', { url: 'url' })]
] as const)(
	'%s API rejects a network error without logging data or retry',
	async (_name, request) => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetcher = vi.fn(async () => {
			throw new Error('private-fixture');
		});
		vi.stubGlobal('fetch', fetcher);
		await expect(request()).rejects.toThrow();
		expect(fetcher).toHaveBeenCalledOnce();
		expect(log).not.toHaveBeenCalled();
	}
);
it('policy read retains HTTP status404', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('{"detail":"missing"}', { status: 404 }))
	);
	await expect(getOrchestratorPolicy('fixture', 'url', 'key', 'id')).rejects.toMatchObject({
		status: 404
	});
});
it('direct config omits authorization for auth none', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, opts: RequestInit) => {
			expect(new Headers(opts.headers).has('Authorization')).toBe(false);
			return new Response('{"features":{}}');
		})
	);
	expect(await getTerminalConfig('https://fixture.invalid', '')).toEqual({ features: {} });
});
it('row preserves the confirmed connection after a rejected edit', async () => {
	const r = run<{ saveConnection: (c: object) => Promise<boolean>; read: () => unknown }>(
		rowPath,
		'({saveConnection,read:()=>connection})',
		{ onSubmit: vi.fn(async () => false) }
	);
	await r.api.saveConnection({ ...fixture(), url: 'new' });
	expect(r.api.read()).toEqual(fixture());
});
it('user parent publishes the same terminal snapshot only after persistence', async () => {
	let resolve!: () => void;
	const r = run<{
		saveConnections: (tools: object[], terminals: object[]) => Promise<boolean>;
		read: () => unknown[];
	}>(userPath, '({saveConnections,read:()=>terminalServerConfigs})', {
		saveSettings: vi.fn(
			() =>
				new Promise<void>((r) => {
					resolve = r;
				})
		)
	});
	for (const m of r.mounts) await m();
	const next = [{ ...fixture(), url: 'new' }];
	const pending = r.api.saveConnections([], next);
	expect(r.api.read()).toEqual([fixture()]);
	resolve();
	expect(await pending).toBe(true);
	expect(r.api.read()).toEqual(next);
});
it.each(['policy', 'lifecycle'])(
	'does not persist settings after a null %s write',
	async (name) => {
		const r = modal({
			[name === 'policy' ? 'putOrchestratorPolicy' : 'putOrchestratorLifecycle']: vi.fn(
				async () => null
			)
		});
		r.api.init();
		r.api.set(fixture().url, 'bearer', 'fixture');
		await r.api.submitHandler();
		expect(r.context.onSubmit).not.toHaveBeenCalled();
		expect(r.api.read()).toMatchObject({ show: true, saving: false });
	}
);
it('aborts bounded terminal config fetch without printing raw rejection', async () => {
	vi.useFakeTimers();
	const fetcher = vi.fn(
		(_url: string, opts: RequestInit) =>
			new Promise<Response>((_resolve, reject) =>
				opts.signal?.addEventListener('abort', () => reject(opts.signal?.reason))
			)
	);
	vi.stubGlobal('fetch', fetcher);
	const pending = getTerminalConfig('https://fixture.invalid', 'fixture');
	await vi.advanceTimersByTimeAsync(60_000);
	expect(await pending).toBeNull();
	expect(fetcher).toHaveBeenCalledOnce();
	expect(vi.getTimerCount()).toBe(0);
});
it('loads a reopened policy draft while the previous settings save is still pending', async () => {
	let resolve!: (v: boolean) => void;
	const r = modal({
		onSubmit: vi.fn(
			() =>
				new Promise<boolean>((r) => {
					resolve = r;
				})
		)
	});
	r.api.init();
	const pending = r.api.submitHandler();
	r.api.init();
	r.api.set(fixture().url, 'bearer', 'fixture');
	await r.api.loadPolicy();
	expect(r.context.getOrchestratorPolicy).toHaveBeenCalledOnce();
	resolve(true);
	await pending;
	expect(r.api.read().show).toBe(true);
});
