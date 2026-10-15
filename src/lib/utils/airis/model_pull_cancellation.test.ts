// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const paths = [
	'src/lib/components/chat/ModelSelector/Selector.svelte',
	'src/lib/components/admin/Settings/Models/Manage/ManageOllama.svelte'
];

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function setup(path: string) {
	const source = readFileSync(path, 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing script');
	const script = ts.createSourceFile(
		path,
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const names = ['pullModelHandler', 'cancelModelPullHandler'];
	const declarations = script.statements
		.filter(ts.isVariableStatement)
		.flatMap((s) => [...s.declarationList.declarations])
		.filter((d) => names.includes(d.name.getText(script)));
	expect(declarations).toHaveLength(2);
	const read = deferred<ReadableStreamReadResult<string>>();
	const reader = {
		read: vi.fn(() => read.promise),
		cancel: vi.fn().mockResolvedValue(undefined),
		releaseLock: vi.fn()
	};
	const abortController = new AbortController();
	const neighbor = { done: false };
	const context = {
		searchValue: 'fixture',
		modelTag: 'fixture',
		modelLoading: false,
		localStorage: { token: 'fixture' },
		urlIdx: 2 as number | null,
		MAX_PARALLEL_DOWNLOADS: 3,
		$MODEL_DOWNLOAD_POOL: { neighbor } as Record<string, unknown>,
		MODEL_DOWNLOAD_POOL: {
			set: (pool: Record<string, unknown>): void => {
				context.$MODEL_DOWNLOAD_POOL = pool;
			}
		},
		toast: { error: vi.fn(), success: vi.fn() },
		$i18n: { t: (s: string): string => s },
		console: { log: vi.fn(), error: vi.fn() },
		$config: { features: {} },
		$settings: {},
		models: { set: vi.fn() },
		getModels: vi.fn().mockResolvedValue([]),
		deleteModel: vi.fn().mockResolvedValue(true),
		TextDecoderStream,
		splitStream: vi.fn(),
		pullModel: vi.fn().mockResolvedValue([
			{
				body: {
					pipeThrough: (): object => ({
						pipeThrough: (): object => ({ getReader: (): object => reader })
					})
				}
			},
			abortController
		])
	};
	const code = ts.transpileModule(
		declarations.map((d) => `const ${d.getText(script)};`).join('\n') +
			'\n({pullModelHandler, cancelModelPullHandler});',
		{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
	).outputText;
	const handlers = runInNewContext(code, context) as {
		pullModelHandler: () => Promise<void>;
		cancelModelPullHandler: (model: string) => Promise<void>;
	};
	return { ...handlers, context, reader, read, abortController, neighbor };
}

it.each(paths)('%s ignores an already absent download', async (path) => {
	const s = setup(path);
	await expect(s.cancelModelPullHandler('missing')).resolves.toBeUndefined();
	expect(s.context.deleteModel).not.toHaveBeenCalled();
	expect(s.context.$MODEL_DOWNLOAD_POOL.neighbor).toBe(s.neighbor);
});

it.each(paths)('%s keeps cancellation exclusive until deletion settles', async (path) => {
	const s = setup(path);
	const deletion = deferred<boolean>();
	s.context.deleteModel.mockReturnValue(deletion.promise);
	const running = s.pullModelHandler();
	await vi.waitFor(() => expect(s.reader.read).toHaveBeenCalledTimes(1));
	const cancel = s.cancelModelPullHandler('fixture');
	await vi.waitFor(() => expect(s.context.deleteModel).toHaveBeenCalledTimes(1));
	await expect(s.cancelModelPullHandler('fixture')).resolves.toBeUndefined();
	await s.pullModelHandler();
	expect(s.context.pullModel).toHaveBeenCalledTimes(1);
	// A late chunk is possible even after abort: it must not revive progress/success.
	s.read.resolve({ value: '{"status":"success"}\n', done: false });
	await expect(running).resolves.toBeUndefined();
	expect(s.context.models.set).not.toHaveBeenCalled();
	expect(s.context.$MODEL_DOWNLOAD_POOL.fixture).toBeDefined();
	deletion.resolve(true);
	await cancel;
	expect(s.context.deleteModel).toHaveBeenCalledWith(
		'fixture',
		'fixture',
		path.includes('ManageOllama') ? '2' : '0'
	);
	expect(s.abortController.signal.aborted).toBe(true);
	expect(s.reader.cancel).toHaveBeenCalledTimes(1);
	expect(s.reader.releaseLock).toHaveBeenCalledTimes(1);
	expect(Object.keys(s.context.$MODEL_DOWNLOAD_POOL)).toEqual(['neighbor']);
	expect(s.context.$MODEL_DOWNLOAD_POOL.neighbor).toBe(s.neighbor);
	expect(s.context.modelLoading).toBe(false);
});

it.each(paths)('%s clears its own entry when catalog refresh fails', async (path) => {
	const s = setup(path);
	s.context.getModels.mockRejectedValue(new Error('offline'));
	s.reader.read
		.mockResolvedValueOnce({ value: '{"status":"success"}\n', done: false })
		.mockResolvedValueOnce({ done: true, value: undefined });
	await expect(s.pullModelHandler()).resolves.toBeUndefined();
	expect(s.context.getModels).toHaveBeenCalledTimes(1);
	expect(s.context.toast.error).toHaveBeenCalled();
	expect(s.context.models.set).not.toHaveBeenCalled();
	expect(Object.keys(s.context.$MODEL_DOWNLOAD_POOL)).toEqual(['neighbor']);
	expect(s.reader.releaseLock).toHaveBeenCalledTimes(1);
	expect(s.context.modelLoading).toBe(false);
});

it.each(paths.flatMap((path) => ['reader', 'delete'].map((mode) => [path, mode])))(
	'%s settles failed %s cancellation',
	async (path, mode) => {
		const s = setup(path);
		if (mode === 'reader') s.reader.cancel.mockRejectedValue(new Error('cancel failed'));
		else s.context.deleteModel.mockRejectedValue(new Error('delete failed'));
		const running = s.pullModelHandler();
		await vi.waitFor(() => expect(s.reader.read).toHaveBeenCalledTimes(1));
		await expect(s.cancelModelPullHandler('fixture')).resolves.toBeUndefined();
		s.read.resolve({ done: true, value: undefined });
		await expect(running).resolves.toBeUndefined();
		expect(s.context.toast.error).toHaveBeenCalled();
		expect(s.context.models.set).not.toHaveBeenCalled();
		expect(Object.keys(s.context.$MODEL_DOWNLOAD_POOL)).toEqual(['neighbor']);
		expect(s.reader.releaseLock).toHaveBeenCalledTimes(1);
		expect(s.context.modelLoading).toBe(false);
	}
);

it.each(paths)('%s retains normal progress and success', async (path) => {
	const s = setup(path);
	s.reader.read.mockResolvedValueOnce({
		value: '{"status":"pulling","digest":"sha256:fixture","completed":5,"total":10}\n',
		done: false
	});
	const running = s.pullModelHandler();
	await vi.waitFor(() => expect(s.reader.read).toHaveBeenCalledTimes(2));
	expect(s.context.$MODEL_DOWNLOAD_POOL.fixture).toMatchObject({
		pullProgress: 50,
		digest: 'sha256:fixture',
		done: false
	});
	s.reader.read.mockResolvedValueOnce({ done: true, value: undefined });
	s.read.resolve({ value: '{"status":"success"}\n', done: false });
	await running;
	expect(s.context.models.set).toHaveBeenCalledTimes(1);
	expect(s.context.toast.error).not.toHaveBeenCalled();
	expect(s.reader.releaseLock).toHaveBeenCalledTimes(1);
	expect(Object.keys(s.context.$MODEL_DOWNLOAD_POOL)).toEqual(['neighbor']);
});

it.each(paths)('%s ignores a catalog response after cancellation', async (path) => {
	const s = setup(path);
	const refresh = deferred<object[]>();
	s.context.getModels.mockReturnValue(refresh.promise);
	s.reader.read
		.mockResolvedValueOnce({ value: '{"status":"success"}\n', done: false })
		.mockResolvedValueOnce({ done: true, value: undefined });
	const running = s.pullModelHandler();
	await vi.waitFor(() => expect(s.context.getModels).toHaveBeenCalledTimes(1));
	await s.cancelModelPullHandler('fixture');
	refresh.resolve([{ id: 'fixture' }]);
	await running;
	expect(s.context.models.set).not.toHaveBeenCalled();
	expect(s.reader.releaseLock).toHaveBeenCalledTimes(1);
	expect(s.context.modelLoading).toBe(false);
	expect(Object.keys(s.context.$MODEL_DOWNLOAD_POOL)).toEqual(['neighbor']);
});

it.each(paths)('%s cancels a native pending reader', async (path) => {
	const s = setup(path);
	const cancelled = vi.fn();
	const body = new ReadableStream<Uint8Array>({ cancel: cancelled });
	s.context.splitStream.mockImplementation(() => new TransformStream<string, string>());
	s.context.pullModel.mockResolvedValue([new Response(body), s.abortController]);
	const running = s.pullModelHandler();
	await vi.waitFor(() => expect(s.context.$MODEL_DOWNLOAD_POOL.fixture).toBeDefined());
	await s.cancelModelPullHandler('fixture');
	await expect(running).resolves.toBeUndefined();
	await vi.waitFor(() => expect(cancelled).toHaveBeenCalledTimes(1));
	expect(s.context.models.set).not.toHaveBeenCalled();
	expect(s.context.modelLoading).toBe(false);
	expect(Object.keys(s.context.$MODEL_DOWNLOAD_POOL)).toEqual(['neighbor']);
});

it.each(paths)('%s records the default server when no index is selected', async (path) => {
	const s = setup(path);
	s.context.urlIdx = null;
	const running = s.pullModelHandler();
	await vi.waitFor(() => expect(s.reader.read).toHaveBeenCalledTimes(1));
	await s.cancelModelPullHandler('fixture');
	s.read.resolve({ done: true, value: undefined });
	await running;
	expect(s.context.deleteModel).toHaveBeenCalledWith('fixture', 'fixture', '0');
});
