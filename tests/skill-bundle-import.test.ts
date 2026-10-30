// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

type BundleFile = { name: string };
type Decision = {
	action: 'create' | 'replace' | 'skip';
	id: string;
	name: string;
	expected_version_id?: string;
};
type PreviewItem = Omit<Decision, 'action'> & { id_taken?: boolean; name_taken?: boolean };
type ImportResult = { status: 'saved' | 'error' | 'skipped'; detail?: string };
type ImportItem = Decision & PreviewItem & { originalId: string };
type State = { loading: boolean; error: string; items: ImportItem[]; results: ImportResult[] };
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => (resolve = done));
	return { promise, resolve };
};
const skill: PreviewItem = { id: 'skill', name: 'Skill', expected_version_id: 'version-1' };

const rig = () => {
	const source = readFileSync('src/lib/components/workspace/Skills/SkillImport.svelte', 'utf8');
	const ast = ts.createSourceFile(
		'SkillImport.ts',
		source.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1],
		ts.ScriptTarget.Latest,
		true
	);
	// Run the actual production handlers. Svelte's selectedCount is provided by a live getter.
	const code = ast.statements
		.filter((statement) => !ts.isImportDeclaration(statement) && !ts.isLabeledStatement(statement))
		.map((statement) => statement.getText(ast).replace(/^export\s+/, ''))
		.join('\n');
	const request = vi.fn<
		[token: string, files: BundleFile[], decisions?: Decision[]],
		Promise<PreviewItem[] | ImportResult[]>
	>(async () => [{ ...skill }]);
	const onImported = vi.fn(async () => {});
	const error = vi.fn();
	const context = {
		getContext: () => ({}),
		localStorage: { token: 'test-token' },
		importSkillBundles: request,
		skillError: (failure: unknown) =>
			failure instanceof Error ? failure.message : String(failure),
		toast: { error },
		afterImport: onImported
	};
	const api = runInNewContext(
		ts.transpileModule(
			`${code}\nonImported=afterImport; ({preview,save,state:()=>({loading,error,items,results}),setFiles:value=>files=value,choose:(index,action)=>items[index].action=action})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		preview: () => Promise<void>;
		save: () => Promise<void>;
		state: () => State;
		setFiles: (files: BundleFile[]) => void;
		choose: (index: number, action: Decision['action']) => void;
	};
	Object.defineProperty(context, 'selectedCount', {
		get: () => api.state().items.filter((item) => item.action !== 'skip').length
	});
	const files = [{ name: 'skills.zip' }];
	api.setFiles(files);
	return { api, request, onImported, error, files };
};

it('reports a preview refusal and permits retry without a write or completion notice', async () => {
	const r = rig();
	r.request.mockRejectedValueOnce(Error('invalid bundle'));
	await r.api.preview();
	expect(r.api.state()).toMatchObject({
		loading: false,
		error: 'invalid bundle',
		items: [],
		results: []
	});
	expect(r.onImported).not.toHaveBeenCalled();
	await r.api.preview();
	expect(r.api.state()).toMatchObject({
		loading: false,
		error: '',
		items: [{ ...skill, action: 'create' }]
	});
	expect(r.request.mock.calls.every((call) => call.length === 2)).toBe(true);
});

it('requires an explicit collision decision and sends replacement version identity', async () => {
	const r = rig();
	r.request.mockResolvedValueOnce([{ ...skill, id_taken: true }]);
	await r.api.preview();
	expect(r.api.state().items[0].action).toBe('skip');
	await r.api.save();
	expect(r.request).toHaveBeenCalledTimes(1);
	r.api.choose(0, 'replace');
	r.request.mockResolvedValueOnce([{ status: 'saved' }]);
	await r.api.save();
	expect(r.request).toHaveBeenLastCalledWith('test-token', r.files, [
		{
			action: 'replace',
			id: skill.id,
			name: skill.name,
			expected_version_id: 'version-1'
		}
	]);
	expect(r.api.state().items[0].action).toBe('skip');
	expect(r.onImported).toHaveBeenCalledTimes(1);
});

it('blocks duplicate confirmation while a save is pending and retains selection after refusal', async () => {
	const r = rig();
	await r.api.preview();
	const pending = deferred<ImportResult[]>();
	r.request.mockImplementationOnce(() => pending.promise);
	const save = r.api.save();
	await r.api.save();
	expect(r.request).toHaveBeenCalledTimes(2);
	pending.resolve([{ status: 'error', detail: 'refused' }]);
	await save;
	expect(r.api.state()).toMatchObject({ loading: false, results: [{ status: 'error' }] });
	expect(r.api.state().items[0].action).toBe('create');
	expect(r.onImported).not.toHaveBeenCalled();
	r.request.mockRejectedValueOnce(Error('network refused'));
	await r.api.save();
	expect(r.error).toHaveBeenCalledWith('network refused');
	expect(r.api.state().loading).toBe(false);
	expect(r.api.state().items[0].action).toBe('create');
});

it('preserves accepted items across a partial import and retries only the refused selection', async () => {
	const r = rig();
	r.request.mockResolvedValueOnce([skill, { id: 'second', name: 'Second' }]);
	await r.api.preview();
	r.request.mockResolvedValueOnce([{ status: 'saved' }, { status: 'error', detail: 'refused' }]);
	await r.api.save();
	expect(r.api.state().items.map((item) => item.action)).toEqual(['skip', 'create']);
	expect(r.onImported).toHaveBeenCalledTimes(1);
	r.request.mockResolvedValueOnce([{ status: 'skipped' }, { status: 'saved' }]);
	await r.api.save();
	expect(r.request.mock.calls[2][2]?.map((decision) => decision.action)).toEqual([
		'skip',
		'create'
	]);
	expect(r.api.state().results).toEqual([{ status: 'saved' }, { status: 'saved' }]);
	expect(r.api.state().items.every((item) => item.action === 'skip')).toBe(true);
});

it('ignores a late preview from a previous bundle while the current preview is pending', async () => {
	const r = rig();
	const old = deferred<PreviewItem[]>(),
		current = deferred<PreviewItem[]>();
	r.request.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
	const first = r.api.preview();
	const files = [{ name: 'current.skill' }];
	r.api.setFiles(files);
	const second = r.api.preview();
	old.resolve([{ id: 'old', name: 'Old' }]);
	await first;
	expect(r.api.state()).toMatchObject({ loading: true, items: [] });
	current.resolve([{ id: 'current', name: 'Current' }]);
	await second;
	expect(r.api.state()).toMatchObject({ loading: false, items: [{ id: 'current' }] });
	expect(r.request).toHaveBeenLastCalledWith('test-token', files);
});

it('does not overwrite a newer bundle with a late save but refreshes the accepted catalog', async () => {
	const r = rig();
	await r.api.preview();
	const old = deferred<ImportResult[]>();
	r.request.mockImplementationOnce(() => old.promise);
	const save = r.api.save();
	r.api.setFiles([{ name: 'current.md' }]);
	r.request.mockResolvedValueOnce([{ id: 'current', name: 'Current' }]);
	await r.api.preview();
	old.resolve([{ status: 'saved' }]);
	await save;
	expect(r.api.state()).toMatchObject({
		loading: false,
		items: [{ id: 'current', action: 'create' }],
		results: []
	});
	expect(r.onImported).toHaveBeenCalledTimes(1);
});
