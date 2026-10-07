// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import * as historyUtils from './chat_history';
import type { ChatHistory } from './chat_history';

type Mode =
	| 'valid'
	| 'root'
	| 'orphan'
	| 'missing-child'
	| 'empty'
	| 'missing-current'
	| 'cross-link';
const historyFixture = (mode: Mode): ChatHistory => {
	const h: ChatHistory = {
		currentId: 'a',
		messages: {
			u: { id: 'u', role: 'user', parentId: null, childrenIds: ['a', 'b'], content: 'question' },
			a: {
				id: 'a',
				role: 'assistant',
				parentId: 'u',
				childrenIds: [],
				content: 'partial',
				done: false
			},
			b: {
				id: 'b',
				role: 'assistant',
				parentId: 'u',
				childrenIds: [],
				content: 'sibling',
				done: false
			}
		}
	};
	if (mode === 'root' || mode === 'orphan') {
		delete h.messages.u;
		delete h.messages.b;
		h.messages.a.parentId = mode === 'root' ? null : 'absent';
	}
	if (mode === 'missing-child') h.messages.u.childrenIds.push('absent');
	if (mode === 'empty') return { currentId: null, messages: {} };
	if (mode === 'missing-current') h.currentId = 'absent';
	if (mode === 'cross-link') {
		h.messages.u.childrenIds.push('u');
		h.messages.b.parentId = 'other';
	}
	return h;
};

function fixture(mode: Mode, delayed = false) {
	let release: () => void = () => {};
	const wait = new Promise<void>((resolve) => {
		release = resolve;
	});
	const context = {
		...historyUtils,
		history: historyFixture(mode),
		$chatId: 'chat',
		taskIds: ['task'] as string[] | null,
		generating: true,
		generationController: new AbortController(),
		localStorage: { token: 'fixture' },
		console: { log: vi.fn() },
		toast: { error: vi.fn() },
		$i18n: { t: (s: string): string => s },
		dismissContextCompactionToast: vi.fn(),
		processNextInQueue: vi.fn(async (): Promise<void> => {}),
		shouldAutoScrollResponse: (): boolean => false,
		scrollToBottom: vi.fn(),
		tick: vi.fn(async (): Promise<void> => {
			if (delayed) await wait;
		}),
		stopTasksByChatId: vi.fn(async (): Promise<{ status: boolean } | null> => {
			if (delayed) await wait;
			return { status: true };
		}),
		stopTask: vi.fn(async (): Promise<{ status: boolean } | null> => {
			if (delayed) await wait;
			return { status: true };
		})
	};
	const source = readFileSync('src/lib/components/chat/Chat.svelte', 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Chat script missing');
	const parsed = ts.createSourceFile(
		'Chat.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	function handler(name: string): (...args: unknown[]) => Promise<void> {
		const declaration = parsed.statements
			.filter(ts.isVariableStatement)
			.flatMap((s) => [...s.declarationList.declarations])
			.find((d) => d.name.getText(parsed) === name);
		if (!declaration?.initializer) throw new Error('Actual handler missing');
		return runInNewContext(
			ts.transpileModule(`(${declaration.initializer.getText(parsed)})`, {
				compilerOptions: { target: ts.ScriptTarget.ES2022 }
			}).outputText,
			context
		) as (...args: unknown[]) => Promise<void>;
	}
	return { context, release, stop: handler('stopResponse'), event: handler('chatEventHandler') };
}

it.each(
	(['stop', 'event'] as const).flatMap((caller) =>
		(
			[
				'valid',
				'root',
				'orphan',
				'missing-child',
				'empty',
				'missing-current',
				'cross-link'
			] as Mode[]
		).map((mode) => ({ caller, mode }))
	)
)('$caller handles $mode history without losing content', async ({ caller, mode }) => {
	const f = fixture(mode);
	const h = f.context.history;
	const before = Object.fromEntries(
		Object.entries(h.messages).map(([id, m]) => [
			id,
			{ content: m.content, parentId: m.parentId, childrenIds: [...m.childrenIds] }
		])
	);
	await expect(
		caller === 'stop'
			? f.stop()
			: f.event({ chat_id: 'chat', message_id: h.currentId, data: { type: 'chat:tasks:cancel' } })
	).resolves.toBeUndefined();
	for (const [id, m] of Object.entries(h.messages))
		expect({ content: m.content, parentId: m.parentId, childrenIds: m.childrenIds }).toEqual(
			before[id]
		);
	if (h.messages.a && h.currentId === 'a') expect(h.messages.a.done).toBe(true);
	if (mode === 'valid' || mode === 'missing-child') expect(h.messages.b.done).toBe(true);
	if (mode === 'cross-link') {
		expect(h.messages.u.done).toBeUndefined();
		expect(h.messages.b.done).toBe(false);
	}
});

it.each(['chat', 'history', 'tasks', 'controller'] as const)(
	'late stop preserves replacement %s and its queue',
	async (mode) => {
		const f = fixture('valid', true);
		const pending = f.stop();
		const old = f.context.history;
		if (mode === 'chat') f.context.$chatId = 'new-chat';
		if (mode === 'history' || mode === 'chat') f.context.history = historyFixture('root');
		if (mode === 'tasks') f.context.taskIds = ['new-task'];
		if (mode === 'controller') f.context.generationController = new AbortController();
		const tasks = f.context.taskIds;
		const controller = f.context.generationController;
		f.release();
		await pending;
		expect(f.context.taskIds).toBe(tasks);
		expect(f.context.generating).toBe(true);
		expect(controller.signal.aborted).toBe(false);
		expect(f.context.history.messages.a.done).toBe(false);
		expect(old.messages.a.done).toBe(false);
		expect(f.context.processNextInQueue).not.toHaveBeenCalled();
	}
);

it.each(['rejected', 'empty', 'false'] as const)(
	'stop %s never reports completion or drains queue',
	async (mode) => {
		const f = fixture('valid');
		if (mode === 'rejected')
			f.context.stopTasksByChatId.mockRejectedValue(new Error('unavailable'));
		else f.context.stopTasksByChatId.mockResolvedValue(mode === 'empty' ? null : { status: false });
		const tasks = f.context.taskIds;
		await f.stop();
		expect(f.context.taskIds).toBe(tasks);
		expect(f.context.history.messages.a.done).toBe(false);
		expect(f.context.generating).toBe(true);
		expect(f.context.generationController.signal.aborted).toBe(false);
		expect(f.context.processNextInQueue).not.toHaveBeenCalled();
		expect(f.context.toast.error).toHaveBeenCalledTimes(1);
	}
);

it('event arriving across tick preserves replacement history even with same message ID', async () => {
	const f = fixture('valid', true);
	const pending = f.event({
		chat_id: 'chat',
		message_id: 'a',
		data: { type: 'chat:tasks:cancel' }
	});
	f.context.$chatId = 'next';
	f.context.history = historyFixture('root');
	f.release();
	await pending;
	expect(f.context.history.messages.a.done).toBe(false);
	expect(f.context.processNextInQueue).not.toHaveBeenCalled();
});

it('duplicate cancellation drains the queue once and preserves a subsequent response', async () => {
	const f = fixture('valid');
	const event = { chat_id: 'chat', message_id: 'a', data: { type: 'chat:tasks:cancel' } };
	await f.event(event);
	await f.event(event);
	expect(f.context.processNextInQueue).toHaveBeenCalledTimes(1);
	f.context.history.currentId = 'b';
	f.context.history.messages.b.done = false;
	f.context.taskIds = ['next-task'];
	await f.event(event);
	expect(f.context.history.messages.b.done).toBe(false);
	expect(f.context.taskIds).toEqual(['next-task']);
	expect(f.context.processNextInQueue).toHaveBeenCalledTimes(1);
});

it('queue navigation during cancellation cannot write the old message into a new history', async () => {
	const f = fixture('valid');
	f.context.processNextInQueue.mockImplementationOnce(async (): Promise<void> => {
		f.context.$chatId = 'next';
		f.context.history = historyFixture('root');
		f.context.history.messages.a.content = 'replacement';
	});
	await f.event({ chat_id: 'chat', message_id: 'a', data: { type: 'chat:tasks:cancel' } });
	expect(f.context.history.messages.a.content).toBe('replacement');
	expect(f.context.history.messages.a.done).toBe(false);
});

it.each(['rejected', 'empty', 'false', 'success'] as const)(
	'direct task stop handles %s result',
	async (mode) => {
		const f = fixture('root');
		f.context.$chatId = '';
		if (mode === 'rejected') f.context.stopTask.mockRejectedValue(new Error('unavailable'));
		else
			f.context.stopTask.mockResolvedValue(
				mode === 'empty' ? null : { status: mode === 'success' }
			);
		await f.stop(false);
		expect(f.context.history.messages.a.done).toBe(mode === 'success');
		expect(f.context.taskIds).toEqual(mode === 'success' ? null : ['task']);
		expect(f.context.toast.error).toHaveBeenCalledTimes(mode === 'success' ? 0 : 1);
		expect(f.context.processNextInQueue).not.toHaveBeenCalled();
	}
);

it('client-only stop aborts its own controller and preserves server history', async () => {
	const f = fixture('valid');
	f.context.taskIds = null;
	const controller = f.context.generationController;
	await f.stop(false);
	expect(controller.signal.aborted).toBe(true);
	expect(f.context.generating).toBe(false);
	expect(f.context.history.messages.a.done).toBe(false);
	expect(f.context.stopTasksByChatId).not.toHaveBeenCalled();
	expect(f.context.processNextInQueue).not.toHaveBeenCalled();
});
