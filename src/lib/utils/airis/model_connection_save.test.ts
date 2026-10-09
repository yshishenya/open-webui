// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import type { Settings } from '$lib/stores';
import { getOpenAIConfig, updateOpenAIConfig, verifyOpenAIConnection } from '$lib/apis/openai';
import { getOllamaConfig, updateOllamaConfig, verifyOllamaConnection } from '$lib/apis/ollama';
import { parseConnectionHeaders } from './model_connection_request';

vi.mock('$lib/constants', () => ({
	OPENAI_API_BASE_URL: '/openai',
	OLLAMA_API_BASE_URL: '/ollama',
	WEBUI_BASE_URL: ''
}));

const modalPath = 'src/lib/components/AddConnectionModal.svelte';
const userPath = 'src/lib/components/chat/Settings/Connections.svelte';
const adminPath = 'src/lib/components/admin/Settings/Connections.svelte';
const connection = { url: 'https://fixture.invalid/v1', key: 'fixture', config: { enable: true } };
const directConfig = () => ({
	OPENAI_API_BASE_URLS: ['old'],
	OPENAI_API_KEYS: ['old'],
	OPENAI_API_CONFIGS: { '0': { enable: true } }
});
const scriptBody = (path: string, only?: string): string => {
	const source = readFileSync(path, 'utf8');
	const script = parse(source).instance;
	if (!script) throw new Error('Missing script');
	const parsed = ts.createSourceFile(
		'form.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	return parsed.statements
		.filter(
			(s) =>
				!only ||
				(ts.isVariableStatement(s) &&
					s.declarationList.declarations.some((d) => d.name.getText(parsed) === only))
		)
		.filter(
			(s) =>
				!ts.isImportDeclaration(s) &&
				!ts.isLabeledStatement(s) &&
				!(
					ts.isVariableStatement(s) &&
					s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
				)
		)
		.map((s) => s.getText(parsed))
		.join('\n');
};
const run = <T>(
	path: string,
	expose: string,
	extra: Record<string, unknown> = {},
	only?: string
) => {
	const mount: (() => unknown)[] = [];
	const context = {
		AbortController,
		DOMException,
		structuredClone,
		setTimeout,
		clearTimeout,
		parseConnectionHeaders,
		getContext: () => ({}),
		$i18n: { t: (s: string) => s },
		onMount: (fn: () => unknown) => mount.push(fn),
		onDestroy: vi.fn(),
		localStorage: { token: 'fixture' },
		toast: { error: vi.fn(), success: vi.fn() },
		getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
		createEventDispatcher: () => vi.fn(),
		$config: { features: {} },
		$settings: { directConnections: directConfig() },
		$user: { role: 'user' },
		models: { set: vi.fn() },
		settings: { set: vi.fn() },
		config: { set: vi.fn() },
		_getModels: vi.fn(async () => []),
		getBackendConfig: vi.fn(async () => ({})),
		getOpenAIConfig: vi.fn(),
		getOllamaConfig: vi.fn(),
		getConnectionsConfig: vi.fn(),
		updateOpenAIConfig: vi.fn(async (_token: string, payload: object) => payload),
		updateOllamaConfig: vi.fn(async (_token: string, payload: object) => payload),
		setConnectionsConfig: vi.fn(),
		updateUserSettings: vi.fn(async () => ({ ui: {} })),
		getModels: vi.fn(async () => []),
		getOpenAIModels: vi.fn(),
		saveSettings: vi.fn(async () => {}),
		console: { log: vi.fn(), error: vi.fn() },
		onSubmit: vi.fn<[typeof connection], Promise<boolean | void>>(async () => {}),
		onDelete: vi.fn<[], Promise<boolean | void>>(async () => {}),
		show: true,
		edit: false,
		ollama: false,
		direct: false,
		azure: false,
		connection: null,
		verifyOpenAIConnection: vi.fn(async () => ({})),
		verifyOllamaConnection: vi.fn(async () => ({})),
		...extra
	};
	const api = runInNewContext(
		ts.transpileModule(`${scriptBody(path, only)}\n${expose}`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as T;
	return { api, context, mount };
};
type ModalRig = {
	submitHandler: () => Promise<void>;
	deleteHandler: () => Promise<void>;
	verifyHandler: () => Promise<void>;
	init: () => void;
	setHeaders: (s: string) => void;
	setUrl: (s: string) => void;
	close: () => void;
	state: () => { loading: boolean; show: boolean; url: string; key: string };
};
type UserRig = {
	editConnectionHandler: (idx: number, c: typeof connection) => Promise<boolean>;
	deleteConnectionHandler: (idx: number) => Promise<boolean>;
	addConnectionHandler: (c: typeof connection) => Promise<boolean | void>;
	updateHandler: () => Promise<boolean | void>;
	state: () => ReturnType<typeof directConfig>;
};
type AdminRig = {
	editOpenAIConnectionHandler: (idx: number, c: typeof connection) => Promise<boolean>;
	editOllamaConnectionHandler: (idx: number, c: typeof connection) => Promise<boolean>;
	deleteOpenAIConnectionHandler: (idx: number) => Promise<boolean>;
	deleteOllamaConnectionHandler: (idx: number) => Promise<boolean>;
	addOpenAIConnectionHandler: (c: typeof connection) => Promise<boolean | void>;
	addOllamaConnectionHandler: (c: typeof connection) => Promise<boolean | void>;
	submitHandler: () => Promise<void>;
	init: () => void;
	state: () => object;
};
const modal = () =>
	run<ModalRig>(
		modalPath,
		`({submitHandler,deleteHandler,verifyHandler,init,close:()=>{show=false;},setHeaders:s=>{headers=s;},setUrl:s=>{url=s;},state:()=>({loading,show,url,key})})`
	);
const user = () =>
	run<UserRig>(
		userPath,
		'({addConnectionHandler,editConnectionHandler,deleteConnectionHandler,updateHandler,state:()=>config})'
	);
const admin = () =>
	run<AdminRig>(
		adminPath,
		`({addOpenAIConnectionHandler,addOllamaConnectionHandler,editOpenAIConnectionHandler,editOllamaConnectionHandler,deleteOpenAIConnectionHandler,deleteOllamaConnectionHandler,submitHandler,init:()=>{ENABLE_OPENAI_API=true;ENABLE_OLLAMA_API=true;OPENAI_API_BASE_URLS=['old'];OPENAI_API_KEYS=['old'];OPENAI_API_CONFIGS={'0':{}};OLLAMA_BASE_URLS=['old'];OLLAMA_API_CONFIGS={'0':{}};},state:()=>({OPENAI_API_BASE_URLS,OPENAI_API_KEYS,OPENAI_API_CONFIGS,OLLAMA_BASE_URLS,OLLAMA_API_CONFIGS})})`
	);
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

it.each(['{', 'null', '[]', '{"X-Test": 7}'])(
	'invalid headers %s release loading without saving',
	async (value) => {
		const { api, context } = modal();
		api.setUrl(connection.url);
		api.setHeaders(value);
		await api.submitHandler();
		expect(api.state()).toMatchObject({ loading: false, show: true });
		expect(context.onSubmit).not.toHaveBeenCalled();
	}
);
it('save rejection keeps modal draft and releases loading', async () => {
	const { api, context } = modal();
	api.setUrl(connection.url);
	context.onSubmit.mockRejectedValueOnce(new Error('fixture save failed'));
	await expect(api.submitHandler()).resolves.toBeUndefined();
	expect(api.state()).toMatchObject({ loading: false, show: true, url: connection.url });
	expect(context.toast.error).toHaveBeenCalled();
});
it('false save result is not accepted as success', async () => {
	const { api, context } = modal();
	api.setUrl(connection.url);
	context.onSubmit.mockResolvedValueOnce(false);
	await api.submitHandler();
	expect(api.state().show).toBe(true);
});
it('concurrent submits call save once', async () => {
	const { api, context } = modal();
	api.setUrl(connection.url);
	let finish!: () => void;
	context.onSubmit.mockImplementationOnce(
		() =>
			new Promise<void>((r) => {
				finish = r;
			})
	);
	const first = api.submitHandler();
	const second = api.submitHandler();
	finish();
	await Promise.all([first, second]);
	expect(context.onSubmit).toHaveBeenCalledTimes(1);
});
it('editing legacy connection without config is safe', () => {
	const rig = run<ModalRig>(modalPath, '({init,state:()=>({url})})', {
		connection: { url: 'old', key: '' }
	});
	expect(() => rig.api.init()).not.toThrow();
	expect(rig.api.state().url).toBe('old');
});
it('rejected direct add does not mutate shared settings or local list', async () => {
	const { api, context, mount } = user();
	await mount[0]();
	const before = structuredClone(context.$settings.directConnections);
	context.saveSettings.mockRejectedValueOnce(new Error('fixture failure'));
	await api.addConnectionHandler(connection).catch(() => {});
	expect(context.$settings.directConnections).toEqual(before);
	expect(api.state()).toEqual(before);
});
it.each(['OpenAI', 'Ollama'])(
	'rejected admin %s add returns failure and preserves lists',
	async (provider) => {
		const { api, context } = admin();
		api.init();
		const before = structuredClone(api.state());
		const save = provider === 'OpenAI' ? context.updateOpenAIConfig : context.updateOllamaConfig;
		save.mockRejectedValueOnce(new Error('fixture failure'));
		const result = await (
			provider === 'OpenAI' ? api.addOpenAIConnectionHandler : api.addOllamaConnectionHandler
		)(connection);
		expect(result).toBe(false);
		expect(api.state()).toEqual(before);
	}
);

it('success closes modal and clears draft', async () => {
	const { api, context } = modal();
	api.setUrl(connection.url);
	await api.submitHandler();
	expect(api.state()).toMatchObject({ show: false, loading: false, url: '' });
	expect(context.onSubmit).toHaveBeenCalledTimes(1);
});
it('failed delete preserves modal and releases loading', async () => {
	const { api, context } = modal();
	api.setUrl(connection.url);
	context.onDelete.mockResolvedValueOnce(false);
	await api.deleteHandler();
	expect(api.state()).toMatchObject({ show: true, loading: false, url: connection.url });
});
it('closed and reopened draft is not cleared by old save', async () => {
	const { api, context } = modal();
	api.setUrl(connection.url);
	let finish!: () => void;
	context.onSubmit.mockImplementationOnce(
		() =>
			new Promise<void>((r) => {
				finish = r;
			})
	);
	const saving = api.submitHandler();
	api.close();
	api.init();
	api.setUrl('new-draft');
	finish();
	await saving;
	expect(api.state().url).toBe('new-draft');
});
it('destroy aborts verification and prevents late success toast', async () => {
	const { api, context } = modal();
	api.setUrl(connection.url);
	let finish!: () => void;
	context.verifyOpenAIConnection.mockImplementationOnce(
		() =>
			new Promise((r) => {
				finish = () => r({});
			})
	);
	const verifying = api.verifyHandler();
	context.onDestroy.mock.calls[0][0]();
	finish();
	await verifying;
	expect(context.toast.success).not.toHaveBeenCalled();
	expect(context.toast.error).not.toHaveBeenCalled();
});
it('direct edit/delete persist aligned snapshots; rejected delete preserves list', async () => {
	const { api, context, mount } = user();
	await mount[0]();
	expect(await api.addConnectionHandler(connection)).toBe(true);
	expect(await api.editConnectionHandler(0, connection)).toBe(true);
	const before = structuredClone(api.state());
	context.saveSettings.mockRejectedValueOnce(new Error('fixture'));
	expect(await api.deleteConnectionHandler(0)).toBe(false);
	expect(api.state()).toEqual(before);
	expect(await api.deleteConnectionHandler(0)).toBe(true);
	expect(api.state()).toMatchObject({
		OPENAI_API_BASE_URLS: [connection.url],
		OPENAI_API_KEYS: ['fixture'],
		OPENAI_API_CONFIGS: { '0': connection.config }
	});
	expect(context.$settings.directConnections).toEqual(directConfig());
});
it.each(['OpenAI', 'Ollama'])(
	'admin %s edit/delete preserve list on failure and reindex after success',
	async (provider) => {
		const { api, context } = admin();
		api.init();
		const add =
			provider === 'OpenAI' ? api.addOpenAIConnectionHandler : api.addOllamaConnectionHandler;
		const edit =
			provider === 'OpenAI' ? api.editOpenAIConnectionHandler : api.editOllamaConnectionHandler;
		const remove =
			provider === 'OpenAI' ? api.deleteOpenAIConnectionHandler : api.deleteOllamaConnectionHandler;
		const save = provider === 'OpenAI' ? context.updateOpenAIConfig : context.updateOllamaConfig;
		expect(await add(connection)).toBe(true);
		const before = structuredClone(api.state());
		save.mockRejectedValueOnce(new Error('fixture'));
		expect(await edit(0, connection)).toBe(false);
		expect(api.state()).toEqual(before);
		save.mockRejectedValueOnce(new Error('fixture'));
		expect(await remove(0)).toBe(false);
		expect(api.state()).toEqual(before);
		expect(await remove(0)).toBe(true);
		const expected =
			provider === 'OpenAI'
				? {
						OPENAI_API_BASE_URLS: [connection.url],
						OPENAI_API_KEYS: ['fixture'],
						OPENAI_API_CONFIGS: { '0': connection.config }
					}
				: {
						OLLAMA_BASE_URLS: [connection.url],
						OLLAMA_API_CONFIGS: { '0': { ...connection.config, key: 'fixture' } }
					};
		expect(api.state()).toMatchObject(expected);
	}
);
it.each([
	'admin/Settings/Connections/OpenAIConnection',
	'admin/Settings/Connections/OllamaConnection',
	'chat/Settings/Connections/Connection'
])('%s wrapper awaits result before publishing changes', async (path) => {
	const rig = run<{
		submitConnection: (c: typeof connection) => Promise<boolean>;
		state: () => { url: string; config: object };
	}>(`src/lib/components/${path}.svelte`, '({submitConnection,state:()=>({url,config})})', {
		url: 'old',
		key: 'old',
		config: { enable: false }
	});
	rig.context.onSubmit.mockResolvedValueOnce(false);
	expect(await rig.api.submitConnection(connection)).toBe(false);
	expect(rig.api.state()).toEqual({ url: 'old', config: { enable: false } });
	rig.context.onSubmit.mockRejectedValueOnce(new Error('fixture'));
	await expect(rig.api.submitConnection(connection)).rejects.toThrow('fixture');
	expect(rig.api.state().url).toBe('old');
	expect(await rig.api.submitConnection(connection)).toBe(true);
	expect(rig.api.state().url).toBe(connection.url);
});
it('shared settings persist before publishing and keep success on model refresh failure', async () => {
	const rig = run<{ saveSettings: (s: Partial<Settings>) => Promise<void> }>(
		'src/lib/components/chat/SettingsModal.svelte',
		'({saveSettings})',
		{},
		'saveSettings'
	);
	rig.context.updateUserSettings.mockRejectedValueOnce(new Error('fixture'));
	await expect(rig.api.saveSettings({ directConnections: directConfig() })).rejects.toThrow(
		'fixture'
	);
	expect(rig.context.settings.set).not.toHaveBeenCalled();
	expect(rig.context.getModels).not.toHaveBeenCalled();
	expect(rig.context.console.log).not.toHaveBeenCalled();
	rig.context.getModels.mockRejectedValueOnce(new Error('fixture refresh'));
	await expect(
		rig.api.saveSettings({ directConnections: directConfig() })
	).resolves.toBeUndefined();
	expect(rig.context.settings.set).toHaveBeenCalledTimes(1);
});
const apiCalls: [string, () => Promise<unknown>][] = [
	['OpenAI read', () => getOpenAIConfig('fixture')],
	[
		'OpenAI save',
		() => updateOpenAIConfig('fixture', { ...directConfig(), ENABLE_OPENAI_API: true })
	],
	['OpenAI verify', () => verifyOpenAIConnection('fixture', connection)],
	['Ollama read', () => getOllamaConfig('fixture')],
	[
		'Ollama save',
		() =>
			updateOllamaConfig('fixture', {
				ENABLE_OLLAMA_API: true,
				OLLAMA_BASE_URLS: ['old'],
				OLLAMA_API_CONFIGS: {}
			})
	],
	['Ollama verify', () => verifyOllamaConnection('fixture', connection)]
];
it.each(apiCalls)('%s HTTP failure has detail and no automatic retry', async (_name, call) => {
	const fetcher = vi.fn(
		async () => new Response(JSON.stringify({ detail: 'fixture refused' }), { status: 403 })
	);
	vi.stubGlobal('fetch', fetcher);
	await expect(call()).rejects.toThrow('fixture refused');
	expect(fetcher).toHaveBeenCalledTimes(1);
});
it('direct verification respects selected auth and headers', async () => {
	const fetcher = vi.fn(async () => new Response('{}'));
	vi.stubGlobal('fetch', fetcher);
	await verifyOpenAIConnection(
		'session-fixture',
		{ ...connection, config: { auth_type: 'none', headers: { 'X-Test': 'value' } } },
		true
	);
	expect(fetcher).toHaveBeenLastCalledWith(
		`${connection.url}/models`,
		expect.objectContaining({
			method: 'GET',
			headers: { 'Content-Type': 'application/json', 'X-Test': 'value' }
		})
	);
	await verifyOpenAIConnection(
		'session-fixture',
		{ ...connection, config: { auth_type: 'session' } },
		true
	);
	expect(fetcher).toHaveBeenLastCalledWith(
		`${connection.url}/models`,
		expect.objectContaining({
			headers: expect.objectContaining({ Authorization: 'Bearer session-fixture' })
		})
	);
});
it('pre-aborted request never reaches network', async () => {
	const controller = new AbortController();
	controller.abort();
	const fetcher = vi.fn();
	vi.stubGlobal('fetch', fetcher);
	await expect(getOpenAIConfig('fixture', controller.signal)).rejects.toThrow();
	expect(fetcher).not.toHaveBeenCalled();
});
it('config timeout covers a stalled response body and releases its timer', async () => {
	vi.useFakeTimers();
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, options: RequestInit) => ({
			ok: true,
			json: () =>
				new Promise((_resolve, reject) =>
					options.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
						once: true
					})
				)
		}))
	);
	const assertion = expect(getOllamaConfig('fixture')).rejects.toThrow('timed out');
	await vi.advanceTimersByTimeAsync(60_000);
	await assertion;
	expect(vi.getTimerCount()).toBe(0);
});
it('null result cannot be accepted as a saved configuration', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('null'))
	);
	await expect(getOpenAIConfig('fixture')).rejects.toThrow('no result');
});
