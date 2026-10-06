// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const callers = [
	['src/lib/components/chat/ModelSelector/Selector.svelte', 'pullModelHandler'],
	['src/lib/components/admin/Settings/Models/Manage/ManageOllama.svelte', 'pullModelHandler'],
	['src/lib/components/admin/Settings/Models/Manage/ManageOllama.svelte', 'updateModelsHandler']
];

it.each(
	callers.flatMap(([path, name]) =>
		['rejected', 'empty', 'stream-error', 'stream-empty', 'stream-aborted', 'success'].map(
			(mode) => [path, name, mode]
		)
	)
)('%s %s settles %s response', async (path, name, mode) => {
	const source = readFileSync(path, 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing component script');
	const parsed = ts.createSourceFile(
		path,
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const declaration = parsed.statements
		.filter(ts.isVariableStatement)
		.flatMap((s) => [...s.declarationList.declarations])
		.find((d) => d.name.getText(parsed) === name);
	if (!declaration?.initializer) throw new Error('Missing model pull handler');
	const controller = new AbortController();
	const pool: Record<string, object> = {};
	const context = {
		searchValue: 'fixture',
		modelTag: 'fixture',
		localStorage: { token: 'fixture' },
		urlIdx: 0,
		MAX_PARALLEL_DOWNLOADS: 3,
		$MODEL_DOWNLOAD_POOL: pool,
		MODEL_DOWNLOAD_POOL: {
			set: (value: Record<string, object>): void => {
				Object.assign(pool, value);
			}
		},
		toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
		$i18n: { t: (key: string): string => key },
		modelLoading: false,
		updateCancelled: false,
		ollamaModels: [{ id: 'fixture' }],
		updateModelId: null,
		updateProgress: null,
		updateModelsControllers: {},
		console: { log: vi.fn(), debug: vi.fn(), error: vi.fn() },
		$config: { features: {} },
		$settings: {},
		models: { set: vi.fn() },
		getModels: vi.fn().mockResolvedValue([]),
		TextDecoderStream,
		splitStream: (): TransformStream<string, string> => new TransformStream(),
		pullModel: vi.fn(async (): Promise<[Response, AbortController]> => {
			if (mode === 'rejected') throw new Error('offline');
			if (mode === 'stream-aborted')
				return [
					new Response(
						new ReadableStream<Uint8Array>({
							start(stream): void {
								stream.error(new DOMException('canceled', 'AbortError'));
							}
						})
					),
					controller
				];
			return [
				mode === 'empty'
					? new Response(null, { status: 204 })
					: new Response(
							mode === 'stream-empty'
								? ''
								: mode === 'stream-error'
									? '{"error":"fixture failed"}\n'
									: '{"status":"success"}\n'
						),
				controller
			];
		})
	};
	const code = ts.transpileModule(`(${declaration.initializer.getText(parsed)})`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
	const handler = runInNewContext(code, context) as () => Promise<void>;
	await handler();
	expect(context.modelLoading).toBe(false);
	expect(Object.keys(pool)).toEqual([]);
	expect(Object.keys(context.updateModelsControllers)).toEqual([]);
	if (name === 'updateModelsHandler') expect(context.updateModelId).toBeNull();
	if (mode === 'success') {
		expect(context.toast.error).not.toHaveBeenCalled();
		expect(context.toast.success).toHaveBeenCalled();
		if (name === 'pullModelHandler') expect(context.models.set).toHaveBeenCalledTimes(1);
	} else {
		if (mode === 'stream-aborted' && name === 'updateModelsHandler')
			expect(context.toast.error).not.toHaveBeenCalled();
		else expect(context.toast.error).toHaveBeenCalled();
		expect(context.toast.success).not.toHaveBeenCalled();
		expect(context.models.set).not.toHaveBeenCalled();
	}
	expect(context.pullModel).toHaveBeenCalledWith('fixture', 'fixture', 0);
});
