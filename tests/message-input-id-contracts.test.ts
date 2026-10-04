// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it } from 'vitest';

const component = readFileSync('src/lib/components/chat/MessageInput.svelte', 'utf8');
const script = component.split('<script lang="ts">')[1].split('</script>')[0];
const source = ts.createSourceFile('MessageInput.ts', script, ts.ScriptTarget.Latest);
const names = [
	'selectedModels',
	'taskIds',
	'selectedToolIds',
	'selectedSkillIds',
	'selectedFilterIds'
];
const declarations = source.statements
	.filter(ts.isVariableStatement)
	.flatMap((statement) => Array.from(statement.declarationList.declarations))
	.filter((declaration) => names.includes(declaration.name.getText(source)));

const diagnostics = (fixture: string): string[] => {
	const filename = resolve('message-input-id-probe.ts');
	const code = declarations.map((d) => `let ${d.getText(source)};`).join('\n') + fixture;
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

it('accepts actual empty and multiple string IDs and rejects numbers in all five lists', () => {
	expect(declarations).toHaveLength(5);
	expect(
		diagnostics(
			names.map((name) => `${name} = []; ${name} = ['id-a', 'id-b'];`).join('\n') +
				'\ntaskIds = null;'
		)
	).toEqual([]);
	expect(diagnostics(names.map((name) => `${name} = [42];`).join('\n'))).toHaveLength(5);
});

it('emits identical complete Svelte client and server code after correcting the ID annotations', () => {
	let previous = component.replace('selectedModels: string[];', "selectedModels: [''];");
	previous = previous.replace('taskIds: string[] | null = null;', 'taskIds = null;');
	for (const name of names.slice(2)) {
		previous = previous.replace(`${name}: string[] = [];`, `${name} = [];`);
	}
	for (const generate of ['client', 'server'] as const) {
		const options = { filename: 'MessageInput.svelte', generate, dev: false };
		expect(compile(component, options).js.code).toBe(compile(previous, options).js.code);
	}
});
