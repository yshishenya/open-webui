// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { getLastMessageId } from '../src/lib/utils/airis/chat_history';
import type { ChatHistory, ChatHistoryMessage } from '../src/lib/utils/airis/chat_history';

const initializer = (file: string, name: string): string => {
	const raw = readFileSync(file, 'utf8');
	const code = file.endsWith('.svelte')
		? raw.split('<script lang="ts">')[1].split('</script>')[0]
		: raw;
	const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest);
	const declaration = source.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => statement.declarationList.declarations)
		.find((item) => item.name.getText(source) === name);
	if (!declaration?.initializer) throw new Error(`Missing ${file}:${name}`);
	return declaration.initializer.getText(source);
};
const parentWalk = ts.transpileModule(
	`const createMessagesList = ${initializer('src/lib/utils/index.ts', 'createMessagesList')}; createMessagesList(history, start)`,
	{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText;
const node = (
	id: string,
	parentId: string | null,
	childrenIds: string[] = []
): ChatHistoryMessage => ({
	id,
	parentId,
	childrenIds,
	role: 'assistant',
	content: id
});
const graph = (): ChatHistory => ({
	messages: {
		u: node('u', null, ['a', 'b']),
		a: node('a', 'u'),
		b: node('b', 'u', ['v']),
		v: node('v', 'b')
	},
	currentId: 'v'
});

it('bounds actual parent traversal while retaining order, identity and missing-link behavior', () => {
	for (const [start, links, expected] of [
		['v', {}, ['u', 'b', 'v']],
		['a', { a: 'a' }, ['a']],
		['a', { a: 'b', b: 'a' }, ['b', 'a']],
		['v', { b: 'missing' }, ['b', 'v']],
		['missing', {}, []],
		[null, {}, []]
	] as const) {
		const history = graph();
		for (const [id, parent] of Object.entries(links)) history.messages[id].parentId = parent;
		const before = structuredClone(history);
		const result = runInNewContext(
			parentWalk,
			{ history, start },
			{ timeout: 100 }
		) as ChatHistoryMessage[];
		expect(result.map((message) => message.id)).toEqual(expected);
		for (const message of result) expect(message).toBe(history.messages[message.id]);
		expect(history).toEqual(before);
	}
});

it('bounds actual last-child traversal and preserves last-root and last-existing-node selection', () => {
	for (const [start, links, expected] of [
		['u', {}, 'v'],
		[null, {}, 'v'],
		['a', { a: ['a'] }, 'a'],
		['a', { a: ['b'], b: ['a'] }, 'b'],
		['u', { b: ['missing'] }, 'b'],
		['missing', {}, null],
		[undefined, {}, null]
	] as const) {
		const history = graph();
		for (const [id, children] of Object.entries(links))
			history.messages[id].childrenIds = [...children];
		const before = structuredClone(history);
		expect(
			runInNewContext(
				'getLastMessageId(history, start)',
				{ getLastMessageId, history, start },
				{ timeout: 100 }
			)
		).toBe(expected);
		expect(history).toEqual(before);
	}
	const history = graph();
	history.messages.last = node('last', null);
	expect(getLastMessageId(history, null)).toBe('last');
	expect(getLastMessageId({ messages: {} }, null)).toBeNull();
});

it('all real multi-model navigation handlers terminate and keep neighboring branches', async () => {
	const file = 'src/lib/components/chat/Messages/MultiResponseMessages.svelte';
	for (const [name, args] of [
		['gotoMessage', [0, 1]],
		['showPreviousMessage', [0]],
		['showNextMessage', [0]],
		['onGroupClick', ['b', 0]]
	] as const) {
		const history = graph();
		history.messages.v.childrenIds = ['b'];
		const before = structuredClone(history.messages);
		const updateChat = vi.fn();
		const context = {
			history,
			getLastMessageId,
			messageId: 'a',
			groupedMessageIds: { 0: { messageIds: ['a', 'b'] } },
			groupedMessageIdsIdx: { 0: name === 'showPreviousMessage' ? 2 : 0 },
			selectedModelIdx: 0,
			tick: vi.fn(),
			updateChat,
			triggerScroll: vi.fn(),
			console: { log: vi.fn() },
			args
		};
		const code = ts.transpileModule(`const action = ${initializer(file, name)}; action(...args)`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText;
		await runInNewContext(code, context, { timeout: 100 });
		expect(history.currentId).toBe('v');
		expect(history.messages).toEqual(before);
		expect(updateChat).toHaveBeenCalledTimes(name === 'onGroupClick' ? 0 : 1);
	}
});

it('the real Chat showMessage handler terminates for cyclic, missing and root selections', async () => {
	const file = 'src/lib/components/chat/Chat.svelte';
	for (const [id, expected] of [
		['b', 'v'],
		['missing', null],
		[null, 'v']
	] as const) {
		const history = graph();
		history.messages.v.childrenIds = ['b'];
		const before = structuredClone(history.messages);
		const context = {
			history,
			getLastMessageId,
			$chatId: 'chat',
			$settings: {},
			tick: vi.fn(),
			message: { id }
		};
		const code = ts.transpileModule(
			`const action = ${initializer(file, 'showMessage')}; action(message, false, false)`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText;
		await runInNewContext(code, context, { timeout: 100 });
		expect(history.currentId).toBe(expected);
		expect(history.messages).toEqual(before);
	}
});

it('preserves concrete inferred message metadata and rejects invalid graph IDs', () => {
	const filename = resolve('tests/history-cycle-type-probe.ts');
	const code = `import type {ChatHistoryMessage} from '../src/lib/utils/airis/chat_history';
${readFileSync('src/lib/utils/index.ts', 'utf8').split('type MessageList<')[1].split('export const createMessagesList')[0].replace(/^/, 'type MessageList<')}
const createMessagesList = ${initializer('src/lib/utils/index.ts', 'createMessagesList')};
const history = {messages: {a: {id: 'a', parentId: null, childrenIds: [] as string[], role: 'user', score: 42}}};
const list = createMessagesList(history, 'a');
const score: number = list[0].score;
type IsAny<T> = 0 extends (1 & T) ? true : false;
const concrete: IsAny<typeof list[0]> = false;
const empty = createMessagesList({messages: {}}, null);
const role: string = empty[0].role;
// @ts-expect-error custom metadata retains its number type
const wrong: string = list[0].score;
// @ts-expect-error starting message IDs cannot be numbers
createMessagesList(history, 42);
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
