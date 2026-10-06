import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { expect, it } from 'vitest';

it.each([
	['src/lib/apis/index.ts', 'generateMoACompletion'],
	['src/lib/apis/ollama/index.ts', 'generateChatCompletion'],
	['src/lib/apis/ollama/index.ts', 'pullModel'],
	['src/lib/apis/openai/index.ts', 'chatCompletion'],
	['src/lib/apis/chats/index.ts', 'downloadChatStats']
])('%s %s keeps response and cancellation positions distinct', async (path, name) => {
	const source = await readFile(path, 'utf8');
	const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
	const statement = parsed.statements.find(
		(node) =>
			ts.isVariableStatement(node) &&
			node.declarationList.declarations.some(
				(declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name
			)
	);
	if (!statement) throw new Error(`Missing API helper ${name}`);
	const filename = '/stream-contract.ts';
	const contract = `
declare const WEBUI_BASE_URL: string;
declare const WEBUI_API_BASE_URL: string;
declare const OLLAMA_API_BASE_URL: string;
${statement.getText(parsed)}
declare const result: Awaited<ReturnType<typeof ${name}>>;
const pair: [Response | null, AbortController] = result;
if (pair[0]?.body) pair[0].body.getReader();
pair[1].abort();
`;
	const options: ts.CompilerOptions = {
		target: ts.ScriptTarget.ES2022,
		strict: true,
		noEmit: true,
		types: [],
		skipLibCheck: true
	};
	const host = ts.createCompilerHost(options);
	const getSourceFile = host.getSourceFile.bind(host);
	host.getSourceFile = (file, ...args) =>
		file === filename
			? ts.createSourceFile(file, contract, ts.ScriptTarget.Latest, true)
			: getSourceFile(file, ...args);
	const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
	expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
});
