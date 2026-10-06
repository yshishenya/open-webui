// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

function initializer(path: string, name: string): string {
	const file = ts.createSourceFile(
		'component.ts',
		readFileSync(path, 'utf8').split('<script lang="ts">')[1].split('</script>')[0],
		ts.ScriptTarget.Latest
	);
	for (const statement of file.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const item = statement.declarationList.declarations.find(
			(node) => node.name.getText(file) === name
		);
		if (item?.initializer) return item.initializer.getText(file);
	}
	throw new Error(`Missing ${name} in ${path}`);
}

function run<T>(code: string, context: object): T {
	return runInNewContext(
		ts.transpileModule(`(${code})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as T;
}

function editor(description: string | null | undefined) {
	const context = {
		id: 'model',
		name: 'Model',
		preset: true,
		loading: false,
		success: false,
		info: { id: '', name: '', base_model_id: 'base', meta: { description }, params: {} },
		params: {},
		knowledge: [] as { status: string }[],
		accessGrants: [],
		capabilities: {},
		enableDescription: true,
		toolIds: [],
		skillIds: [],
		filterIds: [],
		defaultFilterIds: [],
		actionIds: [],
		defaultFeatureIds: [],
		builtinTools: {},
		terminalId: '',
		tts: { voice: '' },
		system: '',
		toast: { error: vi.fn(), success: vi.fn() },
		$i18n: { t: (key: string): string => key },
		onSubmit: vi.fn().mockResolvedValue(undefined)
	};
	const submit = run<() => Promise<void>>(
		initializer('src/lib/components/workspace/Models/ModelEditor.svelte', 'submitHandler'),
		context
	);
	return { context, submit };
}

it.each(['', '   ', null, undefined])(
	'retries actual create callback with description %s',
	async (description) => {
		const { context, submit } = editor(description);
		const create = run<(info: object) => Promise<void>>(
			initializer('src/routes/(app)/workspace/models/create/+page.svelte', 'onSubmit'),
			{
				$models: [{ id: 'model' }],
				toast: context.toast,
				$i18n: context.$i18n,
				localStorage: { token: 'test' },
				WEBUI_BASE_URL: '',
				createNewModel: vi.fn().mockRejectedValue('offline')
			}
		);
		context.onSubmit.mockImplementation(create);
		await submit(); // Duplicate ID: parent reports error and leaves form open.
		expect(context.loading).toBe(false);
		expect(context.info.meta.description).toBeNull();
		context.id = 'different'; // Create API rejects; parent catches, so form stays open again.
		await submit();
		await submit();
		expect(context.onSubmit).toHaveBeenCalledTimes(3);
		expect(context.loading).toBe(false);
	}
);

it('recovers from rejected edit, reports once and permits a successful retry', async () => {
	const { context, submit } = editor('Useful description');
	context.onSubmit.mockRejectedValueOnce('offline');
	await expect(submit()).resolves.toBeUndefined();
	expect(context.toast.error).toHaveBeenCalledTimes(1);
	expect(context.toast.error).toHaveBeenCalledWith('offline');
	expect(context.loading).toBe(false);
	await submit();
	expect(context.onSubmit).toHaveBeenCalledTimes(2);
	expect(context.info.meta.description).toBe('Useful description');
	expect(context.loading).toBe(false);
});

it('retains validation and recovers after description is disabled and enabled again', async () => {
	const { context, submit } = editor('Useful description');
	context.knowledge = [{ status: 'uploading' }];
	await submit();
	expect(context.onSubmit).not.toHaveBeenCalled();
	expect(context.loading).toBe(false);
	context.knowledge = [];
	context.enableDescription = false;
	await submit();
	context.enableDescription = true;
	await submit();
	expect(context.onSubmit).toHaveBeenCalledTimes(2);
	expect(context.info.meta.description).toBeNull();
	expect(context.loading).toBe(false);
});
