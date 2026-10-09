import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

function terminal(
	policy: unknown,
	lifecycle: unknown = { data: { reset: { schedule: '@weekly' } } }
) {
	const text = readFileSync(
		process.env.AIRIS_TERMINAL_BEFORE ?? 'src/lib/components/AddTerminalServerModal.svelte',
		'utf8'
	);
	const instance = parse(text).instance;
	if (!instance) throw new Error('Missing actual terminal form script');
	const ast = ts.createSourceFile(
		'terminal.ts',
		text.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const script = ts.createPrinter().printList(
		ts.ListFormat.MultiLine,
		ts.factory.createNodeArray(
			ast.statements
				.filter((s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s))
				.map((s) =>
					ts.isVariableStatement(s)
						? ts.factory.updateVariableStatement(
								s,
								s.modifiers?.filter((m) => m.kind !== ts.SyntaxKind.ExportKeyword),
								s.declarationList
							)
						: s
				)
		),
		ast
	);
	const savePolicy = vi.fn<[string, string, string, string, object, string], Promise<object>>(
		async () => ({})
	);
	const saveLifecycle = vi.fn<[string, string, string, string, object, string], Promise<object>>(
		async () => ({})
	);
	const submit = vi.fn();
	const api = runInNewContext(
		ts.transpileModule(
			`${script}\nconnection={url:'https://terminal.invalid',key:'fixture',enabled:true,server_type:'orchestrator',policy_id:'fixture'}; onSubmit=submit; init(); ({load:loadPolicy, save:submitHandler, read:()=>({policyImage,policyCpu,policyMemory,policyStorageSize,policyIdleTimeout,policyEnvPairs,lifecycleJson,policyLoadError,loadingPolicy})});`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		{
			getContext: () => ({}),
			getOrchestratorPolicy: async () => {
				if (policy instanceof Error) throw policy;
				return policy;
			},
			getOrchestratorLifecycle: async () => lifecycle,
			putOrchestratorPolicy: savePolicy,
			putOrchestratorLifecycle: saveLifecycle,
			submit,
			localStorage: { token: 'fixture' },
			toast: { error: vi.fn() },
			$i18n: { t: (value: string) => value }
		}
	) as {
		load: () => Promise<void>;
		save: () => Promise<void>;
		read: () => {
			policyImage: string;
			policyCpu: string;
			policyMemory: string;
			policyStorageSize: string;
			policyIdleTimeout: number;
			policyEnvPairs: { key: string; value: string }[];
			lifecycleJson: string;
			policyLoadError: string;
			loadingPolicy: boolean;
		};
	};
	return { ...api, savePolicy, saveLifecycle, submit };
}

it('loads and saves valid external policy and lifecycle values', async () => {
	const data = {
		image: 'fixture-image',
		cpu_limit: '2',
		memory_limit: '2Gi',
		storage: '7Gi',
		idle_timeout_minutes: 45,
		env: { TEST: 'yes', COUNT: 3 }
	};
	const form = terminal({ data });
	await form.load();
	expect(form.read()).toMatchObject({
		policyImage: 'fixture-image',
		policyCpu: '2',
		policyMemory: '2Gi',
		policyStorageSize: '7Gi',
		policyIdleTimeout: 45,
		policyLoadError: '',
		loadingPolicy: false
	});
	expect(form.read().policyEnvPairs).toEqual([
		{ key: 'TEST', value: 'yes' },
		{ key: 'COUNT', value: '3' }
	]);
	await form.save();
	expect(form.savePolicy).toHaveBeenCalledOnce();
	expect(form.savePolicy.mock.calls[0]?.[4]).toEqual({ ...data, env: { TEST: 'yes', COUNT: '3' } });
	expect(form.saveLifecycle).toHaveBeenCalledOnce();
	expect(form.submit).toHaveBeenCalledOnce();
});

it.each([
	null,
	[],
	{ data: [] },
	{ data: 'invalid' },
	{ data: { image: 12 } },
	{ data: { idle_timeout_minutes: '30' } },
	{ data: { env: [] } }
])('blocks saving a malformed policy %j without applying its fields', async (policy) => {
	const form = terminal(policy);
	await form.load();
	expect(form.read().policyLoadError).not.toBe('');
	expect(form.read()).toMatchObject({ policyImage: '', loadingPolicy: false });
	await form.save();
	expect(form.savePolicy).not.toHaveBeenCalled();
	expect(form.saveLifecycle).not.toHaveBeenCalled();
	expect(form.submit).not.toHaveBeenCalled();
});

it('blocks saving when lifecycle data is malformed', async () => {
	const form = terminal({ data: { image: 'new-image' } }, { data: [] });
	await form.load();
	expect(form.read()).toMatchObject({ policyImage: '', loadingPolicy: false });
	expect(form.read().policyLoadError).not.toBe('');
	await form.save();
	expect(form.savePolicy).not.toHaveBeenCalled();
	expect(form.submit).not.toHaveBeenCalled();
});

it.each([404, 403])(
	'retains policy read status %s and allows only a missing policy to be created',
	async (status) => {
		const form = terminal(Object.assign(new Error('read failed'), { status }));
		await form.load();
		expect(Boolean(form.read().policyLoadError)).toBe(status !== 404);
		await form.save();
		expect(form.savePolicy).toHaveBeenCalledTimes(status === 404 ? 1 : 0);
		expect(form.submit).toHaveBeenCalledTimes(status === 404 ? 1 : 0);
	}
);
