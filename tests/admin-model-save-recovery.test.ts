// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const source = readFileSync('src/lib/components/admin/Settings/Models.svelte', 'utf8');
const script = ts.createSourceFile(
	'admin.ts',
	source.split('<script lang="ts">')[1].split('</script>')[0],
	ts.ScriptTarget.Latest
);
type Model = { id: string; name: string; is_active: boolean; meta: { hidden: boolean } };

function handler(name: string): string {
	for (const statement of script.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const item = statement.declarationList.declarations.find(
			(node) => node.name.getText(script) === name
		);
		if (item?.initializer) return item.initializer.getText(script);
	}
	throw new Error(`Missing ${name}`);
}

function admin(existing = true) {
	const model: Model = { id: 'model', name: 'Unsaved', is_active: true, meta: { hidden: false } };
	const context = {
		models: [model],
		filteredModels: [model],
		workspaceModels: existing ? [{ id: model.id }] : [],
		selectedModelId: model.id as string | null,
		localStorage: { token: 'fixture' },
		console: { log: vi.fn() },
		toast: { error: vi.fn(), success: vi.fn() },
		$i18n: { t: (key: string): string => key },
		$config: { features: {} },
		$settings: {},
		_models: { set: vi.fn() },
		init: vi.fn().mockResolvedValue(undefined),
		tick: vi.fn().mockResolvedValue(undefined),
		getModels: vi.fn().mockResolvedValue([]),
		createNewModel: vi.fn().mockResolvedValue(model),
		updateModelById: vi.fn().mockResolvedValue(model),
		toggleModelById: vi.fn().mockResolvedValue(model),
		upsertModelHandler: async (_model: Model): Promise<void> => {
			void _model;
		}
	};
	function run<T>(expression: string): T {
		return runInNewContext(
			ts.transpileModule(`(${expression})`, {
				compilerOptions: { target: ts.ScriptTarget.ES2022 }
			}).outputText,
			context
		) as T;
	}
	context.upsertModelHandler = run(handler('upsertModelHandler'));
	return { context, model, run };
}

it.each([false, true])(
	'keeps editor open on failed %s persistence and closes after retry',
	async (existing) => {
		const { context, model, run } = admin(existing);
		const mutation = existing ? context.updateModelById : context.createNewModel;
		mutation.mockRejectedValueOnce('offline');
		const body = source.split('onSubmit={async (model) => {')[1].split('}}')[0];
		const submit = run<(model: Model) => Promise<void>>(`async (model) => {${body}}`);
		await expect(submit(model)).rejects.toBe('offline');
		expect(context.selectedModelId).toBe(model.id);
		expect(model.name).toBe('Unsaved');
		expect(context.init).not.toHaveBeenCalled();
		expect(context.toast.success).not.toHaveBeenCalled();
		await submit(model);
		expect(context.selectedModelId).toBeNull();
		expect(context.init).toHaveBeenCalledTimes(1);
		expect(context.toast.success).toHaveBeenCalledTimes(1);
	}
);

it.each([false, true])('rejects null transport outcome for existing=%s', async (existing) => {
	const { context, model } = admin(existing);
	(existing ? context.updateModelById : context.createNewModel).mockResolvedValue(null);
	await expect(context.upsertModelHandler(model)).rejects.toBeDefined();
	expect(context.init).not.toHaveBeenCalled();
	expect(context.toast.success).not.toHaveBeenCalled();
});

it.each(['enableAllHandler', 'disableAllHandler', 'showAllHandler', 'hideAllHandler'])(
	'%s waits for all outcomes and reports partial failure without false success or optimistic changes',
	async (name) => {
		const { context, model, run } = admin();
		model.is_active = name !== 'enableAllHandler';
		model.meta.hidden = name === 'showAllHandler';
		const second = { ...model, id: 'second', meta: { ...model.meta } };
		context.models.push(second);
		context.filteredModels.push(second);
		context.workspaceModels.push({ id: second.id });
		const before = JSON.stringify(context.models);
		let finish: (value: Model) => void = () => {};
		context.updateModelById.mockRejectedValueOnce('offline').mockImplementationOnce(
			() =>
				new Promise<Model>((resolve) => {
					finish = resolve;
				})
		);
		const promise = run<() => Promise<void>>(handler(name))();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(context.init).not.toHaveBeenCalled();
		expect(JSON.stringify(context.models)).toBe(before);
		finish(second);
		await promise;
		expect(context.init).toHaveBeenCalledTimes(1);
		expect(context.toast.error).toHaveBeenCalledTimes(1);
		expect(context.toast.success).not.toHaveBeenCalled();
	}
);

it.each(['showAllHandler', 'hideAllHandler'])('%s reports full success', async (name) => {
	const { context, model, run } = admin();
	model.meta.hidden = name === 'showAllHandler';
	await run<() => Promise<void>>(handler(name))();
	expect(context.toast.success).toHaveBeenCalledTimes(1);
	expect(context.toast.error).not.toHaveBeenCalled();
	expect(context.init).toHaveBeenCalledTimes(1);
});

it('does not hide a model or claim success after failed persistence', async () => {
	const { context, model, run } = admin();
	context.updateModelById.mockRejectedValueOnce('offline');
	await run<(model: Model) => Promise<void>>(handler('hideModelHandler'))(model);
	expect(context.models[0].meta.hidden).toBe(false);
	expect(context.getModels).not.toHaveBeenCalled();
	expect(context.toast.error).toHaveBeenCalledTimes(1);
	expect(context.toast.success).not.toHaveBeenCalled();
});

it.each([false, true])('restores failed bound active switch for existing=%s', async (existing) => {
	const { context, model, run } = admin(existing);
	if (existing) Object.assign(model, { base_model_id: null });
	model.is_active = false; // Switch binding has already changed true to false.
	(existing ? context.toggleModelById : context.createNewModel).mockRejectedValueOnce('offline');
	await run<(model: Model) => Promise<void>>(handler('toggleModelHandler'))(model);
	expect(model.is_active).toBe(true);
	expect(context.getModels).not.toHaveBeenCalled();
	expect(context.toast.error).toHaveBeenCalledTimes(1);
});

it('remembers a newly persisted base model for subsequent visibility and toggle actions', async () => {
	const { context, model, run } = admin(false);
	const hide = run<(model: Model) => Promise<void>>(handler('hideModelHandler'));
	await hide(model);
	expect(context.workspaceModels.some((item) => item.id === model.id)).toBe(true);
	await hide(context.models[0]);
	expect(context.createNewModel).toHaveBeenCalledTimes(1);
	expect(context.updateModelById).toHaveBeenCalledTimes(1);
	const toggle = run<(model: Model) => Promise<void>>(handler('toggleModelHandler'));
	await toggle(model);
	expect(context.toggleModelById).toHaveBeenCalledTimes(1);
	expect(context.createNewModel).toHaveBeenCalledTimes(1);
});
