// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';

const source = ts.createSourceFile(
	'src/lib/utils/index.ts',
	readFileSync('src/lib/utils/index.ts', 'utf8'),
	ts.ScriptTarget.Latest
);
const declarations = new Map(
	source.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) =>
			statement.declarationList.declarations.map(
				(declaration) => [declaration.name.getText(source), declaration.getText(source)] as const
			)
		)
);
const nodeType = source.statements.find(
	(statement) =>
		ts.isTypeAliasDeclaration(statement) && statement.name.text === 'RepairableHistoryMessage'
);
const helpers = `const uuidv4 = (): string => 'generated';
${nodeType?.getText(source) ?? ''}
const ${declarations.get('convertMessagesToHistory')};
const ${declarations.get('sanitizeHistory')};`;
const runtime = runInNewContext(
	ts.transpileModule(`${helpers}\n({convertMessagesToHistory, sanitizeHistory})`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText
) as {
	convertMessagesToHistory: (
		messages: {
			id?: string;
			parentId?: string | null;
			role: string;
			content: string;
			score?: number;
		}[]
	) => {
		messages: Record<
			string,
			{ id: string; parentId: string | null; childrenIds: string[]; score?: number }
		>;
		currentId: string | null;
	};
	sanitizeHistory: (history: unknown) => void;
};

it('preserves branches, generated IDs, empty history and custom message fields', () => {
	const history = runtime.convertMessagesToHistory([
		{ id: 'u', role: 'user', content: 'question' },
		{ id: 'a', role: 'assistant', content: 'answer', score: 42 },
		{ parentId: 'u', role: 'assistant', content: 'alternative' }
	]);
	expect(history.currentId).toBe('generated');
	expect(history.messages.u.childrenIds).toEqual(['a', 'generated']);
	expect(history.messages.a.score).toBe(42);
	expect(history.messages.generated.parentId).toBe('u');
	expect(runtime.convertMessagesToHistory([])).toEqual({ messages: {}, currentId: null });
});

it('repairs a lost assistant placeholder, removes invalid nodes and retains completion data', () => {
	const history = {
		messages: {
			u: { id: 'wrong', role: 'user', parentId: null, childrenIds: ['a', 'missing'], timestamp: 1 },
			a: { content: 'saved answer', done: true, timestamp: 2 },
			invalid: null,
			primitive: 'broken'
		},
		currentId: 'missing'
	};
	runtime.sanitizeHistory(history);
	expect(history).toEqual({
		messages: {
			u: { id: 'u', role: 'user', parentId: null, childrenIds: ['a'], timestamp: 1 },
			a: {
				id: 'a',
				role: 'assistant',
				parentId: 'u',
				childrenIds: [],
				content: 'saved answer',
				done: true,
				timestamp: 2
			}
		},
		currentId: 'a'
	});
});

it('accepts null or missing history and preserves a valid selected branch', () => {
	for (const value of [null, undefined, {}])
		expect(() => runtime.sanitizeHistory(value)).not.toThrow();
	const history = runtime.convertMessagesToHistory([
		{ id: 'u', role: 'user', content: 'question' }
	]);
	runtime.sanitizeHistory(history);
	expect(history.currentId).toBe('u');
});

it('declares a concrete graph and retains inferred custom metadata', () => {
	const filename = resolve('tests/history-contract-probe.ts');
	const code = `${helpers}
const graph = convertMessagesToHistory([{role: 'user', content: 'question', score: 42}]);
const score: number = graph.messages['generated'].score;
const children: string[] = graph.messages['generated'].childrenIds;
const current: string | null = graph.currentId;
sanitizeHistory(graph);
type IsAny<T> = 0 extends (1 & T) ? true : false;
const typed: IsAny<typeof graph.messages['generated']> = false;
// @ts-expect-error graph IDs are strings, not numbers
convertMessagesToHistory([{id: 42}]);
// @ts-expect-error custom metadata retains its number type
const incorrect: string = graph.messages['generated'].score;
export {};`;
	const options: ts.CompilerOptions = {
		strict: true,
		noEmit: true,
		target: ts.ScriptTarget.ES2022,
		types: []
	};
	const host = ts.createCompilerHost(options);
	const original = host.getSourceFile.bind(host);
	host.getSourceFile = (path, version, onError, shouldCreateNewSourceFile) =>
		path === filename
			? ts.createSourceFile(path, code, version)
			: original(path, version, onError, shouldCreateNewSourceFile);
	const program = ts.createProgram([filename], options, host);
	expect(
		ts
			.getPreEmitDiagnostics(program)
			.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
	).toEqual([]);
});

it('types the actual Chat history declaration and streamed metadata without erasing optional fields', () => {
	const chat = readFileSync('src/lib/components/chat/Chat.svelte', 'utf8');
	const script = ts.createSourceFile(
		'Chat.ts',
		chat.split('<script lang="ts">')[1].split('</script>')[0],
		ts.ScriptTarget.Latest
	);
	const history = script.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => [...statement.declarationList.declarations])
		.find((declaration) => declaration.name.getText(script) === 'history');
	expect(history).toBeDefined();
	const filename = resolve('tests/chat-history-type-probe.ts');
	const code = `import type {ChatHistory, ChatHistoryMessage} from '../src/lib/utils/airis/chat_history';
let ${history?.getText(script)};
history.currentId = 'a';
history.currentId = null;
history.messages.a = {id: 'a', parentId: 'u', childrenIds: [], role: 'assistant',
 model: 'model', modelName: 'Model', modelIdx: 0, operation_id: 'operation', done: false,
 statusHistory: [{action: 'knowledge_search', extension: 42}],
 code_executions: [{id: 'execution', result: {output: 'ok'}}],
 embeds: ['<p>Result</p>'], followUps: ['Next?'], favorite: true};
history.messages.a.childrenIds.push('b');
const graph: ChatHistory = history;
const content: string | undefined = graph.messages.a.content;
const parent: string | null = graph.messages.a.parentId;
type IsAny<T> = 0 extends (1 & T) ? true : false;
const concrete: IsAny<typeof history.messages.a> = false;
// @ts-expect-error current message IDs cannot be numeric
history.currentId = 42;
// @ts-expect-error branch children must be string IDs
history.messages.a.childrenIds.push(42);
// @ts-expect-error streaming status actions retain their string type
history.messages.a.statusHistory = [{action: 42}];
// @ts-expect-error follow-up suggestions are strings
history.messages.a.followUps = [42];
// @ts-expect-error repaired graph nodes require their canonical ID
history.messages.b = {role: 'user', parentId: null, childrenIds: []};
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
