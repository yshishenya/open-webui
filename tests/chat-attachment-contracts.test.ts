// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('retains heterogeneous attachments and rejects invalid known fields in actual component declarations', () => {
	const declarations = ['Chat', 'MessageInput'].map((component) => {
		const text = readFileSync(`src/lib/components/chat/${component}.svelte`, 'utf8');
		const script = ts.createSourceFile(
			`${component}.ts`,
			text.split('<script lang="ts">')[1].split('</script>')[0],
			ts.ScriptTarget.Latest
		);
		return script.statements
			.filter(ts.isVariableStatement)
			.flatMap((statement) => [...statement.declarationList.declarations])
			.filter((declaration) => ['files', 'chatFiles'].includes(declaration.name.getText(script)))
			.map((declaration) => `let ${declaration.getText(script)};`)
			.join('\n');
	});
	const filename = resolve('tests/chat-attachment-type-probe.ts');
	const code = `import type {ChatAttachment, ChatHistoryMessage} from '../src/lib/utils/airis/chat_history';
const items: ChatAttachment[] = [
 {type: 'image', url: 'data:image/png;base64,AA=='},
 {type: 'file', id: null, file: '', name: 'file.txt', size: 4, status: 'uploading'},
 {type: 'file', id: 'file-id', file: {id: 'file-id', data: {content: 'text'}}, url: 'file-id'},
 {type: 'text', content: 'extracted', context: 'full'},
 {type: 'text', url: 'https://example.com', collection_name: 'web', extension: 42},
 ...['chat', 'folder', 'note', 'collection'].map(type => ({type, id: type, name: type}))
];
const historyFiles: ChatHistoryMessage['files'] = items;
${declarations
	.map(
		(declaration) => `{
${declaration}
files = [];
files = items;
type IsAny<T> = 0 extends (1 & T) ? true : false;
const concrete: IsAny<typeof files[0]> = false;
// @ts-expect-error numeric IDs are invalid
files = [{id: 42}];
// @ts-expect-error sizes are numeric
files = [{size: 'large'}];
// @ts-expect-error URLs are strings or absent, never buffers
files = [{url: new ArrayBuffer(4)}];
// @ts-expect-error MIME types are strings
files = [{content_type: ['image/png']}];
}`
	)
	.join('\n')}
export {};`;
	const options: ts.CompilerOptions = {
		strict: true,
		noEmit: true,
		skipLibCheck: true,
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		types: [],
		baseUrl: resolve('.'),
		paths: { '$lib/*': ['src/lib/*'] }
	};
	const host = ts.createCompilerHost(options);
	const original = host.getSourceFile.bind(host);
	host.getSourceFile = (path, version, onError, fresh) =>
		path === filename
			? ts.createSourceFile(path, code, version)
			: original(path, version, onError, fresh);
	expect(
		ts
			.getPreEmitDiagnostics(ts.createProgram([filename], options, host))
			.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
	).toEqual([]);
});

it('reads real native text and data URL results as strings on successful FileReader load', async () => {
	const source = ts.createSourceFile(
		'utils.ts',
		readFileSync('src/lib/utils/index.ts', 'utf8'),
		ts.ScriptTarget.Latest
	);
	const declaration = source.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => [...statement.declarationList.declarations])
		.find((node) => node.name.getText(source) === 'extractContentFromFile');
	expect(declaration?.initializer && ts.isArrowFunction(declaration.initializer)).toBe(true);
	const body = (declaration?.initializer as ts.ArrowFunction).body as ts.Block;
	const readText = body.statements.find(
		(node) => ts.isFunctionDeclaration(node) && node.name?.text === 'readAsText'
	);
	expect(readText).toBeDefined();
	const reader = runInNewContext(
		ts.transpileModule(`${readText?.getText(source)}\nreadAsText;`, {}).outputText,
		{ FileReader }
	) as (file: File) => Promise<string>;
	const file = new File(['Привет, AIRIS'], 'message.txt', { type: 'text/plain' });
	await expect(reader(file)).resolves.toBe('Привет, AIRIS');
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (event) => resolve(event.target!.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
	expect(typeof dataUrl).toBe('string');
	expect(dataUrl).toMatch(/^data:text\/plain;base64,/);
});
