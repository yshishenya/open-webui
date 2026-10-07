// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import type { ChatHistory } from '../src/lib/utils/airis/chat_history';

const path = 'src/lib/components/chat/Chat.svelte';
const file = readFileSync(path, 'utf8');
const script = file.slice(file.indexOf('>') + 1, file.indexOf('</script>'));
const source = ts.createSourceFile(path, script, ts.ScriptTarget.Latest, true);
const replacements: ts.CallExpression[] = [];
const visit = (node: ts.Node): void => {
	if (
		ts.isCallExpression(node) &&
		node.expression.getText(source) === 'window.history.replaceState'
	)
		replacements.push(node);
	ts.forEachChild(node, visit);
};
visit(source);
const initializer = (name: string): string => {
	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const declaration = statement.declarationList.declarations.find(
			(item) => item.name.getText(source) === name
		);
		if (declaration?.initializer) return declaration.initializer.getText(source);
	}
	throw new Error(`Missing ${name}`);
};
const evaluate = <T>(code: string, context: object): T =>
	runInNewContext(
		ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
		context
	) as T;
const messageHistory = (): ChatHistory => ({
	messages: {
		user: { id: 'user', role: 'user', content: 'draft', parentId: null, childrenIds: [] }
	},
	currentId: 'user'
});
const states = [
	{ __sveltekit_index: 7, __sveltekit_states: { selected: 'draft' }, scroll: { x: 0, y: 90 } },
	null,
	0,
	'entry-state'
];

it.each(replacements.flatMap((call, index) => states.map((state) => ({ call, index, state }))))(
	'preserves native browser entry state on URL replacement $index with $state',
	({ call, index, state }) => {
		expect(replacements).toHaveLength(3);
		window.history.replaceState(state, '', '/before');
		evaluate<void>(call.getText(source), {
			window,
			history: messageHistory(),
			res: { chat_id: 'server-created' },
			_chatId: 'explicit-created'
		});
		expect(window.history.state).toEqual(state);
		expect(window.location.pathname).toBe(['/', '/c/server-created', '/c/explicit-created'][index]);
	}
);

it.each(['normal', 'embedded', 'temporary'])(
	'keeps navigation state and creation payload in %s mode',
	async (mode) => {
		const state = states[0];
		window.history.replaceState(state, '', '/before');
		const history = messageHistory();
		const replace = vi.spyOn(window.history, 'replaceState');
		const context = {
			window,
			$chatId: 'draft-chat',
			$selectedFolder: { id: 'folder' },
			$temporaryChatEnabled: mode === 'temporary',
			embedded: mode === 'embedded',
			chat: { id: 'prior' },
			localStorage: { token: 'test' },
			$i18n: { t: (text: string): string => text },
			selectedModels: ['luna'],
			$settings: { system: 'system prompt' },
			params: { temperature: 0.4 },
			chatVariables: { topic: 'draft' },
			$socket: { id: 'test-socket' },
			createMessagesList: vi.fn().mockReturnValue(Object.values(history.messages)),
			createNewChat: vi.fn().mockResolvedValue({ id: 'explicit-created' }),
			createTemporaryChatId: vi.fn().mockReturnValue('temporary-created'),
			chatId: { set: vi.fn() },
			selectedFolder: { set: vi.fn() },
			refreshChatList: vi.fn().mockResolvedValue(undefined),
			refreshFolderChatLists: vi.fn().mockResolvedValue(undefined),
			tick: async (): Promise<void> => {}
		};
		const init = evaluate<(history: ChatHistory) => Promise<string>>(
			`(${initializer('initChatHandler')})`,
			context
		);
		try {
			expect(await init(history)).toBe(
				mode === 'temporary' ? 'temporary-created' : 'explicit-created'
			);
			expect(window.history.state).toEqual(state);
			expect(replace).toHaveBeenCalledTimes(mode === 'normal' ? 1 : 0);
			if (mode === 'temporary') {
				expect(context.createNewChat).not.toHaveBeenCalled();
			} else {
				expect(context.createNewChat).toHaveBeenCalledWith(
					'test',
					expect.objectContaining({
						id: 'draft-chat',
						models: ['luna'],
						system: 'system prompt',
						params: context.params,
						history,
						messages: Object.values(history.messages),
						tags: []
					}),
					'folder',
					context.chatVariables
				);
			}
		} finally {
			replace.mockRestore();
		}
	}
);

const resetGuard = replacements[0].parent.parent.parent;
if (!ts.isIfStatement(resetGuard)) throw new Error('Missing new-chat reset guard');
it.each([
	{ native: '/c/created', routed: '/', embedded: false, expected: true },
	{ native: '/', routed: '/c/stale', embedded: false, expected: false },
	{ native: '/c/created', routed: '/', embedded: true, expected: false }
])('uses current browser URL to reset $native with routed $routed', (entry) => {
	window.history.replaceState(states[0], '', entry.native);
	expect(
		evaluate<boolean>(resetGuard.expression.getText(source), {
			window,
			$page: { url: new URL(entry.routed, 'http://localhost') },
			embedded: entry.embedded
		})
	).toBe(entry.expected);
});
