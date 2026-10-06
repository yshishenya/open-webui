// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import equal from 'fast-deep-equal';
import { expect, it, vi } from 'vitest';
import type { SavedChat } from '../src/lib/utils/airis/frontend-contracts';

const component = readFileSync('src/lib/components/chat/Chat.svelte', 'utf8');
const source = ts.createSourceFile(
	'chat.ts',
	component.split('<script lang="ts">')[1].split('</script>')[0],
	ts.ScriptTarget.Latest
);
function assignment(name: string, contains: string): string {
	const matches: string[] = [];
	function visit(node: ts.Node): void {
		if (
			ts.isBinaryExpression(node) &&
			node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
			node.left.getText(source) === name &&
			node.right.getText(source).includes(contains)
		)
			matches.push(node.right.getText(source));
		ts.forEachChild(node, visit);
	}
	visit(source);
	if (matches.length !== 1)
		throw new Error(`Expected one ${name} consumer, found ${matches.length}`);
	return matches[0];
}
function initializer(file: ts.SourceFile, name: string): string {
	for (const statement of file.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const item = statement.declarationList.declarations.find(
			(node) => node.name.getText(file) === name
		);
		if (item?.initializer) return item.initializer.getText(file);
	}
	throw new Error(`Missing ${name}`);
}
function run<T>(code: string, context: object): T {
	return runInNewContext(
		ts.transpileModule(code, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as T;
}
const record = (): SavedChat => ({
	id: 'chat',
	user_id: 'owner',
	title: 'Saved',
	created_at: 1,
	updated_at: 2,
	archived: false,
	variables: { audience: 'reader' },
	chat: {
		title: 'Saved',
		models: ['model', 'model'],
		messages: [],
		history: { messages: {}, currentId: null },
		params: { temperature: 0.3, system: 'Instruction' },
		files: [{ id: 'file' }]
	}
});

it('preserves the stored-owner read-only boundary, including null state', () => {
	const code = assignment('readOnly', 'chat.user_id');
	expect(run(code, { chat: record(), $user: { id: 'owner' } })).toBe(false);
	expect(run(code, { chat: record(), $user: { id: 'reader' } })).toBe(true);
	expect(run(code, { chat: record(), $user: null })).toBe(true);
	expect(run(code, { chat: null, $user: { id: 'owner' } })).toBe(false);
});

it('loads modern and legacy history while preserving duplicate model slots and saved controls', () => {
	const utility = ts.createSourceFile(
		'utils.ts',
		readFileSync('src/lib/utils/index.ts', 'utf8'),
		ts.ScriptTarget.Latest
	);
	const convert = run<(messages: object[]) => object>(
		`(${initializer(utility, 'convertMessagesToHistory')})`,
		{
			uuidv4: () => 'generated'
		}
	);
	const saved = record();
	const context = {
		chat: saved,
		chatContent: saved.chat,
		structuredClone,
		convertMessagesToHistory: convert
	};
	expect(run(assignment('selectedModels', 'chatContent.models'), context)).toEqual([
		'model',
		'model'
	]);
	expect(run(assignment('history', 'chatContent.history'), context)).toEqual(saved.chat.history);
	expect(run(assignment('chatVariables', 'chat?.variables'), context)).toEqual(saved.variables);
	expect(run(assignment('params', 'chatContent?.params'), context)).toEqual(saved.chat.params);
	expect(run(assignment('chatFiles', 'chatContent?.files'), context)).toEqual(saved.chat.files);
	for (const absent of [undefined, null]) {
		context.chatContent = {
			title: 'Legacy',
			models: absent,
			history: absent,
			messages: [
				{ id: 'one', parentId: null, childrenIds: [], role: 'user', content: 'Question' },
				{ id: 'two', parentId: null, childrenIds: [], role: 'assistant', content: 'Answer' }
			]
		};
		expect(run(assignment('selectedModels', 'chatContent.models'), context)).toEqual(['']);
		expect(
			run<{ currentId: string; messages: Record<string, { childrenIds: string[] }> }>(
				assignment('history', 'chatContent.history'),
				context
			)
		).toMatchObject({
			currentId: 'two',
			messages: { one: { childrenIds: ['two'] }, two: { childrenIds: [] } }
		});
		expect(run(assignment('params', 'chatContent?.params'), context)).toEqual({});
		expect(run(assignment('chatFiles', 'chatContent?.files'), context)).toEqual([]);
	}
});

it('updates the actual autosave baseline once, keeps it on failure and excludes temporary chats', async () => {
	const context = {
		$chatId: 'chat',
		$temporaryChatEnabled: false,
		chat: record(),
		params: { temperature: 0.8 },
		chatFiles: [{ id: 'next' }],
		equal,
		localStorage: { token: 'test' },
		console: { error: vi.fn() },
		updateChatById: vi.fn().mockImplementation(async () => ({
			...record(),
			chat: {
				...record().chat,
				params: context.params,
				files: context.chatFiles
			}
		}))
	};
	const save = run<() => Promise<void>>(`(${initializer(source, 'saveControls')})`, context);
	await save();
	await save();
	expect(context.updateChatById).toHaveBeenCalledTimes(1);
	const baseline = context.chat;
	context.params = { temperature: 0.9 };
	context.updateChatById.mockRejectedValueOnce(new Error('offline'));
	await save();
	expect(context.chat).toEqual(baseline);
	await save();
	expect(context.updateChatById).toHaveBeenCalledTimes(3);
	context.$temporaryChatEnabled = true;
	context.params = { temperature: 0.1 };
	await save();
	expect(context.updateChatById).toHaveBeenCalledTimes(3);
});
