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
