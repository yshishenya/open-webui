// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const modelFile = 'src/lib/components/admin/Settings/Models.svelte';
const source = (): string =>
	readFileSync(process.env.AIRIS_ADMIN_MODEL_SOURCE ?? modelFile, 'utf8');
const nodes = (value: unknown): Record<string, unknown>[] => {
	if (!value || typeof value !== 'object') return [];
	if (Array.isArray(value)) return value.flatMap(nodes);
	const node = value as Record<string, unknown>;
	return [node, ...Object.values(node).flatMap(nodes)];
};
const evaluate = (code: string, context: Record<string, unknown>): unknown =>
	runInNewContext(
		ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
		context
	);

function importing(files: File[] | null = [new File(['fixture'], 'models.json')]) {
	const text = source();
	const input = nodes(parse(text).html).find(
		(n) =>
			n.type === 'Element' &&
			n.name === 'input' &&
			typeof n.start === 'number' &&
			typeof n.end === 'number' &&
			text.slice(n.start, n.end).includes('id="models-import-input"')
	);
	if (!input) throw new Error('Missing actual import input');
	const handler = nodes(input.attributes).find(
		(n) => n.type === 'EventHandler' && n.name === 'change'
	);
	const expression = handler?.expression as { start: number; end: number } | undefined;
	if (!expression) throw new Error('Missing actual import change handler');
	const upload = vi.fn(async () => true),
		init = vi.fn(async () => {}),
		error = vi.fn(),
		success = vi.fn();
	const readers: {
		onload: (event: { target: { result: unknown } | null }) => Promise<void>;
		readAsText: ReturnType<typeof vi.fn>;
	}[] = [];
	const actual = evaluate(
		`let importFiles = inputFiles; let modelsImportInProgress = false; const change = ${text.slice(expression.start, expression.end)}; ({change, loading: () => modelsImportInProgress});`,
		{
			inputFiles: files,
			importModels: upload,
			init,
			localStorage: { token: 'fixture' },
			$i18n: { t: (text: string) => text },
			toast: { error, success },
			console: { error: vi.fn() },
			Error,
			FileReader: class {
				onload = async (): Promise<void> => {};
				readAsText = vi.fn();
				constructor() {
					readers.push(this);
				}
			}
		}
	) as { change: () => void; loading: () => boolean };
	return { actual, upload, init, error, success, readers };
}

it.each(['empty', 'cancelled'])('actual import ignores %s file selection', (mode) => {
	const r = importing(mode === 'empty' ? [] : null);
	expect(() => r.actual.change()).not.toThrow();
	expect(r.readers).toHaveLength(0);
	expect(r.upload).not.toHaveBeenCalled();
	expect(r.actual.loading()).toBe(false);
});
it.each([
	'null target',
	'null result',
	'buffer',
	'JSON null',
	'JSON object',
	'malformed',
	'success',
	'rejected'
])('actual import handles %s without leaving a busy state', async (mode) => {
	const r = importing();
	r.actual.change();
	expect(r.readers).toHaveLength(1);
	const payload = [
		{ id: 'fixture-model', name: 'Fixture', meta: {}, params: {}, access_grants: [] }
	];
	const result =
		mode === 'null result'
			? null
			: mode === 'buffer'
				? new ArrayBuffer(2)
				: mode === 'JSON null'
					? 'null'
					: mode === 'JSON object'
						? '{}'
						: mode === 'malformed'
							? '{'
							: JSON.stringify(payload);
	if (mode === 'rejected') r.upload.mockRejectedValueOnce({ detail: 'Import unavailable' });
	await r.readers[0].onload({ target: mode === 'null target' ? null : { result } });
	expect(r.actual.loading()).toBe(false);
	if (mode === 'success' || mode === 'rejected')
		expect(r.upload).toHaveBeenCalledWith('fixture', payload);
	else expect(r.upload).not.toHaveBeenCalled();
	expect(r.init).toHaveBeenCalledTimes(mode === 'success' ? 1 : 0);
	expect(r.error).toHaveBeenCalledTimes(mode === 'success' ? 0 : 1);
	if (mode === 'rejected') expect(r.error).toHaveBeenCalledWith('Import unavailable');
});

it.each(['missing index', 'same index', 'detached', 'reloaded', 'valid'])(
	'actual reorder handles %s',
	async (mode) => {
		const text = source(),
			instance = parse(text).instance;
		if (!instance) throw new Error('Missing actual model script');
		const ast = ts.createSourceFile(
			'models.ts',
			text.slice(instance.content.start, instance.content.end),
			ts.ScriptTarget.Latest,
			true
		);
		const handler = ast.statements
			.filter(ts.isVariableStatement)
			.find((s) =>
				s.declarationList.declarations.some((d) => d.name.getText(ast) === 'positionChangeHandler')
			);
		if (!handler) throw new Error('Missing actual reorder handler');
		const actual = evaluate(
			`let models=initialModels; let filteredModels=[{id:'a'},{id:'b'}]; let modelOrderList=[]; let modelOrderDirty=false; ${handler.getText(ast)} ({reorder:positionChangeHandler, state:()=>({models,modelOrderList,modelOrderDirty})});`,
			{ initialModels: mode === 'reloaded' ? null : [{ id: 'a' }, { id: 'b' }] }
		) as {
			reorder: (event: {
				item: HTMLElement;
				oldIndex: number | undefined;
				newIndex: number;
			}) => Promise<void>;
			state: () => {
				models: { id: string }[] | null;
				modelOrderList: string[];
				modelOrderDirty: boolean;
			};
		};
		const parent = document.createElement('div'),
			a = document.createElement('div'),
			b = document.createElement('div');
		parent.append(b, a);
		if (mode === 'detached') a.remove();
		await expect(
			actual.reorder({
				item: a,
				oldIndex: mode === 'missing index' ? undefined : 0,
				newIndex: mode === 'same index' ? 0 : 1
			})
		).resolves.toBeUndefined();
		expect(actual.state().modelOrderDirty).toBe(mode === 'valid');
		if (mode === 'valid') {
			expect(actual.state().modelOrderList).toEqual(['b', 'a']);
			expect(Array.from(parent.children)).toEqual([a, b]);
		}
	}
);

it.each(['hide', 'privacy'])(
	'does not resurrect or crash a reloaded list after pending %s mutation',
	async (mode) => {
		const text = source(),
			instance = parse(text).instance;
		if (!instance) throw new Error('Missing actual model script');
		const ast = ts.createSourceFile(
			'models.ts',
			text.slice(instance.content.start, instance.content.end),
			ts.ScriptTarget.Latest,
			true
		);
		const name = mode === 'hide' ? 'hideModelHandler' : 'toggleModelPrivacyHandler';
		const handler = ast.statements
			.filter(ts.isVariableStatement)
			.find((s) => s.declarationList.declarations.some((d) => d.name.getText(ast) === name));
		if (!handler) throw new Error('Missing actual model mutation handler');
		let resolve!: (value: { access_grants: [] }) => void;
		const pending = new Promise<{ access_grants: [] }>((yes) => {
			resolve = yes;
		});
		const model = { id: 'a', name: 'Fixture', meta: {}, access_grants: [] };
		const refresh = vi.fn(async () => []),
			set = vi.fn();
		const actual = evaluate(
			`let models=[fixtureModel]; ${handler.getText(ast)} ({mutate:${name}, reload:()=>{models=null;}, state:()=>models});`,
			{
				fixtureModel: model,
				upsertModelHandler: () => pending,
				updateModelAccessGrants: () => pending,
				isPublicModel: () => false,
				getModels: refresh,
				_models: { set },
				localStorage: { token: 'fixture' },
				$config: undefined,
				$settings: {},
				$i18n: { t: (text: string) => text },
				toast: { error: vi.fn(), success: vi.fn() }
			}
		) as {
			mutate: (value: typeof model) => Promise<void>;
			reload: () => void;
			state: () => null | (typeof model)[];
		};
		const work = actual.mutate(model);
		actual.reload();
		resolve({ access_grants: [] });
		await expect(work).resolves.toBeUndefined();
		expect(actual.state()).toBeNull();
		expect(refresh).toHaveBeenCalledOnce();
		expect(set).toHaveBeenCalledWith([]);
	}
);
