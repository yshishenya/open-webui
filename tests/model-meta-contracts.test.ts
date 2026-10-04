// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const api = readFileSync('src/lib/apis/index.ts', 'utf8');
const constants = readFileSync('src/lib/constants.ts', 'utf8');
const source = ts.createSourceFile('api.ts', api, ts.ScriptTarget.Latest);
const meta = source.statements.find(
	(statement): statement is ts.InterfaceDeclaration =>
		ts.isInterfaceDeclaration(statement) && statement.name.text === 'ModelMeta'
);
if (!meta) throw new Error('ModelMeta declaration missing');
const defaultsSource = ts.createSourceFile('constants.ts', constants, ts.ScriptTarget.Latest);
const defaults = defaultsSource.statements
	.filter(ts.isVariableStatement)
	.find((statement) =>
		statement.declarationList.declarations.some(
			(declaration) => declaration.name.getText(defaultsSource) === 'DEFAULT_CAPABILITIES'
		)
	);
if (!defaults) throw new Error('Capability defaults missing');

const diagnostics = (fixture: string): string[] => {
	const filename = resolve('model-meta-probe.ts');
	const code = `${defaults.getText(defaultsSource)}\n${meta.getText(source)}\n${fixture}`;
	const options: ts.CompilerOptions = {
		strict: true,
		noEmit: true,
		skipLibCheck: true,
		target: ts.ScriptTarget.ES2022,
		types: []
	};
	const host = ts.createCompilerHost(options);
	const original = host.getSourceFile.bind(host);
	host.getSourceFile = (path, version, onError, fresh) =>
		path === filename
			? ts.createSourceFile(path, code, version)
			: original(path, version, onError, fresh);
	return ts
		.getPreEmitDiagnostics(ts.createProgram([filename], options, host))
		.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
};

it('describes real tool IDs, optional flags and backend variable fields without losing extra values', () => {
	expect(
		diagnostics(`
const empty: ModelMeta = {};
const meta: ModelMeta = {
 toolIds: ['tool-a', 'tool-b'],
 capabilities: {usage: false, vision: true, extension: {version: 1}},
 chat_variables_schema: {fields: [{key: 'topic', type: 'text', required: true, default: false}]}
};
const toolId: string | undefined = meta.toolIds?.[0];
const usage: boolean | undefined = meta.capabilities?.usage;
const custom: unknown = meta.capabilities?.extension;
const key: string | undefined = meta.chat_variables_schema?.fields[0]?.key;
const defaultValue: unknown = meta.chat_variables_schema?.fields[0]?.default;
const cleared: ModelMeta = {toolIds: null, capabilities: null, chat_variables_schema: null};
`)
	).toEqual([]);
	expect(diagnostics('const invalid: ModelMeta = {toolIds: [1]};')).toHaveLength(1);
	expect(diagnostics('const invalid: ModelMeta = {capabilities: {usage: "false"}};')).toHaveLength(
		1
	);
});

it('erases the metadata correction without changing any API runtime code', () => {
	const previous = api.replace(', type DEFAULT_CAPABILITIES', '').replace(
		meta.getText(source),
		`export interface ModelMeta {
 toolIds: never[];
 description?: string;
 capabilities?: object;
 profile_image_url?: string;
 lead_magnet?: boolean;
}`
	);
	const options = {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
	};
	expect(ts.transpileModule(api, options).outputText).toBe(
		ts.transpileModule(previous, options).outputText
	);
});
