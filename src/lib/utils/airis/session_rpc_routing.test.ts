// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { isTemporaryChatId } from '$lib/utils/chatId';
const types = ['execute:tool', 'execute:python', 'request:chat:completion'];
const source = readFileSync('src/routes/+layout.svelte', 'utf8');
const instance = parse(source).instance!;
const ast = ts.createSourceFile(
	'layout.js',
	source.slice(instance.content.start, instance.content.end),
	ts.ScriptTarget.Latest,
	true
);
const statement = ast.statements.find(
	(s) =>
		ts.isVariableStatement(s) &&
		s.declarationList.declarations.some((d) => d.name.getText(ast) === 'chatEventHandler')
);
if (!statement) throw new Error('Actual chat event handler not found');
const script = ts.transpileModule(statement.getText(ast) + '\nchatEventHandler', {
	compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
const setup = (background = false, extra: Record<string, unknown> = {}) => {
	const callback = vi.fn();
	const python = vi.fn((_id: string, _code: string, cb: (v: unknown) => void) =>
		cb({ stdout: 'fixture', stderr: null, result: 0 })
	);
	const tool = vi.fn(async (_data: unknown, cb: (v: unknown) => void) =>
		cb([{ result: 'fixture' }, {}])
	);
	const completion = vi.fn(async () => [
		new Response('{"choices":[]}', { headers: { 'Content-Type': 'application/json' } })
	]);
	const emit = vi.fn();
	const notify = vi.fn();
	const toast = vi.fn();
	const focus = vi.fn(async () => ({ isFocused: !background }));
	const context = {
		$chatId: 'temporary:current',
		$socket: { id: 'fixture-session', emit },
		document: { visibilityState: background ? 'hidden' : 'visible' },
		window: { electronAPI: { send: focus } },
		tick: async () => {},
		isTemporaryChatId,
		executePythonAsWorker: python,
		executeTool: tool,
		chatCompletion: completion,
		TextDecoder,
		$settings: {
			directConnections: {
				OPENAI_API_BASE_URLS: ['https://fixture.invalid'],
				OPENAI_API_KEYS: ['fixture'],
				OPENAI_API_CONFIGS: [{}]
			},
			notificationEnabled: true,
			notificationSoundAlways: false
		},
		$temporaryChatEnabled: false,
		$isLastActiveTab: true,
		$i18n: { t: (value: string) => value },
		Notification: notify,
		toast: { custom: toast },
		NotificationToast: {},
		WEBUI_BASE_URL: '',
		cleanText: (s: string) => s,
		removeAllDetails: (s: string) => s,
		getOutputText: () => '',
		console: { log: vi.fn(), error: vi.fn() },
		...extra
	};
	const handler = runInNewContext(script, context) as (
		event: object,
		cb: typeof callback
	) => Promise<void>;
	const event = (
		type: string,
		chatId: string,
		sessionId: string | undefined = 'fixture-session',
		stream = false
	) => ({
		chat_id: chatId,
		internal: true,
		data: {
			type,
			data: {
				session_id: sessionId,
				id: 'fixture-id',
				code: 'print(1)',
				name: 'fixture',
				params: {},
				server: { url: 'https://fixture.invalid' },
				channel: 'fixture-channel',
				model: { urlIdx: 0 },
				form_data: { model: 'fixture', stream }
			}
		}
	});
	return {
		handler,
		event,
		callback,
		python,
		tool,
		completion,
		emit,
		notify,
		toast,
		focus,
		context
	};
};
for (const type of types)
	for (const chat of ['ordinary', 'temporary:current', 'temporary:other', 'local:other'])
		for (const background of [false, true]) {
			it(`routes ${type} for ${chat} in ${background ? 'background' : 'foreground'} to its own session`, async () => {
				const r = setup(background);
				await r.handler(r.event(type, chat), r.callback);
				expect(r.callback).toHaveBeenCalledOnce();
				expect(r.callback).toHaveBeenCalledWith(
					type === 'execute:python'
						? { stdout: 'fixture', stderr: null, result: 0 }
						: type === 'execute:tool'
							? [{ result: 'fixture' }, {}]
							: { choices: [] }
				);
				expect(
					r.python.mock.calls.length + r.tool.mock.calls.length + r.completion.mock.calls.length
				).toBe(1);
				expect(r.notify).not.toHaveBeenCalled();
				expect(r.toast).not.toHaveBeenCalled();
			});
		}
for (const type of types) {
	it(`does not block ${type} on a failed window focus probe`, async () => {
		const r = setup(false, {
			window: {
				electronAPI: {
					send: vi.fn(async () => {
						throw new Error('fixture');
					})
				}
			}
		});
		await r.handler(r.event(type, 'ordinary'), r.callback).catch(() => {});
		expect(r.callback).toHaveBeenCalledOnce();
	});
	it(`ignores ${type} for another session`, async () => {
		const r = setup();
		await r.handler(r.event(type, 'ordinary', 'other-session'), r.callback);
		expect(r.callback).not.toHaveBeenCalled();
		expect(r.python).not.toHaveBeenCalled();
		expect(r.tool).not.toHaveBeenCalled();
		expect(r.completion).not.toHaveBeenCalled();
	});
	it(`does not execute ${type} with absent socket and target IDs`, async () => {
		const r = setup(false, { $socket: { emit: vi.fn() } });
		const e = r.event(type, 'ordinary');
		await r.handler(
			{ ...e, data: { ...e.data, data: { ...e.data.data, session_id: undefined } } },
			r.callback
		);
		expect(r.callback).not.toHaveBeenCalled();
		expect(r.python).not.toHaveBeenCalled();
		expect(r.tool).not.toHaveBeenCalled();
		expect(r.completion).not.toHaveBeenCalled();
	});
}
it.each(['temporary:other', 'local:other'])('keeps notifications hidden for %s', async (chat) => {
	const r = setup(true);
	await r.handler(
		{
			chat_id: chat,
			data: {
				type: 'chat:completion',
				data: { done: true, content: 'private-fixture', title: 'fixture' }
			}
		},
		r.callback
	);
	expect(r.notify).not.toHaveBeenCalled();
	expect(r.toast).not.toHaveBeenCalled();
	expect(r.callback).not.toHaveBeenCalled();
});
it('keeps direct streaming acknowledgement and wire messages', async () => {
	const completion = vi.fn(async () => [
		new Response('data: {"choices":[]}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
	]);
	const r = setup(false, { chatCompletion: completion });
	await r.handler(
		r.event('request:chat:completion', 'temporary:other', 'fixture-session', true),
		r.callback
	);
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback).toHaveBeenCalledWith({ status: true });
	expect(completion).toHaveBeenCalledOnce();
	expect(r.emit).toHaveBeenCalledWith('fixture-channel', 'data: {"choices":[]}');
	expect(r.emit).toHaveBeenLastCalledWith('fixture-channel', { done: true });
});
it('still shows ordinary background completion notifications', async () => {
	const r = setup(true);
	await r.handler(
		{
			chat_id: 'ordinary',
			data: { type: 'chat:completion', data: { done: true, content: 'fixture', title: 'fixture' } }
		},
		r.callback
	);
	expect(r.notify).toHaveBeenCalledOnce();
	expect(r.toast).toHaveBeenCalledOnce();
	expect(r.callback).not.toHaveBeenCalled();
});
it('preserves a calendar alert without a chat ID', async () => {
	const r = setup();
	await r.handler(
		{ data: { type: 'calendar:alert', data: { minutes_until: 0, title: 'fixture' } } },
		r.callback
	);
	expect(r.notify).toHaveBeenCalledOnce();
	expect(r.toast).toHaveBeenCalledOnce();
	expect(r.callback).not.toHaveBeenCalled();
});
