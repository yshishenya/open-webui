// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

function handler(file: string, name: string): string {
	const marker = file === parent ? '<script lang="ts">' : '<script>';
	const source = readFileSync(file, 'utf8').split(marker)[1].split('</script>')[0];
	const ast = ts.createSourceFile('settings.ts', source, ts.ScriptTarget.Latest);
	for (const statement of ast.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const item = statement.declarationList.declarations.find(
			(node) => node.name.getText(ast) === name
		);
		if (item?.initializer) return item.initializer.getText(ast);
	}
	throw new Error(`Missing ${name}`);
}

const parent = 'src/lib/components/admin/Settings/Models.svelte';
const child = 'src/lib/components/admin/Settings/Models/ModelDefaultsPanel.svelte';

function settings() {
	const current = {
		DEFAULT_MODELS: 'selected',
		DEFAULT_PINNED_MODELS: 'pinned',
		MODEL_ORDER_LIST: ['second', 'first']
	};
	const context = {
		loading: false,
		DEFAULT_CAPABILITIES: { vision: true },
		defaultParams: {},
		$appConfig: { default_prompt_suggestions: [{ content: 'Saved suggestion' }] },
		dirty: true,
		savingModelsSettings: false,
		savingModelOrder: false,
		modelOrderDirty: true,
		modelDefaultsDirty: false,
		modelDefaultsPanel: { save: vi.fn().mockResolvedValue(true) },
		modelOrderList: ['second', 'first'],
		defaultModelIds: ['selected'],
		defaultPinnedModelIds: ['pinned'],
		modelsConfig: {},
		config: { MODEL_ORDER_LIST: ['first', 'second'] } as Record<string, unknown> | null,
		modelIds: ['first', 'second'],
		defaultCapabilities: { vision: false },
		defaultFeatureIds: [],
		builtinTools: {},
		configuredParams: [['temperature', 0.7]],
		promptSuggestions: [{ content: 'Retained draft' }],
		savedSnapshot: 'before',
		getSnapshot: (): string => 'after',
		localStorage: { token: 'fixture' },
		$i18n: { t: (key: string): string => key },
		$config: { features: {} },
		$settings: {},
		toast: { error: vi.fn(), success: vi.fn() },
		_models: { set: vi.fn() },
		appConfig: { set: vi.fn() },
		getModelsConfig: vi.fn().mockResolvedValue(current),
		setModelsConfig: vi.fn().mockResolvedValue(current),
		setDefaultPromptSuggestions: vi.fn().mockResolvedValue([{ content: 'Retained draft' }]),
		getBackendConfig: vi.fn().mockResolvedValue({}),
		getModels: vi.fn().mockResolvedValue([]),
		initHandler: vi.fn().mockResolvedValue(undefined),
		saveModelOrder: async (ids: string[]): Promise<void> => {
			void ids;
		}
	};
	function run<T>(file: string, name: string): T {
		return runInNewContext(
			ts.transpileModule(`(${handler(file, name)})`, {
				compilerOptions: { target: ts.ScriptTarget.ES2022 }
			}).outputText,
			context
		) as T;
	}
	context.saveModelOrder = run(parent, 'saveModelOrder');
	return { context, run, current };
}

it('shared Save handles child refusal, resets busy and permits retry', async () => {
	const { context, run } = settings();
	context.modelOrderDirty = false;
	context.modelDefaultsDirty = true;
	context.modelDefaultsPanel.save.mockRejectedValueOnce(new Error('private transport detail'));
	const save = run<() => Promise<void>>(parent, 'saveModelsSettings');
	await save();
	expect(context.savingModelsSettings).toBe(false);
	expect(context.modelDefaultsDirty).toBe(true);
	expect(context.toast.error).toHaveBeenCalledTimes(1);
	expect(context.toast.error).toHaveBeenCalledWith('Something went wrong :/');
	await save();
	expect(context.modelDefaultsPanel.save).toHaveBeenCalledTimes(2);
});

it.each(['write', 'null', 'refresh'])(
	'order %s refusal recovers flags and retains retry',
	async (step) => {
		const { context, run } = settings();
		context.modelDefaultsDirty = true;
		if (step === 'write') context.setModelsConfig.mockRejectedValueOnce('private detail');
		if (step === 'null') context.setModelsConfig.mockResolvedValueOnce(null);
		if (step === 'refresh') context.getModels.mockRejectedValueOnce('private detail');
		const save = run<() => Promise<void>>(parent, 'saveModelsSettings');
		await save();
		expect(context.savingModelsSettings).toBe(false);
		expect(context.savingModelOrder).toBe(false);
		expect(context.modelOrderDirty).toBe(true);
		expect(context.modelOrderList).toEqual(['second', 'first']);
		expect(context.modelDefaultsPanel.save).not.toHaveBeenCalled();
		expect(context.toast.error).toHaveBeenCalledTimes(1);
		expect(context.toast.error).toHaveBeenCalledWith('Something went wrong :/');
		expect(context.toast.success).not.toHaveBeenCalled();
		await save();
		expect(context.modelOrderDirty).toBe(false);
		expect(context.modelDefaultsPanel.save).toHaveBeenCalledTimes(1);
	}
);

it.each([
	'config-read',
	'null-read',
	'write',
	'null',
	'suggestions',
	'null-suggestions',
	'backend',
	'null-backend',
	'parent'
])(
	'defaults %s refusal retains input, reports once and retries without overwriting order',
	async (step) => {
		const { context, run, current } = settings();
		if (step === 'null-read') context.getModelsConfig.mockResolvedValueOnce(null);
		if (step === 'null-suggestions')
			context.setDefaultPromptSuggestions.mockResolvedValueOnce(null);
		if (step === 'null-backend') context.getBackendConfig.mockResolvedValueOnce(null);
		if (step === 'config-read') context.getModelsConfig.mockRejectedValueOnce('private detail');
		if (step === 'write') context.setModelsConfig.mockRejectedValueOnce('private detail');
		if (step === 'null') context.setModelsConfig.mockResolvedValueOnce(null);
		if (step === 'suggestions') context.setDefaultPromptSuggestions.mockRejectedValueOnce('detail');
		if (step === 'backend') context.getBackendConfig.mockRejectedValueOnce('private detail');
		if (step === 'parent') context.initHandler.mockRejectedValueOnce('private detail');
		const save = run<() => Promise<boolean>>(child, 'save');
		expect(await save()).toBe(false);
		expect(context.dirty).toBe(true);
		expect(context.promptSuggestions).toEqual([{ content: 'Retained draft' }]);
		expect(context.toast.error).toHaveBeenCalledTimes(1);
		expect(context.toast.error).toHaveBeenCalledWith('Something went wrong :/');
		expect(context.toast.success).not.toHaveBeenCalled();
		expect(await save()).toBe(true);
		expect(context.dirty).toBe(false);
		expect(context.setModelsConfig).toHaveBeenLastCalledWith(
			'fixture',
			expect.objectContaining(current)
		);
		expect(context.savedSnapshot).toBe('after');
		expect(context.toast.success).toHaveBeenCalledTimes(1);
	}
);

it.each(['reject', 'null'])('initial defaults %s refusal permits safe retry', async (step) => {
	const { context, run } = settings();
	context.config = null;
	if (step === 'reject') context.getModelsConfig.mockRejectedValueOnce(new Error('private detail'));
	else context.getModelsConfig.mockResolvedValueOnce(null);
	const init = run<() => Promise<void>>(child, 'init');
	await init();
	expect(context.loading).toBe(false);
	expect(context.config).toBeNull();
	expect(context.defaultCapabilities).toEqual({ vision: false });
	expect(context.savedSnapshot).toBe('before');
	expect(context.toast.error).toHaveBeenCalledTimes(1);
	expect(context.toast.error).toHaveBeenCalledWith('Something went wrong :/');
	expect(context.setModelsConfig).not.toHaveBeenCalled();
	const saved = {
		DEFAULT_MODEL_METADATA: {
			capabilities: { vision: true },
			defaultFeatureIds: ['web_search'],
			builtinTools: { time: true }
		},
		DEFAULT_MODEL_PARAMS: { temperature: 0.3 }
	};
	context.getModelsConfig.mockResolvedValueOnce(saved);
	await init();
	expect(context.loading).toBe(false);
	expect(context.config).toEqual(saved);
	expect(context.defaultCapabilities).toEqual(saved.DEFAULT_MODEL_METADATA.capabilities);
	expect(context.defaultParams).toEqual(saved.DEFAULT_MODEL_PARAMS);
	expect(context.promptSuggestions).toEqual([{ content: 'Saved suggestion' }]);
	expect(context.dirty).toBe(false);
	expect(context.toast.error).toHaveBeenCalledTimes(1);
});

it('initial defaults read does not duplicate a busy request', async () => {
	const { context, run } = settings();
	context.loading = true;
	await run<() => Promise<void>>(child, 'init')();
	expect(context.getModelsConfig).not.toHaveBeenCalled();
	expect(context.loading).toBe(true);
});
