// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import equal from 'fast-deep-equal';
import { createMessagesList } from '../index';
import { expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false, dev: false }));
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '', WEBUI_BASE_URL: '' }));
import type { ChatHistory, ChatHistoryMessage, ChatMessageEdit } from './chat_history';

function handler<T>(component: string, name: string, context: object): T {
	const path = `src/lib/components/chat/${component}.svelte`;
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
const variants = [
	['UserMessage', 'editMessageConfirmHandler', false, false],
	['UserMessage', 'editMessageConfirmHandler', false, true],
	['ResponseMessage', 'editMessageConfirmHandler', false, false],
	['ResponseMessage', 'editMessageConfirmHandler', true, false],
	['ResponseMessage', 'saveAsCopyHandler', false, true],
	['ResponseMessage', 'saveAsCopyHandler', true, true]
] as const;
function editor(component: string, name: string, structured: boolean) {
	const request = deferred<boolean>();
	const context = {
		edit: true,
		saving: false,
		chatId: 'chat1',
		message: { id: 'm1' },
		editedContent: 'draft',
		editedFiles: [{ id: 'file', extra: true }],
		editedOutput: structured
			? [{ type: 'message', content: [{ type: 'output_text', text: 'draft' }] }]
			: null,
		postprocessAfterEditing: (text: string): string => `restored:${text}`,
		editMessage: vi.fn().mockReturnValue(request.promise),
		tick: vi.fn().mockResolvedValue(undefined),
		structuredClone,
		equal: (left: unknown, right: unknown): boolean =>
			equal(structuredClone(left), structuredClone(right)),
		toast: { error: vi.fn() },
		$i18n: { t: (text: string): string => text }
	};
	const confirm = handler<(submit?: boolean) => Promise<void>>(
		`Messages/${component}`,
		'editMessageConfirmHandler',
		context
	);
	const submit =
		name === 'saveAsCopyHandler'
			? handler<() => Promise<void>>(`Messages/${component}`, name, {
					...context,
					editMessageConfirmHandler: confirm
				})
			: confirm;
	// The wrapper must share mutable component state with its existing confirm function.
	return {
		context,
		request,
		submit,
		cancel: handler<() => Promise<void> | void>(
			`Messages/${component}`,
			'cancelEditMessage',
			context
		)
	};
}
it.each(variants)(
	'%s %s structured=%s submit=%s preserves pending/failure draft and retries',
	async (component, name, structured, submit) => {
		const s = editor(component, name, structured),
			before = structuredClone({
				content: s.context.editedContent,
				files: s.context.editedFiles,
				output: s.context.editedOutput
			});
		const first = s.submit(submit);
		expect(s.context.edit).toBe(true);
		expect(s.context.saving).toBe(true);
		await s.submit(submit);
		await s.cancel();
		expect(s.context.editMessage).toHaveBeenCalledTimes(1);
		expect(s.context.edit).toBe(true);
		s.request.reject(new Error('transport failure'));
		await first;
		expect(s.context.edit).toBe(true);
		expect(s.context.editedContent).toBe(before.content);
		expect(s.context.editedFiles).toEqual(before.files);
		expect(s.context.editedOutput).toEqual(before.output);
		expect(s.context.saving).toBe(false);
		expect(s.context.toast.error).toHaveBeenCalledTimes(1);
		s.context.editMessage.mockResolvedValueOnce(true);
		await s.submit(submit);
		expect(s.context.edit).toBe(false);
		expect(s.context.editedContent).toBe('');
		expect(s.context.saving).toBe(false);
	}
);
it.each(variants)(
	'%s %s structured=%s submit=%s preserves newer draft and rejected false',
	async (component, name, structured, submit) => {
		const s = editor(component, name, structured);
		const first = s.submit(submit);
		s.request.resolve(false);
		await first;
		expect(s.context.edit).toBe(true);
		expect(s.context.editedContent).toBe('draft');
		expect(s.context.toast.error).not.toHaveBeenCalled();
		const pending = deferred<boolean>();
		s.context.editMessage.mockReturnValueOnce(pending.promise);
		const next = s.submit(submit);
		if (structured) s.context.editedOutput![0].content[0].text = 'newer';
		else s.context.editedContent = 'newer';
		pending.resolve(true);
		await next;
		expect(s.context.edit).toBe(true);
		expect(structured ? s.context.editedOutput![0].content[0].text : s.context.editedContent).toBe(
			'newer'
		);
		expect(s.context.saving).toBe(false);
	}
);
it.each(variants)(
	'%s %s structured=%s submit=%s ignores completion after chat replacement',
	async (component, name, structured, submit) => {
		const s = editor(component, name, structured);
		const first = s.submit(submit);
		s.context.chatId = 'chat2';
		s.context.editedContent = 'other chat draft';
		s.request.resolve(true);
		await first;
		expect(s.context.edit).toBe(true);
		expect(s.context.editedContent).toBe('other chat draft');
	}
);
it('user attachments changed during saving remain available', async () => {
	const s = editor('UserMessage', 'editMessageConfirmHandler', false);
	const first = s.submit(false);
	s.context.editedFiles.splice(0, 1);
	s.request.resolve(true);
	await first;
	expect(s.context.edit).toBe(true);
	expect(s.context.editedFiles).toEqual([]);
	expect(s.context.editMessage.mock.calls[0][1].files).toHaveLength(1);
});
function parent(role: string = 'assistant') {
	const message: ChatHistoryMessage = {
		id: 'm1',
		parentId: 'p1',
		childrenIds: [],
		role,
		content: 'original',
		done: true,
		files: [{ id: 'attachment', type: 'file' }],
		favorite: true
	};
	const history: ChatHistory = {
		messages: {
			p1: { id: 'p1', parentId: null, childrenIds: ['m1'], role: 'user', content: 'prompt' },
			m1: message,
			other: {
				id: 'other',
				parentId: null,
				childrenIds: [],
				role: 'assistant',
				content: 'streaming'
			}
		},
		currentId: 'm1'
	};
	const saved = structuredClone(history);
	const context = {
		chatId: 'chat1',
		history,
		createMessagesList,
		selectedModels: ['model'],
		$temporaryChatEnabled: false,
		pendingCopyIds: new Map<string, string>(),
		savingMessageIds: new Set<string>(),
		messages: [history.messages.p1, message],
		uuidv4: vi.fn().mockReturnValueOnce('copy1').mockReturnValue('copy2'),
		tick: vi.fn().mockResolvedValue(undefined),
		sendMessage: vi.fn().mockResolvedValue(undefined),
		updateChatById: vi.fn(
			async (
				_token: string,
				_chatId: string,
				payload: { history: ChatHistory; messages?: ChatHistoryMessage[] }
			): Promise<{ chat: { history: ChatHistory } }> => {
				saved.messages = { ...saved.messages, ...structuredClone(payload.history.messages) };
				saved.currentId = payload.history.currentId;
				return { chat: { history: structuredClone(saved) } };
			}
		),
		refreshChatList: vi.fn().mockResolvedValue(undefined),
		localStorage: { token: 'fixture' },
		structuredClone,
		console: { warn: vi.fn() },
		toast: { error: vi.fn() },
		$i18n: { t: (text: string): string => text }
	};
	const edit = handler<(id: string, edit: ChatMessageEdit, submit?: boolean) => Promise<boolean>>(
		'Messages',
		'editMessage',
		context
	);
	const updateChat = handler<() => Promise<void>>('Messages', 'updateChat', context);
	Object.assign(context, { updateChat });
	return { context, edit, saved };
}
it.each(['user', 'assistant'])(
	'%s in-place save requires no model and commits only after confirmation',
	async (role) => {
		const s = parent(role),
			before = structuredClone(s.context.history),
			pending = deferred<{ chat: { history: ChatHistory } }>();
		s.context.selectedModels = [];
		s.context.updateChatById.mockReturnValueOnce(pending.promise);
		const request = s.edit('m1', { content: 'edited', files: [] }, false);
		await Promise.resolve();
		expect(s.context.history).toEqual(before);
		const payload = s.context.updateChatById.mock.calls[0][2];
		expect(Object.keys(payload.history.messages)).toEqual(['m1']);
		s.context.history.messages.other.content = 'newer stream';
		pending.resolve({ chat: { history: payload.history } });
		expect(await request).toBe(true);
		expect(s.context.history.messages.m1.content).toBe('edited');
		expect(s.context.history.messages.other.content).toBe('newer stream');
		expect(s.context.history.messages.m1.favorite).toBe(true);
	}
);
it('missing model rejects only sending a user edit without mutating history', async () => {
	const s = parent('user'),
		before = structuredClone(s.context.history);
	s.context.selectedModels = [];
	expect(await s.edit('m1', { content: 'edited' }, true)).toBe(false);
	expect(s.context.history).toEqual(before);
	expect(s.context.sendMessage).not.toHaveBeenCalled();
	expect(s.context.toast.error).toHaveBeenCalledTimes(1);
});
it('copy retry after an unknown response uses the same id and produces one copy', async () => {
	const s = parent(),
		before = structuredClone(s.context.history);
	s.context.updateChatById.mockImplementationOnce(async (_token, _id, payload) => {
		s.saved.messages = { ...s.saved.messages, ...structuredClone(payload.history.messages) };
		throw new Error('response lost after commit');
	});
	await expect(s.edit('m1', { content: 'copy' }, true)).rejects.toThrow('response lost');
	expect(s.context.history).toEqual(before);
	expect(await s.edit('m1', { content: 'copy' }, true)).toBe(true);
	const ids = s.context.updateChatById.mock.calls.map((call) =>
		Object.keys(call[2].history.messages)
	);
	expect(ids).toEqual([['copy1'], ['copy1']]);
	expect(Object.keys(s.saved.messages).filter((id) => id.startsWith('copy'))).toEqual(['copy1']);
	expect(s.context.history.messages.p1.childrenIds).toEqual(['m1', 'copy1']);
	expect(s.context.history.currentId).toBe('copy1');
	expect(s.context.uuidv4).toHaveBeenCalledTimes(1);
});
it('list refresh failure after persistence remains a successful copy with no duplicate', async () => {
	const s = parent();
	s.context.refreshChatList.mockRejectedValueOnce(new Error('list unavailable'));
	expect(await s.edit('m1', { content: 'copy' }, true)).toBe(true);
	expect(s.context.history.messages.copy1.content).toBe('copy');
	expect(s.context.updateChatById).toHaveBeenCalledTimes(1);
	expect(s.context.console.warn).toHaveBeenCalledTimes(1);
});
it('structured save preserves empty content and saved output; null API is rejected', async () => {
	const s = parent(),
		output = [
			{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'new' }] }
		];
	expect(await s.edit('m1', { output }, false)).toBe(true);
	expect(s.context.history.messages.m1.content).toBe('');
	expect(s.context.history.messages.m1.output).toEqual(output);
	const before = structuredClone(s.context.history);
	s.context.updateChatById.mockResolvedValueOnce(
		null as unknown as { chat: { history: ChatHistory } }
	);
	await expect(s.edit('m1', { content: 'discard' }, false)).rejects.toThrow();
	expect(s.context.history).toEqual(before);
});
it('temporary copy makes no API call and preserves the source', async () => {
	const s = parent(),
		before = structuredClone(s.context.history.messages.m1);
	s.context.$temporaryChatEnabled = true;
	expect(await s.edit('m1', { content: 'copy' }, true)).toBe(true);
	expect(s.context.history.messages.m1).toEqual(before);
	expect(s.context.history.messages.copy1.content).toBe('copy');
	expect(s.context.updateChatById).not.toHaveBeenCalled();
});
it('late persistence cannot modify a replacement chat or a newer selected branch', async () => {
	for (const replacement of [true, false]) {
		const s = parent(),
			pending = deferred<{ chat: { history: ChatHistory } }>();
		s.context.updateChatById.mockReturnValueOnce(pending.promise);
		const request = s.edit('m1', { content: 'copy' }, true);
		await Promise.resolve();
		const payload = s.context.updateChatById.mock.calls[0][2];
		if (replacement) {
			s.context.chatId = 'chat2';
			s.context.history = { messages: {}, currentId: null };
		} else s.context.history.currentId = 'other';
		const expected = structuredClone(s.context.history);
		pending.resolve({ chat: { history: payload.history } });
		expect(await request).toBe(true);
		if (replacement) expect(s.context.history).toEqual(expected);
		else expect(s.context.history.currentId).toBe('other');
	}
});

it.each([false, true])(
	'keeps the legacy branch projection aligned with edit/copy submit=%s',
	async (copy) => {
		const s = parent();
		expect(await s.edit('m1', { content: 'projected' }, copy)).toBe(true);
		const payload = s.context.updateChatById.mock.calls[0][2];
		expect(Object.keys(payload.history.messages)).toEqual([copy ? 'copy1' : 'm1']);
		expect(payload.messages?.map((message) => message.id)).toEqual(['p1', copy ? 'copy1' : 'm1']);
		expect(payload.messages?.at(-1)?.content).toBe('projected');
	}
);
