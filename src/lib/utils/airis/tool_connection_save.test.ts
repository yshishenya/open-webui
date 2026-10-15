// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import {
	getToolServerConnections,
	setToolServerConnections,
	registerOAuthClient
} from '$lib/apis/configs';
import { parseToolConnectionImport, parseToolSpec } from './tool_connection_import';
import { getToolServerData, getToolServersData } from '$lib/apis';
import { parseConnectionHeaders } from './model_connection_request';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api', WEBUI_BASE_URL: '' }));
const modalPath = 'src/lib/components/AddToolServerModal.svelte';
const userPath = 'src/lib/components/chat/Settings/Integrations.svelte';
const adminPath = 'src/lib/components/admin/Settings/Integrations.svelte';
const fixture = () => ({
	url: 'https://fixture.invalid',
	path: 'openapi.json',
	key: 'fixture',
	config: { enable: true },
	info: { id: 'fixture' }
});
const script = (path: string): string => {
	const source = readFileSync(path, 'utf8');
	const body = parse(source).instance;
	if (!body) throw new Error('Missing script');
	const ast = ts.createSourceFile(
		'form.ts',
		source.slice(body.content.start, body.content.end),
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
	const mounts: (() => unknown)[] = [];
	const destroy: (() => void)[] = [];
	const context = {
		fileSaver: { saveAs: vi.fn() },
		Blob,
		AbortController,
		DOMException,
		structuredClone,
		setTimeout,
		clearTimeout,
		getContext: () => ({}),
		$i18n: { t: (s: string) => s },
		onMount: (fn: () => unknown) => mounts.push(fn),
		onDestroy: (fn: () => void) => destroy.push(fn),
		parseConnectionHeaders,
		parseToolConnectionImport,
		parseToolSpec,
		localStorage: { token: 'fixture' },
		toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
		console: { log: vi.fn(), debug: vi.fn(), error: vi.fn() },
		getErrorMessage: (e: unknown) => String(e),
		show: true,
		direct: false,
		edit: false,
		connection: null,
		onSubmit: vi.fn(async () => true),
		onDelete: vi.fn(async () => true),
		getToolServerData: vi.fn(async () => ({ paths: {} })),
		verifyToolServerConnection: vi.fn(async () => ({ status: true })),
		registerOAuthClient: vi.fn(async () => ({ status: true, oauth_client_info: 'fixture' })),
		$settings: { toolServers: [fixture()], terminalServers: [] },
		$terminalServers: [],
		saveSettings: vi.fn(async () => {}),
		getToolServersData: vi.fn(async () => []),
		toolServers: { set: vi.fn() },
		terminalServers: { set: vi.fn() },
		setToolServerConnections: vi.fn(async () => ({ TOOL_SERVER_CONNECTIONS: [] })),
		getToolServerConnections: vi.fn(async () => ({ TOOL_SERVER_CONNECTIONS: [] })),
		getTerminalServerConnections: vi.fn(async () => ({ TERMINAL_SERVER_CONNECTIONS: [] })),
		...extra
	};
	const api = runInNewContext(
		ts.transpileModule(`${script(path)}\n${expose}`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as T;
	return { api, context, mounts, destroy };
};
type Modal = {
	submitHandler: () => Promise<void>;
	init: () => void;
	verifyHandler: () => Promise<void>;
	registerOAuthClientHandler: () => Promise<void>;
	importHandler: (e: object) => Promise<void>;
	deleteHandler: () => Promise<void>;
	setAuth: (auth: string) => void;
	setSpec: (text: string) => void;
	setHeaders: (s: string) => void;
	setUrl: (s: string) => void;
	state: () => {
		show: boolean;
		loading: boolean;
		headers: string;
		url: string;
		oauthClientInfo: string | null;
	};
};
const modal = (extra: Record<string, unknown> = {}) =>
	run<Modal>(
		modalPath,
		'({submitHandler,deleteHandler,init,verifyHandler,registerOAuthClientHandler,importHandler,setAuth:s=>{auth_type=s;},setSpec:s=>{spec=s;spec_type="json";},setHeaders:s=>{headers=s;},setUrl:s=>{url=s;},state:()=>({show,loading,headers,url,oauthClientInfo})})',
		extra
	);
type Parent = {
	addConnectionHandler: (c: ReturnType<typeof fixture>) => Promise<boolean>;
	editConnectionHandler: (idx: number, c: ReturnType<typeof fixture>) => Promise<boolean>;
	deleteConnectionHandler: (idx: number) => Promise<boolean>;
	state: () => unknown[] | null;
};
const parent = (path: string, extra: Record<string, unknown> = {}) =>
	run<Parent>(
		path,
		'({addConnectionHandler,editConnectionHandler,deleteConnectionHandler,state:()=>servers})',
		extra
	);
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

it('preserves the modal draft when the save result is false', async () => {
	const r = modal({ onSubmit: vi.fn(async () => false) });
	r.api.setUrl('draft');
	await r.api.submitHandler();
	expect(r.api.state()).toMatchObject({ show: true, loading: false, url: 'draft' });
});
it('releases loading and keeps the draft after rejection', async () => {
	const r = modal({
		onSubmit: vi.fn(async () => {
			throw new Error('fixture');
		})
	});
	r.api.setUrl('draft');
	await r.api.submitHandler().catch(() => {});
	expect(r.api.state()).toMatchObject({ show: true, loading: false, url: 'draft' });
});
it.each(['null', '{"Authorization":42}'])('rejects headers %s without saving', async (s) => {
	const r = modal();
	r.api.setHeaders(s);
	await r.api.submitHandler();
	expect(r.context.onSubmit).not.toHaveBeenCalled();
	expect(r.api.state().show).toBe(true);
});
it('prevents duplicate submits while a save is pending', async () => {
	let resolve!: (value: boolean) => void;
	const pending = new Promise<boolean>((r) => {
		resolve = r;
	});
	const r = modal({ onSubmit: vi.fn(() => pending) });
	const first = r.api.submitHandler();
	const second = r.api.submitHandler();
	resolve(true);
	await Promise.all([first, second]);
	expect(r.context.onSubmit).toHaveBeenCalledTimes(1);
});
it('initializes a new draft without stale headers', () => {
	const r = modal();
	r.api.setHeaders('{"X-Fixture":"old"}');
	r.api.init();
	expect(r.api.state().headers).toBe('');
});
it.each([userPath, adminPath])('does not publish an unsaved add in %s', async (path) => {
	const r = parent(path, {
		saveSettings: vi.fn(async () => {
			throw new Error('fixture');
		}),
		setToolServerConnections: vi.fn(async () => {
			throw new Error('fixture');
		})
	});
	await r.mounts[0]();
	const before = structuredClone(r.api.state());
	const result = await r.api.addConnectionHandler(fixture()).catch(() => false);
	expect(result).toBe(false);
	expect(r.api.state()).toEqual(before);
});
it('does not log OAuth registration results', async () => {
	const r = modal({ connection: fixture() });
	r.api.init();
	await r.api.registerOAuthClientHandler();
	expect(r.context.console.debug).not.toHaveBeenCalled();
});
it.each([
	getToolServerConnections,
	(token: string) => setToolServerConnections(token, { TOOL_SERVER_CONNECTIONS: [] }),
	(token: string) =>
		registerOAuthClient(token, { url: 'https://fixture.invalid', client_id: 'fixture' }, 'mcp')
])('rejects network failure explicitly', async (call) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => {
			throw new TypeError('fixture');
		})
	);
	await expect(call('fixture')).rejects.toThrow();
});

it('keeps the modal open on failed deletion and closes only on success', async () => {
	const fail = modal({ onDelete: vi.fn(async () => false) });
	await fail.api.deleteHandler();
	expect(fail.api.state()).toMatchObject({ show: true, loading: false });
	const success = modal();
	await success.api.deleteHandler();
	expect(success.api.state().show).toBe(false);
});
it('ignores a late save in a newly initialized draft', async () => {
	let resolve!: (value: boolean) => void;
	const pending = new Promise<boolean>((r) => {
		resolve = r;
	});
	const r = modal({ onSubmit: vi.fn(() => pending) });
	const saving = r.api.submitHandler();
	r.api.init();
	r.api.setUrl('new draft');
	resolve(true);
	await saving;
	expect(r.api.state()).toMatchObject({ show: true, url: 'new draft', loading: false });
});
it('does not publish a save result after destruction', async () => {
	let resolve!: (value: boolean) => void;
	const pending = new Promise<boolean>((r) => {
		resolve = r;
	});
	const r = modal({ onSubmit: vi.fn(() => pending) });
	const saving = r.api.submitHandler();
	r.destroy[0]();
	resolve(true);
	await saving;
	expect(r.api.state().show).toBe(true);
});
it('rejects an invalid import atomically without logging its contents', async () => {
	const r = modal();
	r.api.setUrl('draft');
	await r.api.importHandler({
		currentTarget: {
			files: [
				{ text: async () => JSON.stringify({ url: 'changed', key: 'fixture', headers: null }) }
			],
			value: 'fixture'
		}
	});
	expect(r.api.state().url).toBe('draft');
	expect(r.context.console.log).not.toHaveBeenCalled();
	expect(r.context.toast.success).not.toHaveBeenCalled();
});
it('restores all fields from a valid imported connection and resets stale fields', async () => {
	const r = modal({
		connection: {
			...fixture(),
			info: { id: 'old', oauth_client_info: 'fixture', oauth_client_secret: 'fixture' }
		}
	});
	r.api.init();
	r.api.setHeaders('{"X-Fixture":"old"}');
	await r.api.importHandler({
		currentTarget: { files: [{ text: async () => JSON.stringify([fixture()]) }], value: 'fixture' }
	});
	expect(r.api.state()).toMatchObject({ url: fixture().url, headers: '', oauthClientInfo: null });
});
it.each([
	{ config: { enable: 'yes' } },
	{
		config: {
			access_grants: [{ principal_type: 'user', principal_id: 'fixture', permission: 'owner' }]
		}
	},
	{ info: { id: 42 } },
	{ spec_type: 'json', spec: 'null' },
	{ headers: [] },
	{ path: null }
])('rejects malformed import fields %#', (invalid) => {
	expect(() => parseToolConnectionImport(JSON.stringify({ ...fixture(), ...invalid }))).toThrow();
});
it('clones valid access grants and OAuth fields', () => {
	const input = {
		...fixture(),
		type: 'mcp',
		auth_type: 'oauth_2.1_static',
		config: {
			enable: true,
			access_grants: [{ principal_type: 'user', principal_id: 'fixture', permission: 'read' }]
		},
		info: {
			id: 'fixture',
			oauth_client_info: 'fixture',
			oauth_client_secret: 'fixture',
			oauth_scope: 'read'
		}
	};
	expect(parseToolConnectionImport(JSON.stringify(input))).toEqual(input);
});
it.each(['none', 'session', 'bearer'])(
	'direct verification follows %s and custom headers',
	async (auth) => {
		const r = modal({ direct: true, connection: fixture() });
		r.api.init();
		r.api.setAuth(auth);
		r.api.setHeaders('{"X-Fixture":"fixture"}');
		await r.api.verifyHandler();
		expect(r.context.getToolServerData).toHaveBeenCalledWith(
			auth === 'none' ? '' : 'fixture',
			'https://fixture.invalid/openapi.json',
			{ 'X-Fixture': 'fixture' },
			expect.any(AbortSignal)
		);
		expect(r.context.toast.success).toHaveBeenCalledTimes(1);
	}
);
it('verifies an embedded JSON spec without a network request', async () => {
	const r = modal({ direct: true, connection: fixture() });
	r.api.init();
	r.api.setSpec('{"paths":{}}');
	await r.api.verifyHandler();
	expect(r.context.getToolServerData).not.toHaveBeenCalled();
	expect(r.context.toast.success).toHaveBeenCalledTimes(1);
});
it('does not register twice or publish a stale OAuth response', async () => {
	let resolve!: (value: object) => void;
	const pending = new Promise<object>((r) => {
		resolve = r;
	});
	const r = modal({ connection: fixture(), registerOAuthClient: vi.fn(() => pending) });
	r.api.init();
	const first = r.api.registerOAuthClientHandler();
	await r.api.registerOAuthClientHandler();
	r.api.setUrl('changed');
	resolve({ status: true, oauth_client_info: 'fixture' });
	await first;
	expect(r.context.registerOAuthClient).toHaveBeenCalledTimes(1);
	expect(r.api.state().oauthClientInfo).toBeNull();
});
it('requires re-registration after changing a saved OAuth identity', async () => {
	const r = modal({
		connection: {
			...fixture(),
			type: 'mcp',
			auth_type: 'oauth_2.1',
			info: { id: 'fixture', oauth_client_info: 'fixture' }
		}
	});
	r.api.init();
	r.api.setUrl('changed');
	await r.api.submitHandler();
	expect(r.context.onSubmit).not.toHaveBeenCalled();
	expect(r.api.state().show).toBe(true);
});
it('aborts verification when the modal is destroyed', async () => {
	const verify = vi.fn(
		(_token: string, _data: object, signal: AbortSignal) =>
			new Promise<object>((_, reject) =>
				signal.addEventListener('abort', () => reject(signal.reason))
			)
	);
	const r = modal({ connection: fixture(), verifyToolServerConnection: verify });
	r.api.init();
	const pending = r.api.verifyHandler();
	r.destroy[0]();
	await pending;
	expect(verify.mock.calls[0][2].aborted).toBe(true);
	expect(r.context.toast.success).not.toHaveBeenCalled();
});
it.each([userPath, adminPath])(
	'edit and delete preserve saved state on refusal in %s',
	async (path) => {
		const r = parent(path, {
			getToolServerConnections: vi.fn(async () => ({ TOOL_SERVER_CONNECTIONS: [fixture()] })),
			saveSettings: vi.fn(async () => {
				throw new Error('fixture');
			}),
			setToolServerConnections: vi.fn(async () => {
				throw new Error('fixture');
			})
		});
		await r.mounts[0]();
		const before = structuredClone(r.api.state());
		expect(await r.api.editConnectionHandler(0, { ...fixture(), url: 'changed' })).toBe(false);
		expect(r.api.state()).toEqual(before);
		expect(await r.api.deleteConnectionHandler(0)).toBe(false);
		expect(r.api.state()).toEqual(before);
	}
);
it('does not alias user settings or repeat a persisted add after refresh fails', async () => {
	const r = parent(userPath, {
		getToolServersData: vi.fn(async () => {
			throw new Error('fixture');
		})
	});
	await r.mounts[0]();
	const before = structuredClone(r.context.$settings);
	expect(await r.api.addConnectionHandler(fixture())).toBe(true);
	expect(r.context.saveSettings).toHaveBeenCalledTimes(1);
	expect(r.api.state()).toHaveLength(2);
	expect(r.context.$settings).toEqual(before);
});
it('admin success adopts the backend snapshot', async () => {
	const r = parent(adminPath, {
		setToolServerConnections: vi.fn(async (_token: string, payload: object) => payload)
	});
	await r.mounts[0]();
	expect(await r.api.addConnectionHandler(fixture())).toBe(true);
	expect(r.api.state()).toEqual([fixture()]);
});
it('the shared row awaits save and restores a refused toggle', async () => {
	const path = 'src/lib/components/chat/Settings/Tools/Connection.svelte';
	const r = run<{
		submitHandler: (c: ReturnType<typeof fixture>) => Promise<boolean>;
		toggleHandler: () => Promise<void>;
		state: () => ReturnType<typeof fixture>;
	}>(path, '({submitHandler,toggleHandler,state:()=>connection})', {
		connection: fixture(),
		onSubmit: vi.fn(async () => false)
	});
	expect(await r.api.submitHandler({ ...fixture(), url: 'changed' })).toBe(false);
	expect(r.api.state()).toEqual(fixture());
	await r.api.toggleHandler();
	expect(r.api.state().config.enable).toBe(true);
});
it('JSON and YAML spec readers work without dumping responses', async () => {
	const fetch = vi.fn(
		async (url: string) =>
			new Response(
				url.endsWith('.yaml') ? 'openapi: 3.0.0\npaths: {}\n' : JSON.stringify({ paths: {} }),
				{ status: 200 }
			)
	);
	vi.stubGlobal('fetch', fetch);
	expect(await getToolServerData('', 'https://fixture.invalid/openapi.yaml')).toMatchObject({
		paths: {}
	});
	expect(await getToolServerData('', 'https://fixture.invalid/openapi.json')).toMatchObject({
		paths: {}
	});
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('null', { status: 200 }))
	);
	await expect(getToolServerData('', 'https://fixture.invalid/openapi.json')).rejects.toThrow();
});
it('actual catalog loading sends custom headers and enables legacy connections', async () => {
	const fetch = vi.fn<[string, RequestInit], Promise<Response>>(
		async () => new Response(JSON.stringify({ paths: {} }), { status: 200 })
	);
	vi.stubGlobal('fetch', fetch);
	const c = {
		...fixture(),
		config: undefined,
		headers: { 'X-Fixture': 'fixture' },
		auth_type: 'none'
	};
	expect(await getToolServersData([c, { url: undefined }, null])).toHaveLength(1);
	expect(fetch.mock.calls[0][1]).toMatchObject({ headers: { 'X-Fixture': 'fixture' } });
	expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('authorization');
});
it('config POST timeout fails once and leaves no timer', async () => {
	vi.useFakeTimers();
	const fetch = vi.fn(
		(_url: string, init: RequestInit) =>
			new Promise<Response>((_, reject) =>
				init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
			)
	);
	vi.stubGlobal('fetch', fetch);
	const rejected = expect(
		setToolServerConnections('fixture', { TOOL_SERVER_CONNECTIONS: [] })
	).rejects.toThrow();
	await vi.advanceTimersByTimeAsync(60000);
	await rejected;
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(vi.getTimerCount()).toBe(0);
	vi.useRealTimers();
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('{}', { status: 200 }))
	);
	await expect(getToolServerConnections('fixture')).rejects.toThrow();
	await expect(
		setToolServerConnections('fixture', { TOOL_SERVER_CONNECTIONS: [] })
	).rejects.toThrow();
});
