// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false, dev: false }));
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '', WEBUI_BASE_URL: '' }));
import { getLastMessageId } from '../src/lib/utils/airis/chat_history';
import { createMessagesList } from '../src/lib/utils';
import type {
	ChatHistory,
	ChatHistoryMessage,
	ChatMessageEdit
} from '../src/lib/utils/airis/chat_history';

const source = ts.createSourceFile(
	'Messages.ts',
	readFileSync('src/lib/components/chat/Messages.svelte', 'utf8')
		.split('<script lang="ts">')[1]
		.split('</script>')[0],
	ts.ScriptTarget.Latest
);
const declarations = new Map(
	source.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) =>
			statement.declarationList.declarations.map(
				(declaration) => [declaration.name.getText(source), declaration] as const
			)
		)
);
const initializer = (name: string): string => {
	const declaration = declarations.get(name);
	if (!declaration?.initializer) throw new Error(`Missing ${name}`);
	return declaration.initializer.getText(source);
};
const message = (
	id: string,
	parentId: string | null,
	childrenIds: string[] = [],
	role = 'assistant'
): ChatHistoryMessage => ({
	id,
	parentId,
	childrenIds,
	role,
	content: `Text ${id}`,
	timestamp: 1,
	model: 'test-model'
});
const graph = (): ChatHistory => ({
	messages: {
		u: message('u', null, ['a', 'b'], 'user'),
		a: message('a', 'u'),
		b: message('b', 'u', ['v']),
		v: message('v', 'b', ['c'], 'user'),
		c: message('c', 'v')
	},
	currentId: 'c'
});
const setup = (history = graph()) => {
	let frameId = 0;
	const frames = new Map<number, () => void>();
	const element = { scrollTop: 0, scrollHeight: 200, clientHeight: 100, scrollIntoView: vi.fn() };
	const context = {
		getLastMessageId,
		createMessagesList,
		history,
		structuredClone,
		pendingCopyIds: new Map<string, string>(),
		savingMessageIds: new Set<string>(),
		messages: [] as ChatHistoryMessage[],
		messagesCount: 8 as number | null,
		pendingRebuild: null as number | null,
		lastCurrentId: null as string | null,
		messagesLoading: false,
		autoScroll: false,
		messagesContainerId: 'messages-container',
		chatId: 'chat',
		selectedModels: ['test-model'],
		$temporaryChatEnabled: true,
		$settings: { scrollOnBranchChange: false },
		$i18n: { t: (text: string): string => text },
		toast: { error: vi.fn() },
		localStorage: { token: 'test-token' },
		console: { warn: vi.fn() },
		uuidv4: (): string => 'new',
		tick: vi.fn().mockResolvedValue(undefined),
		sendMessage: vi.fn(),
		refreshChatList: vi.fn().mockResolvedValue(undefined),
		updateChatById: vi.fn().mockResolvedValue(null),
		deleteChatMessageById: vi.fn().mockResolvedValue(null),
		requestAnimationFrame: (callback: () => void): number => {
			frames.set(++frameId, callback);
			return frameId;
		},
		cancelAnimationFrame: (id: number): void => {
			frames.delete(id);
		},
		setTimeout: vi.fn(),
		document: { getElementById: vi.fn(() => element) }
	};
	const names = [
		'getMessagesContainer',
		'buildMessages',
		'handleHistoryChange',
		'scrollToBottom',
		'loadMoreMessages',
		'scrollToTop',
		'updateChat',
		'gotoMessage',
		'showPreviousMessage',
		'showNextMessage',
		'rateMessage',
		'editMessage',
		'saveMessage',
		'deleteMessage'
	];
	const code =
		names.map((name) => `const ${name} = ${initializer(name)};`).join('\n') +
		`\n({${names.join(',')}})`;
	const actions = runInNewContext(
		ts.transpileModule(code, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as {
		buildMessages: () => void;
		handleHistoryChange: (id: string | null, messages: ChatHistory['messages']) => void;
		loadMoreMessages: () => Promise<void>;
		scrollToTop: () => Promise<void>;
		updateChat: () => Promise<void>;
		gotoMessage: (message: ChatHistoryMessage, index: number) => Promise<void>;
		showPreviousMessage: (message: ChatHistoryMessage) => Promise<void>;
		showNextMessage: (message: ChatHistoryMessage) => Promise<void>;
		rateMessage: (id: string, rating: number) => Promise<void>;
		editMessage: (id: string, edit: ChatMessageEdit, submit?: boolean) => Promise<boolean>;
		saveMessage: (id: string, message: ChatHistoryMessage) => Promise<void>;
		deleteMessage: (id: string) => Promise<void>;
	};
	return { context, actions, frames, element };
};

it('declares a usable empty graph and concrete message/edit contracts', () => {
	const file = resolve('tests/chat-message-list-type-probe.ts');
	const code = `import type {ChatHistory, ChatHistoryMessage} from '../src/lib/utils/airis/chat_history';
	let ${declarations.get('history')?.getText(source)};
	let ${declarations.get('messages')?.getText(source)};
	const graph: ChatHistory = history;
	const message: ChatHistoryMessage | undefined = messages[0];
	type IsAny<T> = 0 extends (1 & T) ? true : false;
	const concrete: IsAny<typeof messages[0]> = false;
	// @ts-expect-error parent IDs must be strings or null
	const wrong: ChatHistory = {messages: {}, currentId: 12};
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
		path === file
			? ts.createSourceFile(file, code, version)
			: original(path, version, onError, fresh);
	const program = ts.createProgram([file], options, host);
	expect(
		ts
			.getPreEmitDiagnostics(program)
			.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n'))
	).toEqual([]);
	const empty = runInNewContext(
		ts.transpileModule(`(${initializer('history')})`, {}).outputText
	) as ChatHistory;
	expect(empty).toEqual({ messages: {}, currentId: null });
	const { context, actions } = setup(empty);
	actions.handleHistoryChange(null, empty.messages);
	expect(context.messages).toEqual([]);
});

it('shows only the selected ancestry, pages backwards and exposes the full chain on scroll-to-top', async () => {
	const { context, actions, element } = setup();
	context.messagesCount = 2;
	actions.buildMessages();
	expect(context.messages.map((item) => item.id)).toEqual(['v', 'c']);
	await actions.loadMoreMessages();
	expect(context.messagesCount).toBe(10);
	expect(context.messages.map((item) => item.id)).toEqual(['u', 'b', 'v', 'c']);
	expect(context.messagesLoading).toBe(false);
	await actions.scrollToTop();
	expect(context.messagesCount).toBeNull();
	expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
});

it('retains the existing cycle guard and terminates when a parent is missing', () => {
	const { context, actions } = setup();
	context.history.messages.u.parentId = 'c';
	context.messagesCount = null;
	actions.buildMessages();
	expect(context.messages).toHaveLength(4);
	expect(context.console.warn).toHaveBeenCalledOnce();
	context.history.messages.u.parentId = 'missing';
	actions.buildMessages();
	expect(context.messages.map((item) => item.id)).toEqual(['u', 'b', 'v', 'c']);
});

it('rebuilds immediately for a branch change and coalesces streaming updates into one frame', () => {
	const { context, actions, frames } = setup();
	actions.handleHistoryChange('c', context.history.messages);
	expect(context.messages.at(-1)?.id).toBe('c');
	context.history.messages.c.content = 'Streamed text';
	actions.handleHistoryChange('c', context.history.messages);
	actions.handleHistoryChange('c', context.history.messages);
	expect(frames.size).toBe(1);
	for (const [id, frame] of frames) {
		frames.delete(id);
		frame();
	}
	expect(context.messages.at(-1)?.content).toBe('Streamed text');
	context.history.currentId = 'a';
	actions.handleHistoryChange('a', context.history.messages);
	expect(context.messages.map((item) => item.id)).toEqual(['u', 'a']);
	actions.handleHistoryChange(null, context.history.messages);
	expect(context.messages).toEqual([]);
});

it.each(['gotoMessage', 'showPreviousMessage', 'showNextMessage'] as const)(
	'navigates a sibling branch through %s without rewriting its messages',
	async (name) => {
		const { context, actions } = setup();
		const original = structuredClone(context.history.messages);
		if (name === 'showNextMessage') await actions[name](context.history.messages.a);
		else if (name === 'showPreviousMessage') await actions[name](context.history.messages.b);
		else await actions[name](context.history.messages.a, 99);
		expect(context.history.currentId).toBe(name === 'showPreviousMessage' ? 'a' : 'c');
		expect(context.history.messages).toEqual(original);
	}
);

it('edits a user in place and creates a new user branch with its attachments', async () => {
	const { context, actions } = setup();
	const files = [{ id: 'attachment', type: 'file', extension: 42 }];
	await actions.editMessage('v', { content: 'Edited', files }, false);
	expect(context.history.messages.v).toMatchObject({ content: 'Edited', files });
	await actions.editMessage('v', { content: 'New branch', files });
	expect(context.history.messages.b.childrenIds).toEqual(['v', 'new']);
	expect(context.history.messages.new).toMatchObject({
		parentId: 'b',
		role: 'user',
		content: 'New branch',
		files
	});
	expect(context.history.currentId).toBe('new');
	expect(context.sendMessage).toHaveBeenCalledWith(context.history, 'new');
});

it.each([false, true])(
	'edits assistant structured output with submit=%s while preserving sibling content',
	async (submit) => {
		const { context, actions } = setup();
		const output = [
			{ type: 'message', content: [{ type: 'output_text', text: 'Changed output' }] }
		];
		context.history.messages.c.output = [{ type: 'reasoning', extension: 'keep' }];
		await actions.editMessage('c', { output }, submit);
		const saved = context.history.messages[submit ? 'new' : 'c'];
		expect(saved.content).toBe('');
		expect(saved.output).toEqual(output);
		if (submit)
			expect(context.history.messages.c.output).toEqual([{ type: 'reasoning', extension: 'keep' }]);
		expect(context.sendMessage).not.toHaveBeenCalled();
	}
);

it('stores the original assistant text and preserves annotation extensions', async () => {
	const { context, actions } = setup();
	context.history.messages.c.annotation = { rating: 0, comment: 'keep' };
	await actions.editMessage('c', { content: 'Edited' }, false);
	expect(context.history.messages.c.originalContent).toBe('Text c');
	await actions.rateMessage('c', 1);
	expect(context.history.messages.c.annotation).toEqual({ rating: 1, comment: 'keep' });
});

it('relinks grandchildren when deleting a message, keeps other branches, and accepts the server graph', async () => {
	const { context, actions } = setup();
	await actions.deleteMessage('b');
	expect(Object.keys(context.history.messages)).toEqual(['u', 'a', 'c']);
	expect(context.history.messages.u.childrenIds).toEqual(['a', 'c']);
	expect(context.history.messages.c.parentId).toBe('u');
	expect(context.history.currentId).toBe('c');
	expect(context.deleteChatMessageById).not.toHaveBeenCalled();
	context.$temporaryChatEnabled = false;
	const server = { messages: { u: message('u', null, [], 'user') }, currentId: 'u' };
	context.deleteChatMessageById.mockResolvedValue({ chat: { history: server } });
	await actions.deleteMessage('c');
	expect(context.history).toEqual(server);
	expect(context.deleteChatMessageById).toHaveBeenCalledWith('test-token', 'chat', 'c');
});

it('preserves saved history on a persistence failure and skips unknown message IDs', async () => {
	const { context, actions } = setup();
	context.$temporaryChatEnabled = false;
	context.updateChatById.mockRejectedValue(new Error('Network failed'));
	await expect(actions.editMessage('c', { content: 'Unsaved draft' }, false)).rejects.toThrow(
		'Network failed'
	);
	expect(context.history.messages.c.content).toBe('Text c');
	expect(context.refreshChatList).not.toHaveBeenCalled();
	await actions.saveMessage('missing', message('missing', null));
	expect(context.history.messages.missing).toBeUndefined();
});

it('refreshes the saved content without discarding local extensions and excludes temporary chats from persistence', async () => {
	const { context, actions } = setup();
	await actions.updateChat();
	expect(context.updateChatById).not.toHaveBeenCalled();
	context.$temporaryChatEnabled = false;
	context.history.messages.c.annotation = { rating: 1, extra: 'keep' };
	context.updateChatById.mockResolvedValue({
		chat: { history: { messages: { c: { content: 'Server text' } } } }
	});
	await actions.updateChat();
	expect(context.history.messages.c.content).toBe('Server text');
	expect(context.history.messages.c.annotation).toEqual({ rating: 1, extra: 'keep' });
	expect(context.refreshChatList).toHaveBeenCalledWith('test-token');
});

it('branch navigation bounds cycles and missing links before touching persistence', async () => {
	for (const name of ['gotoMessage', 'showPreviousMessage', 'showNextMessage'] as const) {
		const { context, actions } = setup();
		context.history.messages.c.childrenIds = ['b'];
		if (name === 'showPreviousMessage') context.history.messages.u.childrenIds = ['b', 'a'];
		const before = structuredClone(context.history.messages);
		const action = actions[name];
		const message = context.history.messages.a;
		await runInNewContext('action(message, 1)', { action, message }, { timeout: 100 });
		expect(context.history.currentId).toBe('c');
		expect(context.history.messages).toEqual(before);
	}
	const { context, actions } = setup();
	delete context.history.messages.u;
	await actions.gotoMessage(context.history.messages.a, 1);
	await actions.showNextMessage(context.history.messages.a);
	expect(context.history.currentId).toBe('c');
});

it('deleting a branch terminates on a surviving cycle and preserves sibling data', async () => {
	const { context, actions } = setup();
	context.history.messages.c.childrenIds = ['v'];
	const sibling = structuredClone(context.history.messages.a);
	await runInNewContext('action("b")', { action: actions.deleteMessage }, { timeout: 100 });
	expect(context.history.messages.a).toEqual(sibling);
	expect(context.history.messages.u.childrenIds).toEqual(['a', 'c']);
	expect(context.history.messages.b).toBeUndefined();
	expect(context.history.messages.v).toBeUndefined();
	expect(context.history.currentId).toBe('c');
});
