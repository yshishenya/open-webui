// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import equal from 'fast-deep-equal';
import { createMessagesList } from '../index';
import { expect, it, vi } from 'vitest';
import type {
	ChatHistory,
	ChatHistoryMessage,
	ChatMessageEdit,
	ChatAttachment
} from './chat_history';
vi.mock('$app/environment', () => ({ browser: false, dev: false }));
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '', WEBUI_BASE_URL: '' }));

function handler<T>(component: string, name: string, context: object): T {
	const path = `${process.env.AIRIS_COMPONENT_ROOT ?? 'src/lib/components/chat'}/${component}.svelte`;
	const source = readFileSync(path, 'utf8'),
		instance = parse(source).instance;
	if (!instance) throw new Error('Missing script');
	const script = ts.createSourceFile(
		path,
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const declaration = script.statements
		.filter(ts.isVariableStatement)
		.flatMap((s) => [...s.declarationList.declarations])
		.find((d) => d.name.getText(script) === name);
	if (!declaration?.initializer) throw new Error(`Missing ${name}`);
	return runInNewContext(
		ts.transpileModule(`(${declaration.initializer.getText(script)})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as T;
}
function deferred<T>() {
	let resolve!: (value: T) => void, reject!: (error: Error) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	void promise.catch(() => {});
	return { promise, resolve, reject };
}

const same = (a: unknown, b: unknown): boolean => equal(structuredClone(a), structuredClone(b));
function setup() {
	const history: ChatHistory = {
		messages: {
			u: { id: 'u', parentId: null, childrenIds: ['a'], role: 'user', content: 'original' },
			a: {
				id: 'a',
				parentId: 'u',
				childrenIds: [],
				role: 'assistant',
				content: 'answer',
				done: true
			}
		},
		currentId: 'a'
	};
	let counter = 0;
	const c = {
		history,
		$chatId: 'chat1',
		chatId: 'chat1',
		sourceHistory: history,
		$models: [{ id: 'model', name: 'Model', info: {} }],
		selectedModels: ['model'],
		atSelectedModel: undefined,
		autoScroll: false,
		scrollToBottom: vi.fn(),
		shouldAutoScrollResponse: () => false,
		$settings: {},
		params: {},
		$temporaryChatEnabled: false,
		embedded: false,
		onCreateEmbeddedChat: undefined,
		tick: vi.fn().mockResolvedValue(undefined),
		uuidv4: () => `id${++counter}`,
		structuredClone,
		equal: same,
		$i18n: { t: (s: string) => s },
		toast: { error: vi.fn(), warning: vi.fn() },
		console: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
		getChatEventEmitter: vi.fn().mockResolvedValue(123),
		clearInterval: vi.fn(),
		createMessagesList,
		sendMessageSocket: vi.fn().mockResolvedValue(false),
		imageGenerationEnabled: false,
		chatFiles: [] as ChatAttachment[],
		$showCallOverlay: false,
		document: { getElementById: () => null },
		saveSessionSelectedModels: vi.fn(),
		sendMessage: vi.fn().mockResolvedValue(false),
		submittingPrompt: false,
		pendingPrompt: null,
		pendingSendIds: new Map(),
		savingMessageIds: new Set(),
		pendingCopyIds: new Map(),
		prompt: 'draft',
		files: [{ id: 'f', type: 'file' }] as ChatAttachment[],
		messageInput: { setText: vi.fn().mockResolvedValue(true) },
		pendingOAuthTools: [],
		selectedModelIds: ['model'],
		chatVariables: {},
		getChatVariablesForm: () => ({ conflicts: [], missing: false, empty: false }),
		$config: {},
		webSearchActive: false,
		webSearchConfirmed: false,
		stopResponse: vi.fn().mockResolvedValue(undefined),
		$chatRequestQueues: {} as Record<
			string,
			{ id: string; prompt: string; files: ChatAttachment[] }[]
		>,
		chatRequestQueues: { update: vi.fn() },
		processingQueueChats: new Set<string>(),
		failedQueueChats: new Set<string>(),
		submitPrompt: vi.fn().mockResolvedValue(false),
		eventTarget: { dispatchEvent: vi.fn() },
		CustomEvent: class {},
		selectedToolIds: [],
		selectedSkillIds: [],
		selectedFilterIds: [],
		$selectedTerminalId: null,
		$toolServers: [],
		$terminalServers: [],
		getFeatures: () => ({}),
		getStopTokens: () => undefined,
		getPromptVariables: () => ({}),
		$user: { name: 'Fixture' },
		$socket: { id: 'socket' },
		$selectedFolder: null,
		localStorage: { token: 'fixture' },
		isTemporaryChatId: () => false,
		WEBUI_BASE_URL: '',
		shouldIncludeUsage: () => false,
		generateOpenAIChatCompletion: vi
			.fn()
			.mockResolvedValue({ status: true, task_ids: ['task'], chat_id: 'chat1' }),
		parseBillingBlockedDetail: vi.fn().mockReturnValue(null),
		billingBlockedDetail: null,
		billingBlockedOpen: false,
		handleOpenAIError: vi.fn().mockResolvedValue(undefined),
		trackEvent: vi.fn(),
		taskIds: null as string[] | null,
		refreshChatList: vi.fn().mockResolvedValue(undefined),
		updateChatById: vi.fn().mockResolvedValue({}),
		window: { history: { replaceState: vi.fn(), state: {} } }
	};
	Object.assign(c.chatRequestQueues, {
		update: vi.fn((fn: (q: typeof c.$chatRequestQueues) => typeof c.$chatRequestQueues) => {
			c.$chatRequestQueues = fn(c.$chatRequestQueues);
		})
	});
	return c;
}
it.each([{ ids: [] }, { ids: ['missing'] }, { ids: ['model', 'missing'] }])(
	'invalid selection %j never dispatches or inserts placeholders',
	async ({ ids }) => {
		const c = setup();
		c.selectedModels = ids;
		const before = structuredClone(c.history);
		const send = handler<(h: ChatHistory, id: string) => Promise<boolean>>(
			'Chat',
			'sendMessage',
			c
		);
		expect(await send(c.history, 'u')).toBe(false);
		expect(c.history).toEqual(before);
		expect(c.sendMessageSocket).not.toHaveBeenCalled();
	}
);
it.each([false, true])('send propagates accepted=%s and clears emitter', async (accepted) => {
	const c = setup();
	c.sendMessageSocket.mockResolvedValue(accepted);
	expect(
		await handler<(h: ChatHistory, id: string) => Promise<boolean>>(
			'Chat',
			'sendMessage',
			c
		)(c.history, 'u')
	).toBe(accepted);
	expect(c.clearInterval).toHaveBeenCalledWith(123);
	if (!accepted)
		expect(
			Object.values(c.history.messages)
				.filter((m) => m.role === 'assistant')
				.every((m) => m.done)
		).toBe(true);
});
it('user edit propagates rejection and reuses local user branch on unchanged retry', async () => {
	const c = setup();
	const edit = handler<(id: string, value: ChatMessageEdit, submit: boolean) => Promise<boolean>>(
		'Messages',
		'editMessage',
		c
	);
	expect(await edit('u', { content: 'edited', files: [] }, true)).toBe(false);
	const first = c.sendMessage.mock.calls[0][1];
	c.sendMessage.mockResolvedValue(true);
	expect(await edit('u', { content: 'edited', files: [] }, true)).toBe(true);
	expect(c.sendMessage.mock.calls[1][1]).toBe(first);
	expect(Object.values(c.history.messages).filter((m) => m.role === 'user')).toHaveLength(2);
});
it('submitPrompt reports rejection, reuses same draft and blocks concurrent submission', async () => {
	const c = setup();
	const pending = deferred<boolean>();
	c.sendMessage.mockReturnValueOnce(pending.promise);
	const submit = handler<(text: string, files: ChatAttachment[]) => Promise<boolean>>(
		'Chat',
		'submitPrompt',
		c
	);
	const first = submit('draft', c.files);
	await Promise.resolve();
	expect(await submit('draft', c.files)).toBe(false);
	expect(c.sendMessage).toHaveBeenCalledTimes(1);
	pending.resolve(false);
	expect(await first).toBe(false);
	const id = c.sendMessage.mock.calls[0][1];
	c.sendMessage.mockResolvedValue(true);
	expect(await submit('draft', c.files)).toBe(true);
	expect(c.sendMessage.mock.calls[1][1]).toBe(id);
});
it.each([false, true])('composer clears only after accepted=%s', async (accepted) => {
	const c = setup(),
		pending = deferred<boolean>();
	c.submitPrompt.mockReturnValueOnce(pending.promise);
	const submit = handler<(text: string) => Promise<void>>('Chat', 'submitHandler', c);
	const request = submit('draft');
	await Promise.resolve();
	expect(c.prompt).toBe('draft');
	expect(c.files).toHaveLength(1);
	expect(c.messageInput.setText).not.toHaveBeenCalled();
	pending.resolve(accepted);
	await request;
	expect(c.prompt).toBe(accepted ? '' : 'draft');
	expect(c.files).toHaveLength(accepted ? 0 : 1);
});
it.each(['draft', 'files', 'navigation'])(
	'composer preserves newer %s after acceptance',
	async (change) => {
		const c = setup(),
			pending = deferred<boolean>();
		c.submitPrompt.mockReturnValueOnce(pending.promise);
		const request = handler<(text: string) => Promise<void>>('Chat', 'submitHandler', c)('draft');
		await Promise.resolve();
		if (change === 'draft') c.prompt = 'new draft';
		if (change === 'files') c.files = [{ id: 'new' }];
		if (change === 'navigation') c.history = { messages: {}, currentId: null };
		pending.resolve(true);
		await request;
		expect(c.messageInput.setText).not.toHaveBeenCalled();
		expect(c.prompt).toBe(change === 'draft' ? 'new draft' : 'draft');
		expect(c.files).toHaveLength(1);
	}
);
it.each([false, true])(
	'queue retains pending items then removes only accepted=%s ids',
	async (accepted) => {
		const c = setup(),
			pending = deferred<boolean>();
		c.$chatRequestQueues = {
			chat1: [{ id: 'q1', prompt: 'one', files: [] }],
			chat2: [{ id: 'q2', prompt: 'other', files: [] }]
		};
		c.submitPrompt.mockReturnValueOnce(pending.promise);
		const process = handler<(id: string) => Promise<void>>('Chat', 'processNextInQueue', c);
		const request = process('chat1');
		await Promise.resolve();
		expect(c.$chatRequestQueues.chat1).toHaveLength(1);
		c.$chatRequestQueues.chat1.push({ id: 'q3', prompt: 'new', files: [] });
		pending.resolve(accepted);
		await request;
		expect(c.$chatRequestQueues.chat1.map((m) => m.id)).toEqual(accepted ? ['q3'] : ['q1', 'q3']);
		expect(c.$chatRequestQueues.chat2).toHaveLength(1);
		if (!accepted) {
			await process('chat1');
			expect(c.submitPrompt).toHaveBeenCalledTimes(1);
		}
	}
);
it('queue never dispatches another chat', async () => {
	const c = setup();
	c.$chatRequestQueues = { chat2: [{ id: 'q2', prompt: 'other', files: [] }] };
	await handler<(id: string) => Promise<void>>('Chat', 'processNextInQueue', c)('chat2');
	expect(c.submitPrompt).not.toHaveBeenCalled();
	expect(c.$chatRequestQueues.chat2).toHaveLength(1);
});
function socketSetup() {
	const c = setup();
	c.history.currentId = 'a';
	c.history.messages.a.content = '';
	c.history.messages.a.done = false;
	const store = {
		set: vi.fn(async (id: string) => {
			context.$chatId = id;
		})
	};
	const context = { ...c, chatId: store };
	return {
		c: context,
		send: handler<
			(
				model: object,
				m: ChatHistoryMessage[],
				h: ChatHistory,
				id: string,
				chatId: string
			) => Promise<boolean>
		>('Chat', 'sendMessageSocket', context)
	};
}
it.each([
	null,
	{},
	{ status: false, task_ids: ['task'] },
	{ status: true, task_ids: [] },
	{ status: true, task_ids: [''] },
	{ status: true, task_ids: [123] },
	{ error: { message: 'rejected' } }
])('invalid API acknowledgement %j rejects', async (res) => {
	const { c, send } = socketSetup();
	c.generateOpenAIChatCompletion.mockResolvedValue(res);
	expect(
		await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1')
	).toBe(false);
	expect(c.trackEvent).not.toHaveBeenCalled();
	expect(c.taskIds).toBe(null);
});
it('API accepted remains true when subsequent sidebar refresh fails', async () => {
	const { c, send } = socketSetup();
	c.$chatId = '';
	c.generateOpenAIChatCompletion.mockResolvedValue({
		status: true,
		task_ids: ['task'],
		chat_id: 'newchat'
	});
	c.refreshChatList.mockRejectedValue(new Error('sidebar unavailable'));
	expect(await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', '')).toBe(
		true
	);
	expect(c.taskIds).toEqual(['task']);
	expect(c.$chatId).toBe('newchat');
});
it.each(['reject', 'billing', 'accept'])('late API %s leaves new chat untouched', async (mode) => {
	const { c, send } = socketSetup(),
		pending = deferred<object>();
	c.generateOpenAIChatCompletion.mockReturnValueOnce(pending.promise);
	if (mode === 'billing')
		c.parseBillingBlockedDetail.mockReturnValue({ error: 'insufficient_funds' });
	const request = send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1');
	await vi.waitFor(() => expect(c.generateOpenAIChatCompletion).toHaveBeenCalledTimes(1));
	c.history = { messages: {}, currentId: null };
	c.$chatId = 'chat2';
	c.taskIds = ['other-task'];
	if (mode === 'accept') pending.resolve({ status: true, task_ids: ['task'], chat_id: 'chat1' });
	else pending.reject(new Error('rejected'));
	expect(await request).toBe(mode === 'accept');
	expect(c.history).toEqual({ messages: {}, currentId: null });
	expect(c.taskIds).toEqual(['other-task']);
	expect(c.billingBlockedOpen).toBe(false);
	expect(c.$chatId).toBe('chat2');
});

it.each([true, false])('send now preserves queue until accepted=%s', async (accepted) => {
	const c = setup();
	c.failedQueueChats.add('chat1');
	c.$chatRequestQueues = {
		chat1: [
			{ id: 'q1', prompt: 'one', files: [] },
			{ id: 'q2', prompt: 'two', files: [] }
		]
	};
	c.submitPrompt.mockResolvedValue(accepted);
	await handler<(chatId: string, id?: string) => Promise<void>>(
		'Chat',
		'processNextInQueue',
		c
	)('chat1', 'q1');
	expect(c.stopResponse).toHaveBeenCalledWith(false);
	expect(c.submitPrompt.mock.calls[0][0]).toBe('one');
	expect(c.$chatRequestQueues.chat1.map((m) => m.id)).toEqual(accepted ? ['q2'] : ['q1', 'q2']);
});
it('dispatch exception finishes all side-by-side placeholders', async () => {
	const c = setup();
	c.selectedModels = ['model', 'model'];
	c.sendMessageSocket.mockRejectedValue(new Error('failure'));
	expect(
		await handler<(h: ChatHistory, id: string) => Promise<boolean>>(
			'Chat',
			'sendMessage',
			c
		)(c.history, 'u')
	).toBe(false);
	expect(c.clearInterval).toHaveBeenCalledWith(123);
	expect(
		Object.values(c.history.messages)
			.filter((m) => m.role === 'assistant')
			.every((m) => m.done)
	).toBe(true);
});
it('embedded creation failure creates no pending assistant', async () => {
	const c = setup(),
		pending = deferred<object | null>();
	const context = {
		...c,
		$chatId: '',
		embedded: true,
		onCreateEmbeddedChat: vi.fn().mockReturnValue(pending.promise)
	};
	const request = handler<(h: ChatHistory, id: string) => Promise<boolean>>(
		'Chat',
		'sendMessage',
		context
	)(context.history, 'u');
	pending.resolve(null);
	expect(await request).toBe(false);
	expect(context.sendMessageSocket).not.toHaveBeenCalled();
	expect(
		Object.values(context.history.messages).filter((m) => m.role === 'assistant')
	).toHaveLength(1);
});
it('late embedded creation leaves the new chat store unchanged', async () => {
	const c = setup(),
		pending = deferred<object>();
	const context = {
		...c,
		$chatId: '',
		embedded: true,
		onCreateEmbeddedChat: vi.fn().mockReturnValue(pending.promise),
		chatId: {
			set: vi.fn(async (id: string) => {
				context.$chatId = id;
			})
		},
		chatTitle: { set: vi.fn().mockResolvedValue(undefined) },
		mergeFiles: (left: ChatAttachment[], right: ChatAttachment[]): ChatAttachment[] => [
			...left,
			...right
		],
		onSelectEmbeddedChat: vi.fn().mockResolvedValue(undefined)
	};
	const request = handler<(h: ChatHistory, id: string) => Promise<boolean>>(
		'Chat',
		'sendMessage',
		context
	)(context.history, 'u');
	context.history = { messages: {}, currentId: null };
	context.$chatId = 'other';
	pending.resolve({ id: 'created' });
	expect(await request).toBe(false);
	expect(context.$chatId).toBe('other');
	expect(context.history).toEqual({ messages: {}, currentId: null });
});
it('API rejection preserves already received assistant content and annotation', async () => {
	const { c, send } = socketSetup(),
		pending = deferred<object>();
	c.generateOpenAIChatCompletion.mockReturnValueOnce(pending.promise);
	const frozen = structuredClone(c.history);
	const request = send(c.$models[0], createMessagesList(frozen, 'a'), frozen, 'a', 'chat1');
	await vi.waitFor(() => expect(c.generateOpenAIChatCompletion).toHaveBeenCalledTimes(1));
	c.history.messages.a.content = 'received';
	c.history.messages.a.favorite = true;
	pending.reject(new Error('lost response'));
	expect(await request).toBe(false);
	expect(c.history.messages.a.content).toBe('received');
	expect(c.history.messages.a.favorite).toBe(true);
});
it('socket without session never starts legacy generation', async () => {
	const { c, send } = socketSetup();
	c.$socket.id = '';
	expect(
		await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1')
	).toBe(false);
	expect(c.generateOpenAIChatCompletion).not.toHaveBeenCalled();
});
it.each([
	{ status: true, task_ids: ['task'] },
	{ status: true, task_id: 'task' }
])('valid task acknowledgement %j is accepted', async (ack) => {
	const { c, send } = socketSetup();
	c.generateOpenAIChatCompletion.mockResolvedValue(ack);
	expect(
		await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1')
	).toBe(true);
	expect(c.taskIds).toEqual(['task']);
	expect(c.trackEvent).toHaveBeenCalledTimes(1);
});
it.each(['missing', 'reject', 'throw'])(
	'continue %s never leaves a fake running response',
	async (mode) => {
		const c = setup();
		c.history.messages.a.model = 'model';
		if (mode === 'missing') c.$models = [];
		if (mode === 'throw') c.sendMessageSocket.mockRejectedValue(new Error('failure'));
		await handler<() => Promise<void>>('Chat', 'continueResponse', c)();
		expect(c.history.messages.a.done).toBe(true);
		if (mode === 'missing') expect(c.sendMessageSocket).not.toHaveBeenCalled();
	}
);

it.each([123, '', 'otherchat'])(
	'mismatched/malformed chat acknowledgement %j rejects',
	async (chatId) => {
		const { c, send } = socketSetup();
		c.generateOpenAIChatCompletion.mockResolvedValue({
			status: true,
			task_ids: ['task'],
			chat_id: chatId
		});
		expect(
			await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1')
		).toBe(false);
		expect(c.taskIds).toBe(null);
		expect(c.$chatId).toBe('chat1');
		expect(c.trackEvent).not.toHaveBeenCalled();
	}
);
it('new chat acknowledgement requires durable chat identity', async () => {
	const { c, send } = socketSetup();
	c.$chatId = '';
	c.generateOpenAIChatCompletion.mockResolvedValue({ status: true, task_ids: ['task'] });
	expect(await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', '')).toBe(
		false
	);
	expect(c.taskIds).toBe(null);
});

it('send-now stop rejection retains item without dispatch', async () => {
	const c = setup();
	c.taskIds = ['running'];
	c.$chatRequestQueues = { chat1: [{ id: 'q1', prompt: 'one', files: [] }] };
	await handler<(chatId: string, id?: string) => Promise<void>>(
		'Chat',
		'processNextInQueue',
		c
	)('chat1', 'q1');
	expect(c.submitPrompt).not.toHaveBeenCalled();
	expect(c.$chatRequestQueues.chat1).toHaveLength(1);
});
