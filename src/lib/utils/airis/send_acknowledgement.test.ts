// @vitest-environment node
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
	readPendingDispatch,
	preparePendingDispatch,
	replayPendingBody,
	removePendingDispatch,
	validDispatchReceipt,
	type PendingDispatch
} from './chat_dispatch';
import { readComposerDraft, writeComposerDraft, consumeComposerDraft } from './chat_draft';
import { resolveRequestedModels, setTextWithRetries } from './chat';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import equal from 'fast-deep-equal';
import { createMessagesList, processDetails } from '../index';
import { expect, it, vi } from 'vitest';
vi.stubGlobal('crypto', webcrypto);
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

function submitEvents(context: object): ((event: { detail: string }) => Promise<void>)[] {
	const path = `${process.env.AIRIS_COMPONENT_ROOT ?? 'src/lib/components/chat'}/Chat.svelte`;
	const source = readFileSync(path, 'utf8');
	const callbacks: string[] = [];
	const visit = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		const node = value as Record<string, unknown>;
		if (
			node.type === 'EventHandler' &&
			node.name === 'submit' &&
			node.expression &&
			typeof node.expression === 'object'
		) {
			const expression = node.expression as { start: number; end: number };
			const callback = source.slice(expression.start, expression.end);
			if (callback.includes('submitHandler(')) callbacks.push(callback);
		}
		Object.values(node).forEach(visit);
	};
	visit(parse(source).html);
	if (callbacks.length !== 3) throw new Error('Missing composer submit entry points');
	return callbacks.map(
		(callback) =>
			runInNewContext(
				ts.transpileModule(`(${callback})`, {
					compilerOptions: { target: ts.ScriptTarget.ES2022 }
				}).outputText,
				context
			) as (event: { detail: string }) => Promise<void>
	);
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
class MemoryStorage implements Storage {
	private values = new Map<string, string>();
	get length(): number {
		return this.values.size;
	}
	clear(): void {
		this.values.clear();
	}
	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
	removeItem(key: string): void {
		this.values.delete(key);
	}
	key(index: number): string | null {
		return [...this.values.keys()][index] ?? null;
	}
	token = 'fixture';
}
function bindDispatch(c: object): void {
	for (const name of [
		'draftScope',
		'composerDraft',
		'restoreDraft',
		'dispatchScope',
		'dispatchStorage',
		'availableDispatchServers',
		'refreshPendingDispatch',
		'dispatchPreparedRequest',
		'recoverPendingDispatch'
	]) {
		Object.assign(c, { [name]: handler('Chat', name, c) });
	}
}
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
		atSelectedModel: undefined as { id: string; name: string; info: object } | undefined,
		autoScroll: false,
		scrollToBottom: vi.fn(),
		shouldAutoScrollResponse: () => false,
		$settings: {},
		params: {},
		$temporaryChatEnabled: false,
		embedded: false,
		embeddedDraftKey: '',
		selectedText: '',
		webSearchEnabled: false,
		codeInterpreterEnabled: false,
		onCreateEmbeddedChat: undefined,
		tick: vi.fn().mockResolvedValue(undefined),
		uuidv4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
		structuredClone,
		equal: same,
		$i18n: { t: (s: string) => s },
		toast: { error: vi.fn(), warning: vi.fn() },
		console: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
		getChatEventEmitter: vi.fn().mockResolvedValue(123),
		clearInterval: vi.fn(),
		createMessagesList,
		processDetails,
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
		selectedToolIds: [] as string[],
		selectedSkillIds: [],
		selectedFilterIds: [],
		$selectedTerminalId: null,
		$toolServers: [],
		$terminalServers: [],
		getFeatures: () => ({}),
		getStopTokens: () => undefined,
		getPromptVariables: () => ({}),
		$user: { id: 'fixture-user', name: 'Fixture' },
		$socket: { id: 'socket' },
		$selectedFolder: null,
		localStorage: new MemoryStorage(),
		sessionStorage: new MemoryStorage(),
		saveDraftTimeout: null,
		clearTimeout: vi.fn(),
		crypto: webcrypto,
		navigator: {
			locks: { request: vi.fn(async (_key: string, run: () => Promise<unknown>) => await run()) }
		},
		pendingDispatch: null as PendingDispatch | null,
		dispatchNotice: '',
		checkingDispatch: false,
		dispatchIntent: '',
		readComposerDraft,
		writeComposerDraft,
		consumeComposerDraft,
		readPendingDispatch,
		preparePendingDispatch,
		replayPendingBody,
		removePendingDispatch,
		validDispatchReceipt,
		getChatDispatch: vi.fn().mockResolvedValue({ state: 'absent', receipt: null }),
		getTaskIdsByChatId: vi.fn().mockResolvedValue({ task_ids: [] }),
		getChatById: vi.fn(),
		sanitizeHistory: vi.fn(),
		chat: null as object | null,
		chatTitle: { set: vi.fn() },
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
	bindDispatch(c);

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

it('composer storage refusal prevents creation and dispatch', async () => {
	const c = setup();
	vi.spyOn(c.sessionStorage, 'setItem').mockImplementation(() => {
		throw new Error('quota exceeded');
	});
	await handler<(text: string) => Promise<void>>('Chat', 'submitHandler', c)('draft');
	expect(c.submitPrompt).not.toHaveBeenCalled();
	expect(c.prompt).toBe('draft');
	expect(c.files).toHaveLength(1);
});

it('accepted cleanup refusal keeps the pending operation across reload', async () => {
	const { c, send } = socketSetup();
	c.generateOpenAIChatCompletion.mockRejectedValueOnce(new Error('lost response'));
	await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1');
	const operation = c.pendingDispatch!;
	Object.assign(operation, {
		composer: { actor: c.$user.id, scope: 'chat1', draft: { prompt: 'original', files: [] } }
	});
	c.localStorage.setItem(
		`airis-pending-dispatch:${JSON.stringify([c.$user.id, 'chat1'])}`,
		JSON.stringify(operation)
	);
	vi.spyOn(c.sessionStorage, 'getItem').mockImplementation(() => {
		throw new Error('storage refused');
	});
	c.getChatDispatch.mockResolvedValue({
		state: 'accepted',
		receipt: { status: true, chat_id: 'chat1', task_ids: ['old-task'] }
	});
	c.getChatById.mockResolvedValue({
		id: 'chat1',
		chat: { title: 'Saved', history: structuredClone(c.history) }
	});
	await handler<() => Promise<boolean>>('Chat', 'recoverPendingDispatch', c)();
	expect(readPendingDispatch(c.localStorage, c.$user.id, 'chat1')?.operationId).toBe(
		operation.operationId
	);
	expect(c.generateOpenAIChatCompletion).toHaveBeenCalledTimes(1);
});

it.each([0, 1, 2])(
	'composer entry %s keeps the stored draft after rejected submission',
	async (entry) => {
		const c = setup();
		c.files = [];
		if (entry === 2) c.$chatId = '';
		Object.assign(c, {
			withSelectedText: (text: string): string => text,
			saveDraftTimeout: null,
			clearTimeout: vi.fn(),
			submitHandler: handler('Chat', 'submitHandler', c)
		});
		c.submitPrompt.mockResolvedValue(false);
		const key = `airis-chat-draft:${JSON.stringify([c.$user.id, c.$chatId || 'home'])}`;
		const snapshot = JSON.stringify(handler<() => object>('Chat', 'composerDraft', c)());
		c.sessionStorage.setItem(key, snapshot);
		await submitEvents(c)[entry]({ detail: 'draft' });
		await Promise.resolve();
		expect(c.submitPrompt).toHaveBeenCalled();
		expect(c.sessionStorage.getItem(key)).toBe(snapshot);
		expect(c.prompt).toBe('draft');
	}
);
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
	const context = Object.assign(c, { chatId: store });
	bindDispatch(context);
	return {
		c: context,
		send: handler<
			(
				model: object,
				m: ChatHistoryMessage[],
				h: ChatHistory,
				id: string,
				chatId: string,
				options?: { composer?: import('./chat_draft').ComposerSnapshot }
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

it('lost acknowledgement retries the same operation and complete payload after reconnect', async () => {
	const c = setup();
	c.sendMessageSocket = handler('Chat', 'sendMessageSocket', c);
	const send = handler<(h: ChatHistory, id: string) => Promise<boolean>>('Chat', 'sendMessage', c);
	c.generateOpenAIChatCompletion.mockRejectedValueOnce(new Error('lost HTTP response'));
	expect(await send(c.history, 'u')).toBe(false);
	const first = structuredClone(c.generateOpenAIChatCompletion.mock.calls[0][1]);
	c.$socket.id = 'reconnected';
	c.params = { temperature: 0.9 };
	c.getChatById.mockImplementation(async () => {
		const saved = structuredClone(c.pendingDispatch!.history);
		for (const message of Object.values(saved.messages))
			if (message.role === 'assistant') {
				message.done = true;
				message.content = 'Native saved answer';
			}
		return { id: 'chat1', title: 'Chat', chat: { title: 'Chat', history: saved } };
	});
	Object.assign(c, {
		chatId: {
			set: vi.fn(async (id: string) => {
				c.$chatId = id;
			})
		}
	});
	expect(await send(c.history, 'u')).toBe(true);
	const retry = structuredClone(c.generateOpenAIChatCompletion.mock.calls[1][1]);
	delete first.session_id;
	delete retry.session_id;
	expect(retry).toEqual(first);
	expect(first.operation_id).toEqual(expect.any(String));
});

it('pending operation survives a new component and restores saved result without a POST', async () => {
	const first = setup();
	first.sendMessageSocket = handler('Chat', 'sendMessageSocket', first);
	first.generateOpenAIChatCompletion.mockRejectedValueOnce(new Error('lost HTTP response'));
	await handler<(h: ChatHistory, id: string) => Promise<boolean>>(
		'Chat',
		'sendMessage',
		first
	)(first.history, 'u');
	const operation = first.pendingDispatch!;
	const next = setup();
	next.localStorage = first.localStorage;
	next.history = { messages: {}, currentId: null };
	next.params = { temperature: 0.2 };
	next.getChatDispatch.mockResolvedValue({
		state: 'accepted',
		receipt: { status: true, chat_id: 'chat1', task_ids: ['old-task'] }
	});
	const saved = structuredClone(operation.history);
	for (const message of Object.values(saved.messages))
		if (message.role === 'assistant') {
			message.done = true;
			message.content = 'Authoritative saved answer';
		}
	next.getChatById.mockResolvedValue({
		id: 'chat1',
		title: 'Saved',
		chat: { title: 'Saved', history: saved }
	});
	Object.assign(next, { chatId: { set: vi.fn() } });
	const recover = handler<(retry: boolean) => Promise<boolean>>(
		'Chat',
		'recoverPendingDispatch',
		next
	);
	expect(await recover(true)).toBe(true);
	expect(next.generateOpenAIChatCompletion).not.toHaveBeenCalled();
	expect(next.getChatDispatch).toHaveBeenCalledWith('fixture', operation.operationId);
	expect(next.history).toEqual(saved);
	expect(next.taskIds).toBe(null);
	expect(next.localStorage.length).toBe(0);
});

it.each(['original', 'new-text', 'new-files'])(
	'accepted recovery clears only the original composer draft: %s',
	async (draft) => {
		const { c, send } = socketSetup();
		c.generateOpenAIChatCompletion.mockRejectedValueOnce(new Error('lost HTTP response'));
		await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1');
		c.prompt = draft === 'new-text' ? 'new draft' : 'original';
		c.files = draft === 'new-files' ? [{ id: 'new-file', type: 'file' }] : [];
		const before = { prompt: c.prompt, files: structuredClone(c.files) };
		c.getChatDispatch.mockResolvedValue({
			state: 'accepted',
			receipt: { status: true, chat_id: 'chat1', task_ids: ['old-task'] }
		});
		c.getChatById.mockResolvedValue({
			id: 'chat1',
			chat: { title: 'Saved', history: structuredClone(c.history) }
		});
		expect(await handler<() => Promise<boolean>>('Chat', 'recoverPendingDispatch', c)()).toBe(true);
		expect(c.generateOpenAIChatCompletion).toHaveBeenCalledTimes(1);
		expect({ prompt: c.prompt, files: c.files }).toEqual(
			draft === 'original' ? { prompt: '', files: [] } : before
		);
		expect(c.messageInput.setText).toHaveBeenCalledTimes(draft === 'original' ? 1 : 0);
	}
);

it('saved-chat journal omits unrelated history without changing the replay payload', async () => {
	const c = setup();
	c.history.messages.unrelated = {
		id: 'unrelated',
		parentId: null,
		childrenIds: [],
		role: 'assistant',
		content: 'x'.repeat(6 * 1024 * 1024)
	};
	vi.spyOn(c.localStorage, 'setItem').mockImplementation((key, value) => {
		if (value.length > 5 * 1024 * 1024) throw new Error('quota exceeded');
		MemoryStorage.prototype.setItem.call(c.localStorage, key, value);
	});
	const body = {
		operation_id: c.uuidv4(),
		id: 'a',
		user_message: c.history.messages.u,
		messages: [{ role: 'user', content: 'original' }]
	};
	const pending = await preparePendingDispatch(
		c.localStorage,
		{
			actor: c.$user.id,
			scope: 'chat1',
			chatId: 'chat1',
			parentId: 'u',
			intent: 'send',
			history: c.history
		},
		body
	);
	expect(pending.history.messages.unrelated).toBeUndefined();
	expect(pending.history.messages.u).toEqual(c.history.messages.u);
	expect(pending.history.messages.a).toEqual(c.history.messages.a);
	expect((await replayPendingBody(pending, 'new-session', [])).messages).toEqual(body.messages);
	expect(c.history.messages.unrelated.content?.length).toBe(6 * 1024 * 1024);
});

it.each(['unknown', 'failure', 'accepted-dead'])(
	'%s never causes a blind replay or clears the saved operation',
	async (mode) => {
		const { c, send } = socketSetup();
		c.generateOpenAIChatCompletion.mockRejectedValueOnce(new Error('lost HTTP response'));
		await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1');
		const before = c.localStorage.getItem(c.localStorage.key(0)!);
		if (mode === 'failure') c.getChatDispatch.mockRejectedValueOnce(new Error('offline'));
		else
			c.getChatDispatch.mockResolvedValue({
				state: mode === 'unknown' ? 'unknown' : 'accepted',
				receipt: mode === 'unknown' ? null : { status: true, task_ids: ['dead'], chat_id: 'chat1' }
			});
		if (mode === 'accepted-dead') c.history.messages.a.done = false;
		c.getChatById.mockResolvedValue({ id: 'chat1', chat: { history: structuredClone(c.history) } });
		const recover = handler<(retry: boolean) => Promise<boolean>>(
			'Chat',
			'recoverPendingDispatch',
			c
		);
		expect(await recover(true)).toBe(false);
		expect(c.generateOpenAIChatCompletion).toHaveBeenCalledTimes(1);
		expect(c.localStorage.getItem(c.localStorage.key(0)!)).toBe(before);
		expect(c.taskIds).toBe(null);
	}
);

it('storage refusal prevents the provider request and preserves input', async () => {
	const { c, send } = socketSetup();
	vi.spyOn(c.localStorage, 'setItem').mockImplementation(() => {
		throw new Error('quota exceeded');
	});
	expect(
		await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1')
	).toBe(false);
	expect(c.generateOpenAIChatCompletion).not.toHaveBeenCalled();
	expect(c.prompt).toBe('draft');
});

it('account change during status lookup cannot replay or replace the new conversation', async () => {
	const { c, send } = socketSetup();
	c.generateOpenAIChatCompletion.mockRejectedValueOnce(new Error('lost HTTP response'));
	await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1');
	const lookup = deferred<{ state: string; receipt: null }>();
	c.getChatDispatch.mockReturnValueOnce(lookup.promise);
	const recover = handler<(retry: boolean) => Promise<boolean>>(
		'Chat',
		'recoverPendingDispatch',
		c
	);
	const request = recover(true);
	c.$user.id = 'another-account';
	c.localStorage.token = 'another-token';
	c.history = { messages: {}, currentId: null };
	lookup.resolve({ state: 'absent', receipt: null });
	expect(await request).toBe(false);
	expect(c.generateOpenAIChatCompletion).toHaveBeenCalledTimes(1);
	expect(c.history).toEqual({ messages: {}, currentId: null });
	expect(readPendingDispatch(c.localStorage, 'another-account', 'chat1')).toBe(null);
	expect(readPendingDispatch(c.localStorage, 'fixture-user', 'chat1')).not.toBe(null);
});

it('a pending operation holds the automatic and manual queue without consuming items', async () => {
	const { c, send } = socketSetup();
	c.generateOpenAIChatCompletion.mockRejectedValueOnce(new Error('lost HTTP response'));
	await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1');
	c.$chatRequestQueues = { chat1: [{ id: 'q', prompt: 'next', files: [] }] };
	const queue = handler<(id: string, item?: string) => Promise<void>>(
		'Chat',
		'processNextInQueue',
		c
	);
	await queue('chat1');
	await queue('chat1', 'q');
	expect(c.submitPrompt).not.toHaveBeenCalled();
	expect(c.stopResponse).not.toHaveBeenCalled();
	expect(c.$chatRequestQueues.chat1).toHaveLength(1);
});

it('temporary pending payload uses only tab storage', async () => {
	const { c, send } = socketSetup();
	c.$temporaryChatEnabled = true;
	c.generateOpenAIChatCompletion.mockRejectedValueOnce(new Error('lost HTTP response'));
	await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1');
	expect(c.localStorage.length).toBe(0);
	expect(c.sessionStorage.length).toBe(1);
	expect(readPendingDispatch(c.sessionStorage, c.$user.id, 'temporary')?.body.operation_id).toEqual(
		expect.any(String)
	);
});

it('each accepted intentional continuation has a fresh operation UUID', async () => {
	const c = setup();
	c.history.messages.a.model = 'model';
	c.sendMessageSocket = handler('Chat', 'sendMessageSocket', c);
	const resume = handler<() => Promise<void>>('Chat', 'continueResponse', c);
	await resume();
	c.history.messages.a.done = true;
	await resume();
	expect(c.generateOpenAIChatCompletion).toHaveBeenCalledTimes(2);
	const [first, second] = c.generateOpenAIChatCompletion.mock.calls.map((call) => call[1]);
	expect(first.operation_id).not.toBe(second.operation_id);
	expect(first.assistant_message_id).toBe(second.assistant_message_id);
	expect(c.localStorage.length).toBe(0);
});

it('credentials are not copied into the operation journal; unchanged connections can be restored', async () => {
	const c = setup(),
		server = { url: 'https://example.invalid', api_key: 'fixture-private-key' };
	const operation = await preparePendingDispatch(
		c.localStorage,
		{
			actor: c.$user.id,
			scope: 'chat1',
			chatId: 'chat1',
			parentId: 'u',
			intent: 'send',
			history: c.history
		},
		{
			operation_id: webcrypto.randomUUID(),
			id: 'a',
			params: { temperature: 0.1 },
			tool_servers: [server]
		}
	);
	expect(c.localStorage.getItem(c.localStorage.key(0)!)).not.toContain('fixture-private-key');
	const reloaded = readPendingDispatch(c.localStorage, c.$user.id, 'chat1')!;
	const request = await replayPendingBody(reloaded, 'new-socket', [server]);
	expect(request.tool_servers).toEqual([server]);
	expect(request.operation_id).toBe(operation.operationId);
	await expect(
		replayPendingBody(reloaded, 'new-socket', [{ ...server, api_key: 'changed' }])
	).rejects.toThrow('Tool connections changed');
	expect(readPendingDispatch(c.localStorage, c.$user.id, 'chat1')).not.toBe(null);
});

it('recovered queued dispatch removes only its original queue items', async () => {
	const { c } = socketSetup();
	c.sendMessageSocket = handler('Chat', 'sendMessageSocket', c);
	c.sendMessage = handler('Chat', 'sendMessage', c);
	c.submitPrompt.mockImplementation(handler('Chat', 'submitPrompt', c));
	c.generateOpenAIChatCompletion.mockRejectedValueOnce(new Error('lost HTTP response'));
	c.$chatRequestQueues = { chat1: [{ id: 'original', prompt: 'queued request', files: [] }] };
	await handler<(id: string) => Promise<void>>('Chat', 'processNextInQueue', c)('chat1');
	expect(c.pendingDispatch!.queueIds).toEqual(['original']);
	c.$chatRequestQueues.chat1.push({ id: 'new', prompt: 'new request', files: [] });
	const saved = structuredClone(c.pendingDispatch!.history);
	for (const message of Object.values(saved.messages))
		if (message.role === 'assistant') {
			message.done = true;
			message.content = 'Native result';
		}
	c.getChatDispatch.mockResolvedValue({
		state: 'accepted',
		receipt: { status: true, task_ids: ['accepted'], chat_id: 'chat1' }
	});
	c.getChatById.mockResolvedValue({
		id: 'chat1',
		title: 'Saved',
		chat: { title: 'Saved', history: saved }
	});
	expect(
		await handler<(retry: boolean) => Promise<boolean>>('Chat', 'recoverPendingDispatch', c)(true)
	).toBe(true);
	expect(c.generateOpenAIChatCompletion).toHaveBeenCalledTimes(1);
	expect(c.$chatRequestQueues.chat1.map((item) => item.id)).toEqual(['new']);
});

it.each(['getItem', 'corrupt', 'no-locks'])(
	'%s refuses unsafe dispatch instead of silently skipping the journal',
	async (failure) => {
		const { c, send } = socketSetup();
		if (failure === 'getItem')
			vi.spyOn(c.localStorage, 'getItem').mockImplementation(() => {
				throw new Error('disabled');
			});
		if (failure === 'corrupt')
			c.localStorage.setItem('airis-pending-dispatch:["fixture-user","chat1"]', '{broken');
		if (failure === 'no-locks') Object.assign(c.navigator, { locks: undefined });
		expect(
			await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1')
		).toBe(false);
		expect(c.generateOpenAIChatCompletion).not.toHaveBeenCalled();
	}
);

it.each(['original', 'new-settings'])(
	'note selection recovery consumes raw snapshot and preserves %s',
	async (change) => {
		const { c, send } = socketSetup();
		c.embedded = true;
		c.selectedText = 'selected note text';
		c.atSelectedModel = c.$models[0];
		c.prompt = 'raw draft';
		c.files = [{ type: 'image', url: 'data:image/png;base64,fixture' }];
		const draft = handler<() => import('./chat_draft').ComposerDraft>('Chat', 'composerDraft', c)();
		const composer = { actor: c.$user.id, scope: 'chat1', draft };
		writeComposerDraft(c.sessionStorage, composer);
		c.history.messages.u.content =
			'raw draft\n\nSelected note text for replace_note_content operations:\nselected note text';
		c.generateOpenAIChatCompletion.mockRejectedValueOnce(new Error('lost HTTP response'));
		await send(c.$models[0], createMessagesList(c.history, 'a'), c.history, 'a', 'chat1', {
			composer
		});
		expect(c.pendingDispatch?.composer).toEqual(composer);
		const operation = c.pendingDispatch!;
		c.prompt = '';
		c.files = [];
		c.selectedText = '';
		expect(handler<(scope: string) => boolean>('Chat', 'restoreDraft', c)('chat1')).toBe(true);
		expect(c.prompt).toBe('raw draft');
		expect(c.selectedText).toBe('selected note text');
		expect(c.atSelectedModel?.id).toBe('model');
		if (change === 'new-settings') {
			c.selectedToolIds = ['new-tool'];
			writeComposerDraft(c.sessionStorage, {
				...composer,
				draft: handler<() => import('./chat_draft').ComposerDraft>('Chat', 'composerDraft', c)()
			});
		}
		c.getChatDispatch.mockResolvedValue({
			state: 'accepted',
			receipt: { status: true, chat_id: 'chat1', task_ids: ['old-task'] }
		});
		c.getChatById.mockResolvedValue({
			id: 'chat1',
			chat: { title: 'Saved', history: structuredClone(c.history) }
		});
		expect(await handler<() => Promise<boolean>>('Chat', 'recoverPendingDispatch', c)()).toBe(true);
		expect(c.generateOpenAIChatCompletion).toHaveBeenCalledTimes(1);
		expect(readPendingDispatch(c.localStorage, c.$user.id, 'chat1')).toBe(null);
		expect(c.prompt).toBe(change === 'original' ? '' : 'raw draft');
		expect(readComposerDraft(c.sessionStorage, c.$user.id, 'chat1')).toEqual(
			change === 'original' ? null : { ...draft, selectedToolIds: ['new-tool'] }
		);
		expect(operation.composer?.draft.prompt).toBe('raw draft');
	}
);

it('chat navigation restores before a newly mounted composer can autosave empty input', async () => {
	const c = Object.assign(setup(), {
		loading: false,
		chatIdProp: 'chat1',
		saveControlsTimer: undefined,
		noteChatDebug: vi.fn(),
		saveControls: vi.fn().mockResolvedValue(undefined),
		loadChat: vi.fn().mockResolvedValue(true),
		updateLastReadAt: vi.fn(),
		processNextInQueue: vi.fn().mockResolvedValue(undefined),
		setDefaults: vi.fn(),
		goto: vi.fn()
	});
	Object.assign(c.window, { setTimeout: vi.fn() });
	c.chat = { id: 'chat1', user_id: c.$user.id };
	const draft = handler<() => import('./chat_draft').ComposerDraft>('Chat', 'composerDraft', c)();
	writeComposerDraft(c.sessionStorage, { actor: c.$user.id, scope: 'chat1', draft });
	c.tick.mockImplementation(async () => {
		handler<(data: object) => void>('Chat', 'saveDraft', c)({ prompt: c.prompt });
	});
	await handler<() => Promise<void>>('Chat', 'navigateHandler', c)();
	expect(c.prompt).toBe('draft');
	expect(readComposerDraft(c.sessionStorage, c.$user.id, 'chat1')).toEqual(draft);
	expect(c.goto).not.toHaveBeenCalled();
});

it('account switch while awaiting the emitter cannot dispatch an old draft', async () => {
	const c = setup(),
		ready = deferred<number>();
	c.getChatEventEmitter.mockReturnValueOnce(ready.promise);
	const sending = handler<(h: ChatHistory, id: string) => Promise<boolean>>(
		'Chat',
		'sendMessage',
		c
	)(c.history, 'u');
	c.$user.id = 'new-account';
	c.localStorage.token = 'new-token';
	ready.resolve(123);
	expect(await sending).toBe(false);
	expect(c.sendMessageSocket).not.toHaveBeenCalled();
});

it('an explicit free guide model takes precedence over a saved paid composer selection', async () => {
	const c = Object.assign(setup(), {
		$chatId: '',
		loading: false,
		$mobile: false,
		$page: { url: new URL('https://chat.airis.you/?models=model&q=guide&submit=false') },
		$desktopEvent: null,
		desktopEvent: { set: vi.fn() },
		resetWebSearchConfirmation: vi.fn(),
		updateLastReadAt: vi.fn(),
		resolveRequestedModels,
		temporaryChatEnabled: { set: vi.fn().mockResolvedValue(undefined) },
		showControls: { set: vi.fn() },
		showCallOverlay: { set: vi.fn() },
		showArtifacts: { set: vi.fn() },
		resetInput: vi.fn().mockResolvedValue(undefined),
		clearWelcomePresetPrompt: vi.fn(),
		consumeWelcomePresetPrompt: vi.fn().mockReturnValue(null),
		setTextWithRetries: vi.fn().mockResolvedValue(true),
		setTimeout: vi.fn()
	});
	Object.assign(c.window, { location: { pathname: '/' } });
	Object.assign(c, {
		chatId: {
			set: vi.fn(async (id: string) => {
				c.$chatId = id;
			})
		}
	});
	c.$models.push({ id: 'paid', name: 'Paid', info: {} });
	writeComposerDraft(c.sessionStorage, {
		actor: c.$user.id,
		scope: 'home',
		draft: {
			prompt: 'old paid question',
			files: [],
			selectedModels: ['paid'],
			atSelectedModelId: 'paid'
		}
	});
	await handler<() => Promise<void>>('Chat', 'initNewChat', c)();
	expect(c.selectedModels).toEqual(['model']);
	expect(c.atSelectedModel).toBeUndefined();
	expect(c.submitPrompt).not.toHaveBeenCalled();
	c.$page.url.searchParams.set('models', 'missing');
	Object.assign(c.toast, { info: vi.fn() });
	await handler<() => Promise<void>>('Chat', 'initNewChat', c)();
	expect(c.selectedModels).toEqual(['']);
	expect(c.atSelectedModel).toBeUndefined();
	expect(c.submitPrompt).not.toHaveBeenCalled();
});

it('guide query fills the composer after its loading view has mounted', async () => {
	const c = Object.assign(setup(), {
		$chatId: '',
		loading: false,
		$mobile: false,
		$page: { url: new URL('https://chat.airis.you/?models=model&q=guide&submit=false') },
		$desktopEvent: null,
		desktopEvent: { set: vi.fn() },
		resetWebSearchConfirmation: vi.fn(),
		updateLastReadAt: vi.fn(),
		resolveRequestedModels,
		setTextWithRetries,
		temporaryChatEnabled: { set: vi.fn().mockResolvedValue(undefined) },
		showControls: { set: vi.fn() },
		showCallOverlay: { set: vi.fn() },
		showArtifacts: { set: vi.fn() },
		resetInput: vi.fn().mockResolvedValue(undefined),
		clearWelcomePresetPrompt: vi.fn(),
		consumeWelcomePresetPrompt: vi.fn().mockReturnValue(null),
		setTimeout: vi.fn()
	});
	Object.assign(c.window, { location: { pathname: '/' } });
	Object.assign(c, {
		messageInput: undefined,
		chatId: {
			set: vi.fn(async (id: string) => {
				c.$chatId = id;
			})
		}
	});
	c.prompt = '';
	const composer = {
		setText: vi.fn(async (text: string) => {
			c.prompt = text;
			return true;
		})
	};
	c.tick.mockImplementation(async () => {
		if (!c.loading) c.messageInput = composer;
	});
	await handler<() => Promise<void>>('Chat', 'initNewChat', c)();
	expect(c.prompt).toBe('guide');
	expect(composer.setText).toHaveBeenCalledWith('guide');
	expect(c.submitPrompt).not.toHaveBeenCalled();
});
