// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import equal from 'fast-deep-equal';
import ts from 'typescript';
import { expect, it } from 'vitest';
import type { ModelMeta } from '../src/lib/apis';

type Field = NonNullable<ModelMeta['chat_variables_schema']>['fields'][number];
type VariableModel = { id: string; info: { meta: { chat_variables_schema: { fields: Field[] } } } };
type Form = {
	conflicts: { key: string; modelIds: string[] }[];
	empty: boolean;
	missing: boolean;
	variables: Record<string, Record<string, unknown>>;
};
const component = readFileSync('src/lib/components/chat/Chat.svelte', 'utf8');
const code =
	component.slice(
		component.indexOf('\tconst mergeChatVariableSchemas'),
		component.indexOf('\tconst saveChatVariables')
	) + '\ngetChatVariablesForm';
const form = runInNewContext(
	// Keep the real comparator in the same realm as the objects it compares.
	`const equal = ${equal.toString()};\n` +
		ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
) as (ids: string[], values: Record<string, unknown>, models: VariableModel[]) => Form;
const model = (id: string, fields: Field[]): VariableModel => ({
	id,
	info: { meta: { chat_variables_schema: { fields } } }
});
const field = (key: string, required = true): Field => ({ key, type: 'text', required });

it('opens an empty required constructor field instead of treating the inherited constructor as a schema', () => {
	const result = form(['a'], {}, [model('a', [field('constructor')])]);
	expect(result.conflicts).toEqual([]);
	expect(result.empty).toBe(true);
	expect(result.missing).toBe(true);
	expect(Object.keys(result.variables)).toEqual(['constructor']);
	expect(result.variables['constructor'].default).toBeUndefined();
});

it('ignores inherited values both for completeness and for the displayed default', () => {
	const values: Record<string, unknown> = Object.create({ topic: 'inherited' });
	const result = form(['a'], values, [model('a', [field('topic')])]);
	expect(result.empty).toBe(true);
	expect(result.missing).toBe(true);
	expect(result.variables.topic.default).toBeUndefined();
});

it.each<unknown>(['entered', false, 0])(
	'preserves an explicit own constructor value %s',
	(value) => {
		const values = { constructor: value };
		const models = [model('a', [field('constructor')])];
		const before = structuredClone({ values, models });
		const result = form(['a'], values, models);
		expect(result.missing).toBe(false);
		expect(result.empty).toBe(false);
		expect(result.variables['constructor'].default).toBe(value);
		expect({ values, models }).toEqual(before);
	}
);

it('merges required flags, preserves false/zero defaults and ignores unknown or empty model selections', () => {
	const fields = [
		{ ...field('enabled', false), type: 'checkbox', default: false },
		{ ...field('count', false), type: 'number', default: 0 }
	];
	const models = [
		model('a', fields),
		model(
			'b',
			fields.map((item) => ({ ...item, required: true }))
		)
	];
	const result = form(['', 'a', 'missing-model', 'b'], {}, models);
	expect(result.conflicts).toEqual([]);
	expect(result.missing).toBe(false);
	expect(result.empty).toBe(false);
	expect(result.variables.enabled).toMatchObject({ required: true, default: false });
	expect(result.variables.count).toMatchObject({ required: true, default: 0 });
	expect(form([], {}, models)).toEqual({
		conflicts: [],
		empty: false,
		missing: false,
		variables: {}
	});
});

it('still reports a real constructor field conflict between models', () => {
	const models = [
		model('a', [field('constructor')]),
		model('b', [{ ...field('constructor'), type: 'number' }])
	];
	expect(form(['a', 'b'], {}, models).conflicts).toEqual([
		{ key: 'constructor', modelIds: ['a', 'b'] }
	]);
});

it.each<unknown>(['', null, undefined])(
	'still opens a required field with the empty own value %s',
	(value) => {
		const result = form(['a'], { topic: value }, [model('a', [field('topic')])]);
		expect(result.empty).toBe(true);
		expect(result.missing).toBe(true);
	}
);
