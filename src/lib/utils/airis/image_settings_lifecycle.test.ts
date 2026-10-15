// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import {
	getConfig,
	updateConfig,
	verifyConfigUrl,
	getImageGenerationModels
} from '$lib/apis/images';
vi.mock('$lib/constants', () => ({ IMAGES_API_BASE_URL: '/api/v1/images' }));
import { getErrorMessage } from './error_message';

const configuration = () => ({
	ENABLE_IMAGE_GENERATION: true,
	ENABLE_IMAGE_PROMPT_GENERATION: false,
	IMAGE_GENERATION_ENGINE: 'comfyui',
	IMAGE_GENERATION_MODEL: 'fixture',
	IMAGE_SIZE: '512x512',
	IMAGE_STEPS: 50,
	IMAGES_OPENAI_API_BASE_URL: 'https://example.test',
	IMAGES_OPENAI_API_KEY: 'fixture-key',
	IMAGES_OPENAI_API_VERSION: '',
	IMAGES_OPENAI_API_PARAMS: '{}',
	AUTOMATIC1111_BASE_URL: 'https://example.test',
	AUTOMATIC1111_API_AUTH: '',
	AUTOMATIC1111_PARAMS: '{}',
	COMFYUI_BASE_URL: 'https://example.test',
	COMFYUI_API_KEY: '',
	COMFYUI_WORKFLOW: '{"1":{"inputs":{}}}',
	COMFYUI_WORKFLOW_NODES: [],
	IMAGES_GEMINI_API_BASE_URL: '',
	IMAGES_GEMINI_API_KEY: 'fixture-key',
	IMAGES_GEMINI_ENDPOINT_METHOD: 'predict',
	ENABLE_IMAGE_EDIT: true,
	IMAGE_EDIT_ENGINE: 'comfyui',
	IMAGE_EDIT_MODEL: 'fixture',
	IMAGE_EDIT_SIZE: '512x512',
	IMAGES_EDIT_OPENAI_API_BASE_URL: '',
	IMAGES_EDIT_OPENAI_API_KEY: 'fixture-key',
	IMAGES_EDIT_OPENAI_API_VERSION: '',
	IMAGES_EDIT_GEMINI_API_BASE_URL: '',
	IMAGES_EDIT_GEMINI_API_KEY: 'fixture-key',
	IMAGES_EDIT_COMFYUI_BASE_URL: 'https://example.test',
	IMAGES_EDIT_COMFYUI_API_KEY: '',
	IMAGES_EDIT_COMFYUI_WORKFLOW: '{"2":{"inputs":{}}}',
	IMAGES_EDIT_COMFYUI_WORKFLOW_NODES: []
});
type Fixture = ReturnType<typeof configuration>;
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
const rig = () => {
	const source = readFileSync(
		process.env.AIRIS_IMAGE_SETTINGS_SOURCE || 'src/lib/components/admin/Settings/Images.svelte',
		'utf8'
	);
	const script = parse(source).instance;
	if (!script) throw new Error('Missing Images script');
	const parsed = ts.createSourceFile(
		'images.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const body = parsed.statements
		.filter((s) => !ts.isImportDeclaration(s))
		.map((s) => s.getText(parsed))
		.join('\n');
	const mount: (() => Promise<void>)[] = [],
		destroy: (() => void)[] = [];
	const dispatched = vi.fn();
	class Input {
		value = 'workflow.json';
		files: { text: () => Promise<string> }[] = [{ text: async () => '{"loaded":{}}' }];
	}
	class Reader {
		result: string | null = null;
		onload: ((event: { target: Reader }) => void) | null = null;
		onerror: (() => void) | null = null;
		readAsText(file: { text: () => Promise<string> }): void {
			if (!file) throw new TypeError('Missing file');
			void file.text().then(
				(value) => {
					this.result = value;
					this.onload?.({ target: this });
				},
				() => this.onerror?.()
			);
		}
	}
	const context = {
		AbortController,
		getErrorMessage,
		HTMLInputElement: Input,
		FileReader: Reader,
		setTimeout,
		clearTimeout,
		createEventDispatcher: () => dispatched,
		getContext: () => ({}),
		$i18n: { t: (s: string) => s },
		$user: { role: 'admin' },
		localStorage: { token: 'fixture' },
		backendConfig: { set: vi.fn() },
		getBackendConfig: vi.fn(async () => ({})),
		getConfig: vi.fn(async () => configuration()),
		updateConfig: vi.fn(async (token: string, cfg: object, signal?: AbortSignal) => {
			void signal;
			return { ...cfg };
		}),
		getImageGenerationModels: vi.fn(async () => [{ id: 'fixture', name: 'Fixture' }]),
		verifyConfigUrl: vi.fn(async () => true),
		toast: { error: vi.fn(), success: vi.fn() },
		console: { log: vi.fn(), debug: vi.fn(), error: vi.fn() },
		onMount: (fn: () => Promise<void>): void => {
			mount.push(fn);
		},
		onDestroy: (fn: () => void): void => {
			destroy.push(fn);
		}
	};
	const uploads = ['COMFYUI_WORKFLOW', 'IMAGES_EDIT_COMFYUI_WORKFLOW'].map((field, index) => {
		if (body.includes('uploadWorkflow')) return `(event)=>uploadWorkflow(event,'${field}')`;
		const id = index === 0 ? 'upload-comfyui-workflow-input' : 'upload-comfyui-edit-workflow-input';
		const expression = source
			.slice(source.indexOf(`id="${id}"`))
			.match(/on:change=\{([\s\S]*?)\n\s*\}\}/);
		if (!expression) throw new Error('Missing upload handler');
		return expression[1] + '\n}';
	});
	const expose = `({ saveHandler, updateConfigHandler, getModels, setConfig:(value)=>config=value, state:()=>({config,loading,models}), uploads:[${uploads.join(',')}] })`;
	const api = runInNewContext(
		ts.transpileModule(body + '\n' + expose, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as {
		saveHandler: () => Promise<void>;
		updateConfigHandler: (verify?: boolean) => Promise<unknown>;
		getModels: () => Promise<void>;
		setConfig: (cfg: Fixture | null) => void;
		state: () => { config: Fixture | null; loading: boolean; models: { id: string }[] | null };
		uploads: ((event: { target: Input; currentTarget: Input }) => Promise<void> | void)[];
	};
	api.setConfig(configuration());
	return {
		api,
		context,
		dispatched,
		input: () => new Input(),
		mount: async () => {
			for (const fn of mount) await fn();
		},
		destroy: () => {
			for (const fn of destroy) fn();
		}
	};
};
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllTimers();
	vi.useRealTimers();
});

for (const field of ['AUTOMATIC1111_PARAMS', 'IMAGES_OPENAI_API_PARAMS'] as const) {
	for (const value of ['{', '[]', 'null', '42'])
		it(`rejects invalid object parameters without a save or stuck loading: ${field}=${value}`, async () => {
			const r = rig(),
				cfg = configuration();
			cfg[field] = value;
			r.api.setConfig(cfg);
			await expect(r.api.saveHandler()).resolves.toBeUndefined();
			expect(r.api.state().loading).toBe(false);
			expect(r.context.updateConfig).not.toHaveBeenCalled();
			expect(r.dispatched).not.toHaveBeenCalled();
			expect(r.api.state().config?.[field]).toBe(value);
		});
}
it('does not save before configuration is available', async () => {
	const r = rig();
	r.api.setConfig(null);
	await expect(r.api.saveHandler()).resolves.toBeUndefined();
	expect(r.context.updateConfig).not.toHaveBeenCalled();
	expect(r.api.state().loading).toBe(false);
});
it('keeps the enable choice after missing provider credentials', async () => {
	const r = rig(),
		cfg = configuration();
	cfg.IMAGE_GENERATION_ENGINE = 'openai';
	cfg.IMAGES_OPENAI_API_KEY = '';
	r.api.setConfig(cfg);
	await r.api.saveHandler();
	expect(r.api.state().config?.ENABLE_IMAGE_GENERATION).toBe(true);
	expect(r.context.updateConfig).not.toHaveBeenCalled();
});
it('does not overlap saves and always clears pending state after a failure', async () => {
	const r = rig(),
		pending = deferred<object>();
	r.context.updateConfig.mockReturnValue(pending.promise);
	const a = r.api.saveHandler(),
		b = r.api.saveHandler();
	expect(r.context.updateConfig).toHaveBeenCalledTimes(1);
	pending.resolve({});
	await Promise.all([a, b]);
	expect(r.api.state().loading).toBe(false);
});
it('ignores a configuration response after destruction', async () => {
	const r = rig(),
		pending = deferred<Fixture>();
	r.api.setConfig(null);
	r.context.getConfig.mockReturnValue(pending.promise);
	const p = r.mount();
	r.destroy();
	pending.resolve(configuration());
	await p;
	expect(r.api.state().config).toBeNull();
	expect(r.context.getImageGenerationModels).not.toHaveBeenCalled();
});
for (const index of [0, 1]) {
	it(`clears the actual file input after reading the workflow (${index})`, async () => {
		const r = rig(),
			input = r.input();
		await r.api.uploads[index]({ target: input, currentTarget: input });
		expect(input.value).toBe('');
		const field = index === 0 ? 'COMFYUI_WORKFLOW' : 'IMAGES_EDIT_COMFYUI_WORKFLOW';
		expect(r.api.state().config?.[field]).toContain('loaded');
	});
	it(`ignores an empty selection (${index})`, async () => {
		const r = rig(),
			input = r.input();
		input.files = [];
		const before = JSON.stringify(r.api.state().config);
		await expect(
			Promise.resolve().then(() => r.api.uploads[index]({ target: input, currentTarget: input }))
		).resolves.toBeUndefined();
		expect(JSON.stringify(r.api.state().config)).toBe(before);
	});
	it(`keeps the previous workflow after a read failure (${index})`, async () => {
		const r = rig(),
			input = r.input(),
			before = JSON.stringify(r.api.state().config);
		input.files = [
			{
				text: async () => {
					throw new Error('read refused');
				}
			}
		];
		await expect(
			Promise.resolve(r.api.uploads[index]({ target: input, currentTarget: input }))
		).resolves.toBeUndefined();
		expect(JSON.stringify(r.api.state().config)).toBe(before);
		expect(r.context.toast.error).toHaveBeenCalledTimes(1);
	});
	it(`ignores a file response after destruction (${index})`, async () => {
		const r = rig(),
			input = r.input(),
			pending = deferred<string>(),
			before = JSON.stringify(r.api.state().config);
		input.files = [{ text: () => pending.promise }];
		const p = r.api.uploads[index]({ target: input, currentTarget: input });
		r.destroy();
		pending.resolve('{"late":{}}');
		await p;
		expect(JSON.stringify(r.api.state().config)).toBe(before);
	});
}

it('contains HTTP save failure, keeps the draft and permits a later retry', async () => {
	const r = rig(),
		before = JSON.stringify(r.api.state().config);
	r.context.updateConfig.mockRejectedValueOnce(new Error('save refused'));
	await r.api.saveHandler();
	expect(r.api.state().loading).toBe(false);
	expect(JSON.stringify(r.api.state().config)).toBe(before);
	expect(r.dispatched).not.toHaveBeenCalled();
	expect(r.context.toast.error).toHaveBeenCalledWith('save refused');
	await r.api.saveHandler();
	expect(r.dispatched).toHaveBeenCalledTimes(1);
});
it('does not verify or announce success after a refused save', async () => {
	const r = rig();
	r.context.updateConfig.mockRejectedValueOnce(new Error('save refused'));
	await r.api.updateConfigHandler(true);
	expect(r.context.verifyConfigUrl).not.toHaveBeenCalled();
	expect(r.context.toast.success).not.toHaveBeenCalled();
	expect(r.api.state().loading).toBe(false);
});
it('verifies only after the current settings have been saved', async () => {
	const r = rig(),
		p = deferred<object>();
	r.context.updateConfig.mockReturnValue(p.promise);
	const work = r.api.updateConfigHandler(true);
	expect(r.context.verifyConfigUrl).not.toHaveBeenCalled();
	p.resolve(configuration());
	await work;
	expect(r.context.verifyConfigUrl).toHaveBeenCalledTimes(1);
	expect(r.context.toast.success).toHaveBeenCalledTimes(1);
	expect(r.api.state().loading).toBe(false);
});
it('does not apply or announce a save response after destruction', async () => {
	const r = rig(),
		p = deferred<object>();
	r.context.updateConfig.mockReturnValue(p.promise);
	const work = r.api.saveHandler();
	r.destroy();
	p.resolve(configuration());
	await work;
	expect(r.dispatched).not.toHaveBeenCalled();
	expect(r.context.backendConfig.set).not.toHaveBeenCalled();
	expect(r.context.getImageGenerationModels).not.toHaveBeenCalled();
	expect(r.context.updateConfig.mock.calls[0][2]?.aborted).toBe(true);
});
it('does not let an old model list replace the current request', async () => {
	const r = rig(),
		p = deferred<{ id: string; name: string }[]>();
	r.context.getImageGenerationModels.mockReturnValueOnce(p.promise);
	const old = r.api.getModels();
	await r.api.getModels();
	p.resolve([{ id: 'old', name: 'Old' }]);
	await old;
	expect(r.api.state().models?.[0].id).toBe('fixture');
});
for (const field of ['COMFYUI_WORKFLOW', 'IMAGES_EDIT_COMFYUI_WORKFLOW'] as const) {
	it(`rejects a workflow array before saving: ${field}`, async () => {
		const r = rig(),
			cfg = configuration();
		cfg[field] = '[]';
		r.api.setConfig(cfg);
		await r.api.saveHandler();
		expect(r.context.updateConfig).not.toHaveBeenCalled();
		expect(r.api.state().loading).toBe(false);
	});
}
for (const index of [0, 1]) {
	it(`retains the latest upload even when the first one finishes later (${index})`, async () => {
		const r = rig(),
			old = r.input(),
			latest = r.input(),
			p = deferred<string>();
		old.files = [{ text: () => p.promise }];
		latest.files = [{ text: async () => '{"latest":{}}' }];
		const work = r.api.uploads[index]({ target: old, currentTarget: old });
		await r.api.uploads[index]({ target: latest, currentTarget: latest });
		p.resolve('{"old":{}}');
		await work;
		expect(
			r.api.state().config?.[index === 0 ? 'COMFYUI_WORKFLOW' : 'IMAGES_EDIT_COMFYUI_WORKFLOW']
		).toContain('latest');
	});
	it(`does not replace the workflow after invalid file JSON (${index})`, async () => {
		const r = rig(),
			input = r.input(),
			before = JSON.stringify(r.api.state().config);
		input.files = [{ text: async () => '[]' }];
		await r.api.uploads[index]({ target: input, currentTarget: input });
		expect(JSON.stringify(r.api.state().config)).toBe(before);
		expect(r.context.toast.error).toHaveBeenCalledTimes(1);
	});
}
for (const [name, request] of [
	['config', (signal: AbortSignal) => getConfig('fixture', signal)],
	['update', (signal: AbortSignal) => updateConfig('fixture', configuration(), signal)],
	['verify', (signal: AbortSignal) => verifyConfigUrl('fixture', signal)],
	['models', (signal: AbortSignal) => getImageGenerationModels('fixture', signal)]
] as const) {
	it(`does not fetch an already cancelled image ${name} request`, async () => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		const c = new AbortController();
		c.abort();
		await expect(request(c.signal)).rejects.toMatchObject({ name: 'AbortError' });
		expect(fetch).not.toHaveBeenCalled();
	});
	it(`preserves non-JSON HTTP errors without a mutation retry (${name})`, async () => {
		const fetch = vi.fn(async () => new Response('refused', { status: 503 }));
		vi.stubGlobal('fetch', fetch);
		await expect(request(new AbortController().signal)).rejects.toThrow(
			'Image request failed (503).'
		);
		expect(fetch).toHaveBeenCalledTimes(1);
	});
}
it('keeps the image deadline through reading the response body and removes the abort listener', async () => {
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
	const c = new AbortController(),
		remove = vi.spyOn(c.signal, 'removeEventListener');
	const result = getConfig('fixture', c.signal).catch((error: unknown) => error);
	await vi.advanceTimersByTimeAsync(60_000);
	expect(await result).toMatchObject({ name: 'TimeoutError' });
	expect(vi.getTimerCount()).toBe(0);
	expect(remove).toHaveBeenCalledTimes(1);
});
