// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { createInstance } from 'i18next';
import { marked } from 'marked';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import ts from 'typescript';
import { expect, it, vi, type Mock } from 'vitest';
import EditUserModal from '$lib/components/admin/Users/UserList/EditUserModal.svelte';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({ activate() {}, deactivate() {}, pause() {}, unpause() {} })
}));
vi.mock('$lib/components/chat/Settings/Account/UserProfileImage.svelte', () => ({
	default: () => {}
}));
vi.mock('$lib/apis/users', () => ({
	updateUserById: vi.fn(),
	getUserGroupsById: async () => []
}));
vi.mock('$lib/apis/admin/billing', () => ({
	getUserSubscription: async () => null,
	getActivePlans: async () => [],
	getUserWalletAdmin: async () => null,
	changeUserSubscription: vi.fn(),
	adjustUserWalletAdmin: vi.fn()
}));

const compile = (source: string): string =>
	ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

// Run the actual handler without mounting unrelated terminal/editor children.
const action = (file: string, name: string, inputs: Record<string, unknown>): unknown => {
	const source = readFileSync(file, 'utf8').match(/<script lang="ts">([\s\S]*?)<\/script>/)?.[1];
	if (!source) throw new Error('Missing component script');
	const ast = ts.createSourceFile(file + '.ts', source, ts.ScriptTarget.Latest, true);
	let expression = '';
	const visit = (node: ts.Node): void => {
		if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer)
			expression = node.initializer.getText(ast);
		ts.forEachChild(node, visit);
	};
	visit(ast);
	if (!expression) throw new Error('Missing actual handler: ' + name);
	return new Function(
		...Object.keys(inputs),
		compile(`const action = ${expression};`) + 'return action;'
	)(...Object.values(inputs));
};

it('ignores missing terminal ids before changing selection or settings', async () => {
	const selectedTerminalId = { set: vi.fn() };
	const settings = { set: vi.fn() };
	const refresh = vi.fn();
	const select = action(
		'src/lib/components/chat/MessageInput/TerminalMenu.svelte',
		'selectSystem',
		{
			selectedTerminalId,
			settings,
			$selectedTerminalId: 'existing',
			$settings: { terminalServers: [{ url: 'https://fixture.invalid', enabled: true }] },
			refreshTerminalServersStore: refresh,
			show: true
		}
	) as (terminal: { id?: string }) => Promise<void>;
	await select({});
	expect(selectedTerminalId.set).not.toHaveBeenCalled();
	expect(settings.set).not.toHaveBeenCalled();
	expect(refresh).not.toHaveBeenCalled();
	await select({ id: 'valid' });
	expect(selectedTerminalId.set).toHaveBeenCalledWith('valid');
	expect(refresh).toHaveBeenCalledWith([{ url: 'https://fixture.invalid', enabled: false }]);
	await select({ id: 'existing' });
	expect(selectedTerminalId.set).toHaveBeenLastCalledWith('existing');
});

it('ignores empty downloads and preserves file/directory download contracts', async () => {
	const toast = { loading: vi.fn(() => 'toast'), dismiss: vi.fn(), error: vi.fn() };
	const result = { blob: new Blob(['fixture']), filename: 'fixture.txt' };
	const downloadFileBlob = vi.fn(async () => result);
	const archiveFromTerminal = vi.fn(async () => result);
	const urls = { createObjectURL: vi.fn(() => 'blob:fixture'), revokeObjectURL: vi.fn() };
	const link = { click: vi.fn(), href: '', download: '' };
	const download = action('src/lib/components/chat/FileNav.svelte', 'downloadFile', {
		selectedTerminal: { url: 'https://fixture.invalid', key: 'fixture' },
		downloading: false,
		chatId: 'chat-fixture',
		toast,
		$i18n: { t: (text: string) => text },
		downloadFileBlob,
		archiveFromTerminal,
		URL: urls,
		document: { createElement: () => link }
	}) as (path: string | null) => Promise<void>;
	await download(null);
	await download('');
	expect(toast.loading).not.toHaveBeenCalled();
	expect(downloadFileBlob).not.toHaveBeenCalled();
	expect(archiveFromTerminal).not.toHaveBeenCalled();
	await download('/fixture.txt');
	expect(downloadFileBlob).toHaveBeenCalledWith(
		'https://fixture.invalid',
		'fixture',
		'/fixture.txt',
		'chat-fixture'
	);
	await download('/folder/');
	expect(archiveFromTerminal).toHaveBeenCalledWith('https://fixture.invalid', 'fixture', [
		'/folder'
	]);
	expect(link.click).toHaveBeenCalledTimes(2);
	expect(link.download).toBe('fixture.txt');
	expect(urls.revokeObjectURL).toHaveBeenCalledTimes(2);
	expect(toast.dismiss).toHaveBeenCalledTimes(2);
});

type AudioResult = { toBlob: () => Promise<Blob> };
type SpeechModel = { generate: Mock<[], Promise<AudioResult>> };

const worker = (
	wasm: object | null = {},
	gpu = false
): {
	post: ReturnType<typeof vi.fn>;
	load: Mock<[], Promise<SpeechModel>>;
	generate: SpeechModel['generate'];
	send: (type: string, payload?: object) => Promise<void>;
} => {
	const source = readFileSync('src/lib/workers/kokoro.worker.ts', 'utf8').replace(
		/^import .*;\n/gm,
		''
	);
	const post = vi.fn();
	const generate = vi.fn(async () => ({ toBlob: async () => new Blob(['audio']) }));
	const load = vi.fn(async () => ({ generate }));
	const self: {
		postMessage: typeof post;
		onmessage: (event: object) => Promise<void>;
	} = { postMessage: post, onmessage: async () => {} };
	new Function('env', 'KokoroTTS', 'self', 'navigator', 'URL', compile(source))(
		{ backends: { onnx: { wasm: wasm ?? undefined } } },
		{ from_pretrained: load },
		self,
		{ gpu: gpu ? {} : undefined },
		{ createObjectURL: () => 'blob:audio' }
	);
	return {
		post,
		load,
		generate,
		send: (type, payload = {}) => self.onmessage({ data: { type, payload } })
	};
};

it('loads the worker when the optional wasm backend is absent', async () => {
	const w = worker(null);
	await w.send('status');
	expect(w.post).toHaveBeenCalledWith({ status: 'status:check', initialized: false });
});

it.each([false, true])('preserves successful speech generation, WebGPU=%s', async (gpu) => {
	const w = worker({}, gpu);
	await w.send('generate', { text: 'before init' });
	expect(w.post).toHaveBeenLastCalledWith({
		status: 'generate:error',
		error: 'TTS model not initialized'
	});
	await w.send('init', { dtype: 'q8' });
	expect(w.load).toHaveBeenCalledWith('onnx-community/Kokoro-82M-v1.0-ONNX', {
		dtype: 'q8',
		device: gpu ? 'webgpu' : 'wasm'
	});
	await w.send('generate', { text: 'fixture', voice: 'af_heart' });
	expect(w.generate).toHaveBeenCalledWith('fixture', { voice: 'af_heart' });
	expect(w.post).toHaveBeenLastCalledWith({ status: 'generate:complete', audioUrl: 'blob:audio' });
});

it.each([null, undefined, new Error('fixture failure')])(
	'reports init and generate rejections safely: %s',
	async (reason) => {
		const w = worker();
		w.load.mockRejectedValueOnce(reason);
		await w.send('init');
		expect(w.post).toHaveBeenLastCalledWith({
			status: 'init:error',
			error: reason instanceof Error ? reason.message : 'Failed to initialize TTS model'
		});
		await w.send('status');
		expect(w.post).toHaveBeenLastCalledWith({ status: 'status:check', initialized: false });
		await w.send('init');
		w.generate.mockRejectedValueOnce(reason);
		await w.send('generate', { text: 'fixture' });
		expect(w.post).toHaveBeenLastCalledWith({
			status: 'generate:error',
			error: reason instanceof Error ? reason.message : 'Failed to generate speech'
		});
	}
);

it('keeps alert parsing for tokens with and without text', () => {
	const source = readFileSync(
		'src/lib/components/chat/Messages/Markdown/AlertRenderer.svelte',
		'utf8'
	);
	const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '';
	const ast = ts.createSourceFile('alert.ts', script, ts.ScriptTarget.Latest, true);
	const declaration = ast.statements.find(
		(node) => ts.isFunctionDeclaration(node) && node.name?.text === 'alertComponent'
	);
	if (!declaration) throw new Error('Missing actual alert parser');
	const parse = new Function(
		'marked',
		compile(declaration.getText(ast).replace('export ', '')) + 'return alertComponent;'
	)(marked) as (token: object) => false | { type: string; text: string; tokens: object[] };
	expect(parse({ type: 'space', raw: '\n' })).toBe(false);
	expect(parse({ type: 'text', text: 'ordinary' })).toBe(false);
	for (const type of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
		const result = parse({ type: 'blockquote', text: `[!${type}]\n**fixture**` });
		expect(result).toEqual({ type, text: '**fixture**', tokens: marked.lexer('**fixture**') });
	}
});

it.each([null, 'self', 'other'])(
	'renders nullable user props and keeps the role guard: %s',
	async (sessionId) => {
		const i18n = createInstance();
		await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(EditUserModal, {
			target,
			context: new Map([['i18n', writable(i18n)]]),
			props: {
				show: true,
				selectedUser: sessionId
					? {
							id: 'self',
							name: 'Fixture user',
							email: 'fixture@example.invalid',
							role: 'user',
							profile_image_url: ''
						}
					: null,
				sessionUser: sessionId ? { id: sessionId, role: 'admin' } : null
			}
		});
		try {
			await tick();
			const select = document.querySelector<HTMLSelectElement>('select[aria-label="Role"]');
			expect(select).not.toBeNull();
			expect(select?.disabled).toBe(sessionId !== 'other');
			if (sessionId) expect(document.body.textContent).toContain('Fixture user');
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);
