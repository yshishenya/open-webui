// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { updateUserSettings } from '$lib/apis/users';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
vi.mock('$lib/utils', () => ({ getUserPosition: vi.fn() }));
import { getErrorMessage } from './error_message';

const body = (
	path: string,
	only?: string[]
): { code: string; reactive: string; source: string } => {
	const source = readFileSync(path, 'utf8'),
		script = parse(source).instance;
	if (!script) throw new Error('Missing script');
	const parsed = ts.createSourceFile(
		'settings.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const selected = parsed.statements.filter(
		(s) =>
			!ts.isImportDeclaration(s) &&
			(!only ||
				(ts.isVariableStatement(s) &&
					s.declarationList.declarations.some((d) => only.includes(d.name.getText(parsed)))))
	);
	return {
		source,
		code: selected
			.filter((s) => !ts.isLabeledStatement(s))
			.map((s) => s.getText(parsed).replace(/^export /, ''))
			.join('\n'),
		reactive: selected
			.filter(ts.isLabeledStatement)
			.map((s) => s.getText(parsed).replace(/^\$:/, ''))
			.join('\n')
	};
};
const run = <T>(code: string, context: Record<string, unknown>): T =>
	runInNewContext(
		ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
		context
	) as T;
const pending = <T>() => {
	let resolve!: (v: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { resolve, promise };
};
const flush = async () => {
	await Promise.resolve();
	await Promise.resolve();
};
const interfaceRig = () => {
	const { code, source } = body('src/lib/components/chat/Settings/Interface.svelte');
	const readers: {
		result: string | ArrayBuffer | null;
		onload: ((event: { target: { result: string | ArrayBuffer | null } }) => void) | null;
		onerror: (() => void) | null;
		readAsDataURL: ReturnType<typeof vi.fn>;
		abort: ReturnType<typeof vi.fn>;
	}[] = [];
	class Input {
		value = 'background.png';
		files: { type: string }[] = [{ type: 'image/png' }];
	}
	class Reader {
		result: string | ArrayBuffer | null = null;
		onload: ((event: { target: { result: string | ArrayBuffer | null } }) => void) | null = null;
		onerror: (() => void) | null = null;
		readAsDataURL = vi.fn();
		abort = vi.fn();
		constructor() {
			readers.push(this);
		}
	}
	const mount: (() => unknown)[] = [],
		destroy: (() => void)[] = [];
	const context = {
		FileReader: Reader,
		HTMLInputElement: Input,
		structuredClone,
		getErrorMessage,
		createEventDispatcher: () => vi.fn(),
		getContext: () => ({}),
		$i18n: { t: (s: string) => s },
		$settings: {},
		$config: {},
		$user: null,
		saveSettings: vi.fn(async () => {}),
		setTextScale: vi.fn(),
		getUserPosition: vi.fn(async () => 'fixture location'),
		updateUserInfo: vi.fn(async () => ({})),
		localStorage: { token: 'fixture' },
		navigator: { clipboard: { readText: vi.fn(async () => 'private contents') } },
		toast: { error: vi.fn(), success: vi.fn() },
		console: { log: vi.fn() },
		onMount: (fn: () => unknown) => mount.push(fn),
		onDestroy: (fn: () => void) => destroy.push(fn)
	};
	const old = source
		.slice(source.indexOf('bind:files={inputFiles}'))
		.match(/on:change=\{([\s\S]*?)\n\t\t\}\}/)?.[1];
	const upload = code.includes('uploadBackgroundImage') ? 'uploadBackgroundImage' : old + '\n}';
	const api = run<{
		upload: (e: { currentTarget: Input; target: Input }) => void;
		state: () => { background: string | null };
		auto: (v: boolean) => Promise<unknown>;
		setBackground: (v: string | null) => void;
		bind: (input: Input) => void;
		setSave: (fn: typeof context.saveSettings) => void;
		location: (value: boolean) => Promise<void>;
	}>(
		code +
			`\n({upload:${upload},state:()=>({background:backgroundImageUrl}),bind:(input)=>{if(typeof inputFiles!=='undefined')inputFiles=input.files;},setSave:(fn)=>saveSettings=fn,location:(v)=>{userLocation=v;return toggleUserLocation();},auto:(v)=>{responseAutoCopy=v;return toggleResponseAutoCopy();},setBackground:(v)=>backgroundImageUrl=v})`,
		context
	);
	api.setSave(context.saveSettings);
	api.setBackground('old');
	const input = new Input();
	return {
		api,
		context,
		readers,
		input,
		start: () => {
			// The old handler uses Svelte's bound FileList; expose the same native input.
			api.bind(input);
			api.upload({ currentTarget: input, target: input });
		},
		destroy: () => destroy.forEach((f) => f())
	};
};
// Inject the bound input in the original handler as Svelte would do before change.
const backgroundRig = () => {
	const r = interfaceRig();
	return r;
};
it('ignores a cancelled background file selection', () => {
	const r = backgroundRig();
	r.input.files = [];
	expect(() => r.start()).not.toThrow();
	expect(r.context.saveSettings).not.toHaveBeenCalled();
	expect(r.api.state().background).toBe('old');
});
it('clears the real input and saves only a string data URL', async () => {
	const r = backgroundRig();
	r.start();
	const reader = r.readers[0];
	expect(reader).toBeDefined();
	reader.result = 'data:image/png;base64,AA==';
	reader.onload?.({ target: reader });
	await flush();
	expect(r.input.value).toBe('');
	expect(r.context.saveSettings).toHaveBeenCalledWith({ backgroundImageUrl: reader.result });
});
it('preserves the background on read failure', () => {
	const r = backgroundRig();
	r.start();
	r.readers[0]?.onerror?.();
	expect(r.api.state().background).toBe('old');
	expect(r.context.toast.error).toHaveBeenCalledTimes(1);
});
it('ignores background reads after destruction', async () => {
	const r = backgroundRig();
	r.start();
	r.destroy();
	const reader = r.readers[0];
	if (reader) {
		reader.result = 'data:image/png;base64,late';
		reader.onload?.({ target: reader });
	}
	await flush();
	expect(r.context.saveSettings).not.toHaveBeenCalled();
	expect(r.api.state().background).toBe('old');
});
it('enabling and disabling auto copy never reads clipboard contents', async () => {
	const r = backgroundRig();
	await r.api.auto(true);
	await r.api.auto(false);
	expect(r.context.navigator.clipboard.readText).not.toHaveBeenCalled();
	expect(r.context.saveSettings).toHaveBeenLastCalledWith({ responseAutoCopy: false });
});
const modalRig = (kind: 'size' | 'buttons') => {
	const file = kind === 'size' ? 'ManageImageCompressionModal' : 'ManageFloatingActionButtonsModal';
	const prop = kind === 'size' ? 'size' : 'floatingActionButtons';
	const { code, reactive, source } = body(
		`src/lib/components/chat/Settings/Interface/${file}.svelte`
	);
	const expr = source.match(/bind:value=\{([^}]+)\}/)?.[1];
	const saved = vi.fn(async (value: unknown): Promise<boolean> => {
		void value;
		return true;
	});
	const context = {
		structuredClone,
		getErrorMessage,
		getContext: () => ({}),
		$i18n: { t: (s: string) => s },
		onMount: vi.fn(),
		onDestroy: vi.fn(),
		toast: { error: vi.fn() }
	};
	const assignment =
		kind === 'size'
			? `${expr}=next;`
			: `(typeof draft!=='undefined'?draft:floatingActionButtons)[0].label=next;`;
	const api = run<{
		open: (v: object) => void;
		close: () => void;
		edit: (v: string | number) => void;
		submit: () => Promise<void>;
		state: () => { show: boolean; value: unknown };
		setSave: (fn: typeof saved) => void;
	}>(
		code +
			`\n({open:(v)=>{${prop}=v;show=true;${reactive}},close:()=>{show=false;${reactive}},edit:(next)=>{${assignment}},submit:submitHandler,state:()=>({show,value:${prop}}),setSave:(fn)=>onSave=fn})`,
		context
	);
	api.setSave(saved);
	return { api, saved, context };
};
for (const kind of ['size', 'buttons'] as const) {
	const initial = () =>
		kind === 'size'
			? { width: 800, height: 600 }
			: [{ id: 'ask', label: 'Ask', input: true, prompt: '{{CONTENT}}' }];
	it(`keeps ${kind} edits out of the supplied object before Save`, () => {
		const r = modalRig(kind),
			value = initial(),
			before = JSON.stringify(value);
		r.api.open(value);
		r.api.edit(kind === 'size' ? 1200 : 'Changed');
		expect(JSON.stringify(value)).toBe(before);
	});
	it(`keeps ${kind} modal open after save rejection`, async () => {
		const r = modalRig(kind);
		r.api.open(initial());
		const refused = Promise.reject(new Error('save refused'));
		void refused.catch(() => {});
		r.saved.mockReturnValueOnce(refused);
		await expect(r.api.submit()).resolves.toBeUndefined();
		expect(r.api.state().show).toBe(true);
		expect(r.context.toast.error).toHaveBeenCalledWith('save refused');
	});
	it(`waits for one ${kind} save before closing`, async () => {
		const r = modalRig(kind),
			p = pending<boolean>();
		r.api.open(initial());
		r.saved.mockReturnValue(p.promise);
		const a = r.api.submit(),
			b = r.api.submit();
		expect(r.api.state().show).toBe(true);
		expect(r.saved).toHaveBeenCalledTimes(1);
		p.resolve(true);
		await Promise.all([a, b]);
		expect(r.api.state().show).toBe(false);
	});
}
it('serializes partial settings so a later save includes the earlier successful choice', async () => {
	const { code } = body('src/lib/components/chat/SettingsModal.svelte', [
		'saveSettings',
		'settingsSaveQueue'
	]);
	const p = pending<{ ui: object }>(),
		context = {
			$settings: {} as Record<string, unknown>,
			structuredClone,
			localStorage: { token: 'fixture' },
			updateUserSettings: vi.fn(async (token: string, payload: { ui: object }) => {
				void token;
				return payload;
			}),
			settings: {
				set: vi.fn((v: Record<string, unknown>) => {
					context.$settings = v;
				})
			},
			models: { set: vi.fn() },
			getModels: vi.fn(async () => []),
			toast: { error: vi.fn() },
			$i18n: { t: (s: string) => s }
		};
	context.updateUserSettings.mockReturnValueOnce(p.promise);
	const api = run<{ saveSettings: (v: object) => Promise<void> }>(
		code + '\n({saveSettings})',
		context
	);
	const a = api.saveSettings({ chatBubble: false }),
		b = api.saveSettings({ responseAutoCopy: true });
	await flush();
	expect(context.updateUserSettings).toHaveBeenCalledTimes(1);
	p.resolve({ ui: {} });
	await Promise.all([a, b]);
	expect(context.updateUserSettings.mock.calls[1][1].ui).toEqual({
		chatBubble: false,
		responseAutoCopy: true
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllTimers();
	vi.useRealTimers();
});
it('keeps the former background if persistence is refused', async () => {
	const r = backgroundRig();
	r.context.saveSettings.mockRejectedValueOnce(new Error('save refused'));
	r.start();
	const reader = r.readers[0];
	reader.result = 'data:image/png;base64,AA==';
	await reader.onload?.({ target: reader });
	await flush();
	expect(r.api.state().background).toBe('old');
	expect(r.context.toast.error).toHaveBeenCalledWith('save refused');
});
it('ignores a superseded background file', async () => {
	const r = backgroundRig();
	r.start();
	const old = r.readers[0];
	r.start();
	expect(old.abort).toHaveBeenCalledTimes(1);
	old.result = 'data:image/png;base64,old';
	old.onload?.({ target: old });
	await flush();
	expect(r.context.saveSettings).not.toHaveBeenCalled();
});
it('does not save an invalid FileReader result', () => {
	const r = backgroundRig();
	r.start();
	const reader = r.readers[0];
	reader.result = new ArrayBuffer(2);
	reader.onload?.({ target: reader });
	expect(r.context.saveSettings).not.toHaveBeenCalled();
});
it('does not update a location after the setting was disabled', async () => {
	const r = backgroundRig(),
		p = pending<string>();
	r.context.getUserPosition.mockReturnValue(p.promise);
	const work = r.api.location(true);
	await r.api.location(false);
	p.resolve('late location');
	await work;
	expect(r.context.updateUserInfo).not.toHaveBeenCalled();
	expect(r.context.toast.success).not.toHaveBeenCalled();
});
for (const kind of ['size', 'buttons'] as const)
	it(`does not close a reopened ${kind} modal after the previous save completes`, async () => {
		const r = modalRig(kind),
			value =
				kind === 'size' ? { width: 800, height: 600 } : [{ id: 'ask', label: 'Ask', prompt: 'x' }],
			p = pending<boolean>();
		r.api.open(value);
		r.saved.mockReturnValueOnce(p.promise);
		const saving = r.api.submit();
		r.api.close();
		r.api.open(value);
		p.resolve(true);
		await saving;
		expect(r.api.state().show).toBe(true);
	});
it('keeps a settings HTTP detail and does not retry the mutation', async () => {
	const fetch = vi.fn(
		async () => new Response(JSON.stringify({ detail: 'save refused' }), { status: 403 })
	);
	vi.stubGlobal('fetch', fetch);
	await expect(updateUserSettings('fixture', { ui: { chatBubble: false } })).rejects.toThrow(
		'save refused'
	);
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(fetch).toHaveBeenCalledWith(
		'/api/v1/users/user/settings/update',
		expect.objectContaining({ method: 'POST', body: JSON.stringify({ ui: { chatBubble: false } }) })
	);
});
it('bounds settings response-body reading by the existing deadline', async () => {
	vi.useFakeTimers();
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, options: RequestInit) => ({
			ok: true,
			json: () =>
				new Promise<never>((_, reject) =>
					options.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
						once: true
					})
				)
		}))
	);
	const result = updateUserSettings('fixture', { ui: {} }).catch((error: unknown) => error);
	await vi.advanceTimersByTimeAsync(60_000);
	expect(await result).toMatchObject({ name: 'TimeoutError' });
	expect(vi.getTimerCount()).toBe(0);
});
