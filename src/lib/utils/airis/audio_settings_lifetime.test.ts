// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { getAudioConfig, updateAudioConfig, getModels, getVoices } from '$lib/apis/audio';

vi.mock('$lib/constants', () => ({ AUDIO_API_BASE_URL: '/api/v1/audio' }));

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
const rig = (admin = false) => {
	vi.useFakeTimers();
	const path = `src/lib/components/${admin ? 'admin' : 'chat'}/Settings/Audio.svelte`;
	const source = readFileSync(path, 'utf8');
	const script = parse(source).instance;
	if (!script) throw new Error('Missing settings script');
	const parsed = ts.createSourceFile(
		'audio.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const body = parsed.statements
		.filter(
			(s) =>
				!ts.isImportDeclaration(s) &&
				!ts.isLabeledStatement(s) &&
				!(
					ts.isVariableStatement(s) &&
					s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
				)
		)
		.map((s) => s.getText(parsed).replace(/^export /, ''))
		.join('\n')
		.replace("import('kokoro-js')", 'loadKokoroModule()');
	const synthesis = Object.assign(new EventTarget(), {
		getVoices: vi.fn(() => [] as { name: string; voiceURI: string; localService: boolean }[])
	});
	const model = {
		voices: { af_heart: { name: 'Heart' } },
		model: { dispose: vi.fn(async () => {}) }
	};
	const fromPretrained = vi.fn(async () => model);
	const mount: (() => unknown)[] = [];
	const destroy: (() => void)[] = [];
	const context = {
		AbortController,
		createEventDispatcher: () => vi.fn(),
		getContext: () => ({}),
		$i18n: { t: (s: string) => s, resolvedLanguage: 'en' },
		$config: { audio: { tts: { engine: '', voice: '' }, stt: { engine: '' } } },
		$settings: { audio: { tts: { engine: '', engineConfig: { dtype: 'fp32' } } } },
		config: { set: vi.fn() },
		getBackendConfig: vi.fn(async () => ({})),
		saveHandler: vi.fn(),
		saveSettings: vi.fn(),
		getAudioConfig: vi.fn(async () => ({ tts: {}, stt: {} })),
		updateAudioConfig: vi.fn(async (...args: Parameters<typeof updateAudioConfig>) => {
			expect(args[0]).toBe('fixture');
			return { tts: {}, stt: {} };
		}),
		_getModels: vi.fn(async () => ({ models: [] })),
		_getVoices: vi.fn(async () => ({ voices: [{ id: 'server', name: 'Server' }] })),
		loadKokoroModule: vi.fn(async () => ({ KokoroTTS: { from_pretrained: fromPretrained } })),
		onMount: (fn: () => unknown) => {
			mount.push(fn);
		},
		onDestroy: (fn: () => void) => {
			destroy.push(fn);
		},
		speechSynthesis: synthesis,
		localStorage: { token: 'fixture' },
		navigator: {},
		toast: { error: vi.fn() },
		console: { log: vi.fn(), error: vi.fn() },
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		TTS_RESPONSE_SPLIT: { PUNCTUATION: 'punctuation' }
	};
	const expose = admin
		? '({getVoices,updateConfigHandler,sttModelUpdateHandler,setEngine:(s)=>{TTS_ENGINE=s;},setParams:(s)=>{TTS_OPENAI_PARAMS=s;},state:()=>({voices,providerVoices,loading:STT_WHISPER_MODEL_LOADING})})'
		: '({getVoices,setEngine:(s)=>{TTSEngine=s;},setDtype:(s)=>{TTSEngineConfig.dtype=s;},state:()=>({voices,model:TTSModel,loading:TTSModelLoading,progress:TTSModelProgress})})';
	const api = runInNewContext(
		ts.transpileModule(`${body}\n${expose}`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as {
		getVoices: () => Promise<void>;
		setEngine: (value: string) => void;
		setDtype?: (value: string) => void;
		setParams?: (value: string) => void;
		updateConfigHandler?: () => Promise<boolean>;
		sttModelUpdateHandler?: () => Promise<void>;
		state: () => {
			voices: { id?: string; voiceURI?: string; name: string }[];
			providerVoices?: { id: string }[];
			loading: boolean;
			model?: typeof model;
		};
	};
	return {
		api,
		context,
		synthesis,
		model,
		fromPretrained,
		mount: async () => {
			for (const fn of mount) {
				const cleanup = await fn();
				if (typeof cleanup === 'function') destroy.push(cleanup as () => void);
			}
		},
		destroy: () => {
			for (const fn of destroy) fn();
		}
	};
};
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

for (const admin of [false, true]) {
	it(`reads native voices immediately without polling (${admin ? 'admin' : 'user'})`, async () => {
		const r = rig(admin);
		r.synthesis.getVoices.mockReturnValue([
			{ name: 'Display', voiceURI: 'uri', localService: true }
		]);
		await r.api.getVoices();
		expect(r.api.state().voices[0]?.name).toBe('Display');
		expect(vi.getTimerCount()).toBe(0);
	});
	it(`handles an empty list and detaches voiceschanged on destruction (${admin ? 'admin' : 'user'})`, async () => {
		const r = rig(admin);
		const removed = vi.spyOn(r.synthesis, 'removeEventListener');
		await r.mount();
		expect(vi.getTimerCount()).toBe(0);
		r.synthesis.getVoices.mockReturnValue([{ name: 'Late', voiceURI: 'late', localService: true }]);
		r.synthesis.dispatchEvent(new Event('voiceschanged'));
		expect(r.api.state().voices[0]?.name).toBe('Late');
		r.destroy();
		expect(removed).toHaveBeenCalledWith('voiceschanged', expect.any(Function));
	});
	it(`discards voices received after destruction (${admin ? 'admin' : 'user'})`, async () => {
		const r = rig(admin);
		r.context.$config.audio.tts.engine = 'openai';
		r.api.setEngine('openai');
		const late = deferred<{ voices: { id: string; name: string }[] }>();
		r.context._getVoices.mockReturnValue(late.promise);
		const p = r.api.getVoices();
		r.destroy();
		late.resolve({ voices: [{ id: 'late', name: 'Late' }] });
		await p;
		expect(admin ? r.api.state().providerVoices : r.api.state().voices).toEqual([]);
	});
}
it('uses native voiceURI as the selection identity', async () => {
	const r = rig();
	r.synthesis.getVoices.mockReturnValue([{ name: 'Display', voiceURI: 'uri', localService: true }]);
	await r.api.getVoices();
	expect(r.api.state().voices[0]?.id).toBe('uri');
});
it('does not mutate shared model precision while editing an unsaved form', async () => {
	const r = rig();
	await r.mount();
	r.api.setDtype?.('q8');
	r.destroy();
	expect(r.context.$settings.audio.tts.engineConfig.dtype).toBe('fp32');
});
it('shares one pending Kokoro model load and clears loading on success', async () => {
	const r = rig();
	r.api.setEngine('browser-kokoro');
	r.api.setDtype?.('fp32');
	const late = deferred<typeof r.model>();
	r.fromPretrained.mockReturnValue(late.promise);
	const a = r.api.getVoices();
	const b = r.api.getVoices();
	await vi.advanceTimersByTimeAsync(0);
	expect(r.fromPretrained).toHaveBeenCalledTimes(1);
	late.resolve(r.model);
	await Promise.all([a, b]);
	expect(r.api.state().loading).toBe(false);
	expect(r.api.state().voices[0]?.id).toBe('af_heart');
});
it('does not install a Kokoro model after changing engines', async () => {
	const r = rig();
	r.api.setEngine('browser-kokoro');
	r.api.setDtype?.('fp32');
	const late = deferred<typeof r.model>();
	r.fromPretrained.mockReturnValue(late.promise);
	const p = r.api.getVoices();
	await vi.advanceTimersByTimeAsync(0);
	r.api.setEngine('');
	await r.api.getVoices();
	late.resolve(r.model);
	await p;
	expect(r.api.state().model).toBeNull();
	expect(r.api.state().voices).toEqual([]);
});
it('contains a failed Kokoro load and clears its loading state', async () => {
	const r = rig();
	r.api.setEngine('browser-kokoro');
	r.api.setDtype?.('fp32');
	r.fromPretrained.mockRejectedValue(new Error('model refused'));
	await expect(r.api.getVoices()).resolves.toBeUndefined();
	expect(r.api.state().loading).toBe(false);
	expect(r.context.toast.error).toHaveBeenCalledTimes(1);
});
it('rejects JSON parameters that are not an object before saving', async () => {
	const r = rig(true);
	await r.mount();
	await vi.advanceTimersByTimeAsync(0);
	r.api.setParams?.('[]');
	await r.api.updateConfigHandler?.();
	expect(r.context.updateAudioConfig).not.toHaveBeenCalled();
	expect(r.context.saveHandler).not.toHaveBeenCalled();
});
it('does not confirm a failed configuration save and clears Whisper loading', async () => {
	const r = rig(true);
	await r.mount();
	await vi.advanceTimersByTimeAsync(0);
	r.context.updateAudioConfig.mockRejectedValue(new Error('save refused'));
	await expect(r.api.sttModelUpdateHandler?.()).resolves.toBeUndefined();
	expect(r.api.state().loading).toBe(false);
	expect(r.context.saveHandler).not.toHaveBeenCalled();
	expect(r.context.config.set).not.toHaveBeenCalled();
	expect(r.context.toast.error).toHaveBeenCalledTimes(1);
});

it('cannot overwrite server settings after their initial read failed', async () => {
	const r = rig(true);
	r.context.getAudioConfig.mockRejectedValue(new Error('read refused'));
	await r.mount();
	await vi.advanceTimersByTimeAsync(0);
	await r.api.updateConfigHandler?.();
	expect(r.context.updateAudioConfig).not.toHaveBeenCalled();
	expect(r.context.toast.error).toHaveBeenCalledTimes(1);
});
it('preserves hidden allowed extensions and does not send an empty MIME entry', async () => {
	const r = rig(true);
	r.context.getAudioConfig.mockResolvedValue({ tts: {}, stt: { ALLOWED_EXTENSIONS: ['wav'] } });
	await r.mount();
	await vi.advanceTimersByTimeAsync(0);
	await r.api.updateConfigHandler?.();
	expect(r.context.updateAudioConfig).toHaveBeenCalledWith(
		'fixture',
		expect.objectContaining({
			stt: expect.objectContaining({ ALLOWED_EXTENSIONS: ['wav'], SUPPORTED_CONTENT_TYPES: [] })
		}),
		expect.any(AbortSignal)
	);
});
it('disposes a model that finishes after the settings component was destroyed', async () => {
	const r = rig();
	r.api.setEngine('browser-kokoro');
	const late = deferred<typeof r.model>();
	r.fromPretrained.mockReturnValue(late.promise);
	const p = r.api.getVoices();
	await vi.advanceTimersByTimeAsync(0);
	r.destroy();
	late.resolve(r.model);
	await p;
	expect(r.api.state().model).toBeNull();
	expect(r.model.model.dispose).toHaveBeenCalledTimes(1);
	expect(r.api.state().voices).toEqual([]);
});
it('does not let a superseded dtype replace the newly loaded model', async () => {
	const r = rig();
	r.api.setEngine('browser-kokoro');
	r.api.setDtype?.('fp32');
	const late = deferred<typeof r.model>();
	r.fromPretrained.mockReturnValueOnce(late.promise);
	const old = r.api.getVoices();
	await vi.advanceTimersByTimeAsync(0);
	r.api.setDtype?.('q8');
	await r.api.getVoices();
	const oldModel = { ...r.model, model: { dispose: vi.fn(async () => {}) } };
	late.resolve(oldModel);
	await old;
	expect(r.api.state().model).toBe(r.model);
	expect(oldModel.model.dispose).toHaveBeenCalledTimes(1);
	expect(r.model.model.dispose).not.toHaveBeenCalled();
	r.destroy();
});
it('rejects an already cancelled voice request before fetching', async () => {
	const fetch = vi.fn();
	vi.stubGlobal('fetch', fetch);
	const c = new AbortController();
	c.abort();
	await expect(
		(getVoices as (token: string, signal: AbortSignal) => Promise<unknown>)('fixture', c.signal)
	).rejects.toMatchObject({ name: 'AbortError' });
	expect(fetch).not.toHaveBeenCalled();
});
it('uses the voice id when a provider returns a null display name', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify({ voices: [{ id: 'voice', name: null }] })))
	);
	expect(await getVoices('fixture')).toEqual({ voices: [{ id: 'voice', name: 'voice' }] });
});
it('keeps the audio config deadline active through JSON body reading', async () => {
	vi.useFakeTimers();
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, options: RequestInit) => {
			expect(url).toBe('/api/v1/audio/config');
			return {
				ok: true,
				json: () =>
					new Promise<never>((_, reject) =>
						options.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
							once: true
						})
					)
			};
		})
	);
	const c = new AbortController();
	const remove = vi.spyOn(c.signal, 'removeEventListener');
	const result = getAudioConfig('fixture', c.signal).catch((error: unknown) => error);
	await vi.advanceTimersByTimeAsync(60_000);
	expect(await result).toMatchObject({ name: 'TimeoutError' });
	expect(vi.getTimerCount()).toBe(0);
	expect(remove).toHaveBeenCalledTimes(1);
});
it('keeps HTTP detail and the complete config payload without a mutation retry', async () => {
	const r = rig(true);
	await r.mount();
	await vi.advanceTimersByTimeAsync(0);
	await r.api.updateConfigHandler?.();
	const payload = r.context.updateAudioConfig.mock.calls[0]?.[1] as Parameters<
		typeof updateAudioConfig
	>[1];
	const fetch = vi.fn(
		async () => new Response(JSON.stringify({ detail: 'save refused' }), { status: 403 })
	);
	vi.stubGlobal('fetch', fetch);
	await expect(updateAudioConfig('fixture', payload)).rejects.toThrow('save refused');
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(fetch).toHaveBeenCalledWith(
		'/api/v1/audio/config/update',
		expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) })
	);
});
it('cancels the model editor voice request and discards its late result', async () => {
	const source = readFileSync('src/lib/components/workspace/Models/ModelEditor.svelte', 'utf8');
	const script = parse(source).instance;
	if (!script) throw new Error('Missing editor script');
	const parsed = ts.createSourceFile(
		'editor.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const declarations = parsed.statements
		.filter(ts.isVariableStatement)
		.flatMap((s) => [...s.declarationList.declarations])
		.filter((d) => ['voicesAbort', 'loadVoices'].includes(d.name.getText(parsed)))
		.map((d) => `const ${d.getText(parsed)};`);
	const hooks = parsed.statements
		.filter(ts.isExpressionStatement)
		.filter(
			(s) =>
				ts.isCallExpression(s.expression) && s.expression.expression.getText(parsed) === 'onDestroy'
		)
		.map((s) => s.getText(parsed));
	const late = deferred<{ voices: { id: string; name: string }[] }>();
	const fetchVoices = vi.fn(() => late.promise);
	let destroy = (): void => {};
	const context = {
		AbortController,
		voices: [] as { id: string; name: string }[],
		localStorage: { token: 'fixture' },
		getVoices: fetchVoices,
		onDestroy: (fn: () => void): void => {
			destroy = fn;
		}
	};
	const api = runInNewContext(
		ts.transpileModule(`${declarations.join('\n')}\n${hooks.join('\n')}\n({loadVoices})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as { loadVoices: () => Promise<void> };
	const p = api.loadVoices();
	destroy();
	late.resolve({ voices: [{ id: 'late', name: 'Late' }] });
	await p;
	expect(context.voices).toEqual([]);
	expect(fetchVoices).toHaveBeenCalledWith('fixture', expect.objectContaining({ aborted: true }));
});
for (const [name, call] of Object.entries({
	config: () => getAudioConfig('fixture'),
	update: () => updateAudioConfig('fixture', {} as Parameters<typeof updateAudioConfig>[1]),
	models: () => getModels('fixture'),
	voices: () => getVoices('fixture')
})) {
	it(`preserves network failure for the public ${name} API`, async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network refused')));
		await expect(call()).rejects.toThrow('network refused');
	});
}
