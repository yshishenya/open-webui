// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import type { Settings } from '$lib/stores';
import type { GenerationParams } from '$lib/utils/airis/frontend-contracts';

type FormParams = Omit<GenerationParams, 'stop'> & { stop: string | null };

const loadForm = (saved: Settings) => {
	const source = readFileSync('src/lib/components/chat/Settings/General.svelte', 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing component script');
	const ast = ts.createSourceFile(
		'general.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const script = ast.statements
		.filter((statement) => !ts.isImportDeclaration(statement))
		.map((statement) => statement.getText(ast).replace(/^export /, ''))
		.join('\n');
	const mounts: (() => Promise<void>)[] = [];
	const persist = vi.fn<[Partial<Settings>], Promise<void>>(async () => {});
	const dispatch = vi.fn();
	const code = ts.transpileModule(
		`(() => { ${script}; saveSettings = persist;
		return { values: () => ({ system, params }), edit: (patch) => Object.assign(params, patch), save: saveHandler }; })()`,
		{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
	).outputText;
	const form = runInNewContext(code, {
		$settings: saved,
		$config: { features: { enable_easter_eggs: false } },
		$i18n: { language: 'ru' },
		getContext: () => ({}),
		createEventDispatcher: () => dispatch,
		onMount: (callback: () => Promise<void>) => mounts.push(callback),
		getLanguages: async () => [],
		localStorage: {},
		persist
	}) as {
		values: () => { system: string; params: FormParams };
		edit: (patch: Partial<FormParams>) => void;
		save: () => Promise<void>;
	};
	return { form, persist, dispatch, initialize: () => Promise.all(mounts.map((mount) => mount())) };
};

it.each([undefined, null, [], ['END', '', 'STOP']])(
	'loads and saves the existing stop value %j without changing saved settings',
	async (stop) => {
		const saved: Settings = {
			system: 'Краткий ответ',
			params: { stop, temperature: 0.4, stream_response: false, custom_params: { extra: 'value' } }
		};
		const before = structuredClone(saved);
		const { form, persist, dispatch, initialize } = loadForm(saved);
		await initialize();
		expect(form.values().params.stop).toBe(stop ? stop.join(',') : null);
		await form.save();
		const updated = persist.mock.calls[0][0];
		expect(updated.system).toBe('Краткий ответ');
		expect(updated.params).toMatchObject({
			temperature: 0.4,
			stream_response: false,
			custom_params: { extra: 'value' }
		});
		expect(updated.params?.stop).toEqual(stop?.length ? stop.filter((value) => value) : undefined);
		expect(saved).toEqual(before);
		expect(persist).toHaveBeenCalledTimes(1);
		expect(dispatch).toHaveBeenCalledWith('save');
	}
);

it('saves edited form values using the existing settings payload', async () => {
	const { form, persist, initialize } = loadForm({});
	await initialize();
	form.edit({ stop: 'END,,STOP', temperature: 0, stream_response: true, seed: 42 });
	await form.save();
	const updated = persist.mock.calls[0][0];
	expect(updated.system).toBeUndefined();
	expect(updated.params).toMatchObject({
		stop: ['END', 'STOP'],
		temperature: 0,
		stream_response: true,
		seed: 42
	});
	expect(updated.params?.custom_params).toBeUndefined();
});
