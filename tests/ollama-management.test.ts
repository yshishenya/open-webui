// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { createModel, getOllamaModels } from '$lib/apis/ollama';
import { getErrorMessage } from '$lib/utils/airis/error_message';
vi.mock('$lib/constants', () => ({ OLLAMA_API_BASE_URL: '/ollama' }));
afterEach(() => {
	vi.unstubAllGlobals();
});

const path = 'src/lib/components/admin/Settings/Models/Manage/ManageOllama.svelte';
const source = readFileSync(path, 'utf8');
const script = parse(source).instance!;
const ast = ts.createSourceFile(
	'manage.ts',
	source.slice(script.content.start, script.content.end),
	ts.ScriptTarget.Latest
);
function declaration(name: string, tree = ast): string | null {
	for (const s of tree.statements) {
		if (ts.isFunctionDeclaration(s) && s.name?.text === name) return s.getText(tree);
		if (!ts.isVariableStatement(s)) continue;
		const d = s.declarationList.declarations.find((d) => d.name.getText(tree) === name);
		if (d) return 'const ' + d.getText(tree) + ';';
	}
	return null;
}
const utilityAst = ts.createSourceFile(
	'utils.ts',
	readFileSync('src/lib/utils/index.ts', 'utf8'),
	ts.ScriptTarget.Latest
);
const splitStream = runInNewContext(
	ts.transpileModule(declaration('splitStream', utilityAst)! + '\nsplitStream', {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText,
	{ TransformStream }
) as (separator: string) => TransformStream<string, string>;
function setup(name: string) {
	const context = {
		localStorage: { token: 'fixture' },
		urlIdx: 3 as number | null,
		modelLoading: false,
		createModelLoading: false,
		createModelName: 'custom',
		createModelObject: '{"from":"base","parameters":{"temperature":0.4}}',
		createModelDigest: '',
		createModelPullProgress: null,
		modelUploadMode: 'url',
		modelInputFile: [{ name: 'model.gguf' }],
		modelFileUrl: 'https://huggingface.co/example/model.gguf',
		modelFileContent: '{"template":"custom template","parameters":{"num_ctx":4096}}',
		modelFileDigest: '',
		modelUploadInputElement: { value: 'fixture' },
		uploadProgress: null,
		uploadMessage: '',
		ollamaModels: [{ id: 'retained' }],
		loading: false,
		catalogRequest: 0,
		lifetime: { active: true },
		toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
		$i18n: { t: (s: string) => s },
		console: { log: vi.fn(), error: vi.fn(), debug: vi.fn() },
		TextDecoderStream,
		getErrorMessage,
		splitStream,
		createModel: vi.fn().mockImplementation(async () => new Response('{"status":"success"}\n')),
		uploadModel: vi
			.fn()
			.mockImplementation(
				async () =>
					new Response(
						'data: {"done":true,"blob":"sha256:fixture","name":"model.gguf","model_created":"model"}\n\n'
					)
			),
		downloadModel: vi
			.fn()
			.mockImplementation(
				async () =>
					new Response(
						'data: {"progress":50}\n\ndata: {"done":true,"blob":"sha256:fixture","name":"model.gguf"}\n\n'
					)
			),
		getModels: vi.fn().mockResolvedValue([{ id: 'refreshed' }]),
		getOllamaModels: vi.fn().mockResolvedValue([]),
		$config: { features: {} },
		$settings: {},
		models: { set: vi.fn() }
	};
	const code =
		['parseModelOptions', 'readModelResponse', name]
			.map((name) => declaration(name))
			.filter(Boolean)
			.join('\n') +
		'\n' +
		name;
	const run = runInNewContext(
		ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
		context
	) as () => Promise<void>;
	return { context, run };
}
it('creates a GGUF using the selected server, JSON options and blob map', async () => {
	const { context: c, run } = setup('uploadModelHandler');
	await run();
	expect(c.createModel).toHaveBeenCalledOnce();
	expect(c.createModel).toHaveBeenCalledWith(
		'fixture',
		{
			model: 'model.gguf:latest',
			files: { 'model.gguf': 'sha256:fixture' },
			stream: true,
			template: 'custom template',
			parameters: { num_ctx: 4096 }
		},
		3
	);
	expect(c.modelLoading).toBe(false);
	expect(c.toast.error).not.toHaveBeenCalled();
	expect(c.toast.success).toHaveBeenCalledOnce();
});
it('accepts an already-created upload without issuing a second create when options are empty', async () => {
	const { context: c, run } = setup('uploadModelHandler');
	c.modelUploadMode = 'file';
	c.modelFileContent = '{}';
	const file = c.modelInputFile[0];
	await run();
	expect(c.uploadModel).toHaveBeenCalledWith('fixture', file, 3);
	expect(c.createModel).not.toHaveBeenCalled();
	expect(c.toast.success).toHaveBeenCalledOnce();
	expect(c.modelLoading).toBe(false);
});
it.each(['null', '[]', '"text"', 'invalid'])(
	'rejects invalid upload options %s before uploading',
	async (value) => {
		const { context: c, run } = setup('uploadModelHandler');
		c.modelFileContent = value;
		await expect(run()).resolves.toBeUndefined();
		expect(c.downloadModel).not.toHaveBeenCalled();
		expect(c.uploadModel).not.toHaveBeenCalled();
		expect(c.createModel).not.toHaveBeenCalled();
		expect(c.toast.error).toHaveBeenCalledOnce();
		expect(c.modelLoading).toBe(false);
	}
);
it.each(['null', '[]', '"text"'])(
	'rejects invalid creation JSON %s without sending it',
	async (value) => {
		const { context: c, run } = setup('createModelHandler');
		c.createModelObject = value;
		await expect(run()).resolves.toBeUndefined();
		expect(c.createModel).not.toHaveBeenCalled();
		expect(c.createModelLoading).toBe(false);
		expect(c.createModelObject).toBe(value);
		expect(c.toast.error).toHaveBeenCalledOnce();
	}
);
it.each(['network', 'HTTP', 'empty', 'read', 'JSON', 'server-error', 'unfinished'])(
	'creation settles %s refusal, retains the input and releases its reader',
	async (mode) => {
		const { context: c, run } = setup('createModelHandler');
		const original = c.createModelObject;
		const responses: Response[] = [];
		c.createModel.mockImplementation(async () => {
			if (mode === 'network') throw Error('Unavailable');
			const response =
				mode === 'HTTP'
					? new Response('{}', { status: 403 })
					: mode === 'empty'
						? new Response(null, { status: 204 })
						: mode === 'read'
							? new Response(
									new ReadableStream({
										start(controller) {
											controller.error(Error('Read failed'));
										}
									})
								)
							: new Response(
									mode === 'JSON'
										? '{\n'
										: mode === 'server-error'
											? '{"error":"Create refused"}\n'
											: '{"status":"loading"}\n'
								);
			responses.push(response);
			return response;
		});
		await expect(run()).resolves.toBeUndefined();
		expect(c.createModel).toHaveBeenCalledOnce();
		expect(c.createModelLoading).toBe(false);
		expect(c.createModelObject).toBe(original);
		expect(c.createModelName).toBe('custom');
		expect(c.toast.error).toHaveBeenCalledOnce();
		expect(c.toast.success).not.toHaveBeenCalled();
		expect(c.models.set).not.toHaveBeenCalled();
		if (responses[0]?.body) await vi.waitFor(() => expect(responses[0]?.body?.locked).toBe(false));
	}
);
it.each(['read', 'HTTP', 'invalid', 'unfinished'])(
	'upload settles %s failure without creating a model or losing its input',
	async (mode) => {
		const { context: c, run } = setup('uploadModelHandler');
		c.downloadModel.mockImplementation(async () =>
			mode === 'read'
				? new Response(
						new ReadableStream({
							start(controller) {
								controller.error(Error('Read failed'));
							}
						})
					)
				: mode === 'HTTP'
					? new Response('{}', { status: 403 })
					: new Response(
							mode === 'invalid'
								? 'data: {"done":true,"blob":null,"name":4}\n\n'
								: 'data: {"progress":50}\n\n'
						)
		);
		await expect(run()).resolves.toBeUndefined();
		expect(c.createModel).not.toHaveBeenCalled();
		expect(c.modelLoading).toBe(false);
		expect(c.modelFileUrl).toContain('model.gguf');
		expect(c.toast.error).toHaveBeenCalledOnce();
		expect(c.toast.success).not.toHaveBeenCalled();
	}
);
it('creation preserves supplied fields and reports only terminal success', async () => {
	const { context: c, run } = setup('createModelHandler');
	c.createModel.mockImplementation(
		async () => new Response('{"status":"loading"}\n{"status":"success"}\n')
	);
	await run();
	expect(c.createModel).toHaveBeenCalledWith(
		'fixture',
		{ model: 'custom', from: 'base', parameters: { temperature: 0.4 } },
		3
	);
	expect(c.toast.success).toHaveBeenCalledOnce();
	expect(c.toast.error).not.toHaveBeenCalled();
	expect(c.createModelObject).toBe('');
	expect(c.createModelLoading).toBe(false);
});
it('concurrent creation shares the active operation instead of sending twice', async () => {
	const { context: c, run } = setup('createModelHandler');
	let resolve!: (r: Response) => void;
	c.createModel.mockImplementation(
		() =>
			new Promise<Response>((done) => {
				resolve = done;
			})
	);
	const first = run();
	await vi.waitFor(() => expect(c.createModel).toHaveBeenCalledOnce());
	const second = run();
	resolve(new Response('{"status":"success"}\n'));
	await first;
	await second;
	expect(c.createModel).toHaveBeenCalledOnce();
});
it('init leaves cached models intact when refreshing fails', async () => {
	const { context: c, run } = setup('init');
	c.getOllamaModels.mockRejectedValue(Error('Unavailable'));
	await run();
	expect(c.ollamaModels).toEqual([{ id: 'retained' }]);
	expect(c.loading).toBe(false);
	expect(c.toast.error).toHaveBeenCalledOnce();
});
it('a catalog response for a replaced connection cannot overwrite the current list', async () => {
	const { context: c, run } = setup('init');
	let resolve!: (r: object[]) => void;
	c.getOllamaModels
		.mockImplementationOnce(
			() =>
				new Promise<object[]>((done) => {
					resolve = done;
				})
		)
		.mockResolvedValueOnce([{ id: 'current' }]);
	const first = run();
	c.urlIdx = 4;
	await run();
	resolve([{ id: 'old' }]);
	await first;
	expect(c.ollamaModels).toEqual([{ id: 'current' }]);
});
it.each(['null', '{}', '{"models":null}', '{"models":[null]}', '{"models":[{}]}'])(
	'catalog rejects malformed response %s',
	async (body) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(body))
		);
		await expect(getOllamaModels('fixture', 0)).rejects.toThrow();
	}
);
it('catalog preserves metadata, fallback names and stable alphabetical sorting', async () => {
	const raw = [
		{ model: 'z', name: 'Z', modified_at: 'today', digest: 'sha256:z', size: 2, extra: 7 },
		{ model: 'a', modified_at: 'today', digest: 'sha256:a', size: 1 }
	];
	const fetch = vi.fn(async () => new Response(JSON.stringify({ models: raw })));
	vi.stubGlobal('fetch', fetch);
	await expect(getOllamaModels('fixture', 0)).resolves.toEqual([
		{ ...raw[1], id: 'a', name: 'a' },
		{ ...raw[0], id: 'z', name: 'Z' }
	]);
	expect(fetch.mock.calls[0]).toBeDefined();
});
it('create API rejects HTTP refusal, keeps the chosen server and sends an object once', async () => {
	const fetch = vi.fn<[string, RequestInit], Promise<Response>>(
		async () => new Response('{}', { status: 403 })
	);
	vi.stubGlobal('fetch', fetch);
	await expect(createModel('fixture', { model: 'custom' }, '3')).rejects.toThrow();
	expect(fetch).toHaveBeenCalledOnce();
	expect(fetch.mock.calls[0][0]).toBe('/ollama/api/create/3');
	expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual({ model: 'custom' });
});

it('reads JSON split across network chunks, including a final line without newline', async () => {
	const { context: c, run } = setup('createModelHandler');
	c.createModel.mockImplementation(
		async () =>
			new Response(
				new ReadableStream({
					start(controller) {
						for (const chunk of ['{"status":"loa', 'ding"}\n{"status":', '"success"}'])
							controller.enqueue(new TextEncoder().encode(chunk));
						controller.close();
					}
				})
			)
	);
	await run();
	expect(c.toast.success).toHaveBeenCalledOnce();
	expect(c.toast.error).not.toHaveBeenCalled();
	expect(c.createModelLoading).toBe(false);
});
it('applies file upload settings on the same captured connection and model', async () => {
	const { context: c, run } = setup('uploadModelHandler');
	c.modelUploadMode = 'file';
	c.uploadModel.mockImplementation(async () => {
		c.urlIdx = 4;
		return new Response(
			'data: {"done":true,"blob":"sha256:fixture","name":"model.gguf","model_created":"model"}\n\n'
		);
	});
	await run();
	expect(c.createModel).toHaveBeenCalledWith(
		'fixture',
		{
			model: 'model',
			files: { 'model.gguf': 'sha256:fixture' },
			stream: true,
			template: 'custom template',
			parameters: { num_ctx: 4096 }
		},
		3
	);
	expect(c.toast.success).toHaveBeenCalledOnce();
	expect(c.toast.error).not.toHaveBeenCalled();
});
