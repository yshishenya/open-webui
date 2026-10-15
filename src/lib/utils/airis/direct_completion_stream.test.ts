// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const declaration = (source: string, name: string): string => {
	const ast = ts.createSourceFile('source.js', source, ts.ScriptTarget.Latest, true);
	const node = ast.statements.find(
		(s) =>
			ts.isVariableStatement(s) &&
			s.declarationList.declarations.some((d) => d.name.getText(ast) === name)
	);
	if (!node) throw new Error(`Missing actual declaration: ${name}`);
	return node.getText(ast);
};
const source = readFileSync(process.env.ROOT_LAYOUT_SOURCE ?? 'src/routes/+layout.svelte', 'utf8');
const instance = parse(source).instance!;
const script = ts.transpileModule(
	declaration(readFileSync('src/lib/utils/index.ts', 'utf8'), 'splitStream').replace(
		'export ',
		''
	) +
		'\n' +
		declaration(source.slice(instance.content.start, instance.content.end), 'chatEventHandler') +
		'\nchatEventHandler',
	{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText;
const bytes = (chunks: Uint8Array[], fail = false): ReadableStream<Uint8Array> => {
	let index = 0;
	return new ReadableStream({
		pull(controller) {
			if (index < chunks.length) controller.enqueue(chunks[index++]);
			else if (fail) controller.error(new Error('private-fixture'));
			else controller.close();
		}
	});
};
const setup = (response: Response | null, stream = true, extra: Record<string, unknown> = {}) => {
	const callback = vi.fn((value: unknown) => value);
	const emit = vi.fn((channel: string, value: unknown) => [channel, value]);
	const log = vi.fn((...values: unknown[]) => values);
	const completion = vi.fn(async () => [response]);
	const context = {
		$socket: { id: 'fixture-session', emit },
		$settings: {
			directConnections: {
				OPENAI_API_BASE_URLS: ['https://fixture.invalid'],
				OPENAI_API_KEYS: ['fixture'],
				OPENAI_API_CONFIGS: [{ prefix_id: 'prefix' }]
			}
		},
		chatCompletion: completion,
		TextDecoder,
		TextDecoderStream,
		TransformStream,
		console: { log, error: log },
		...extra
	};
	const handler = runInNewContext(script, context) as (
		event: object,
		cb: (value: unknown) => unknown
	) => Promise<void>;
	const body = { model: 'prefix.fixture', stream };
	const event = {
		chat_id: 'ordinary',
		internal: true,
		data: {
			type: 'request:chat:completion',
			data: {
				session_id: 'fixture-session',
				channel: 'fixture-channel',
				model: { urlIdx: 0 },
				form_data: body
			}
		}
	};
	return { callback, emit, log, completion, context, body, run: () => handler(event, callback) };
};
const encoder = new TextEncoder();
const line = 'data: {"choices":[{"delta":{"content":"Привет"}}]}';
const usage = 'data: {"usage":{"prompt_tokens":7,"completion_tokens":3,"total_tokens":10}}';
it.each([1, 7, 20, 46])('joins byte fragments split at %s and preserves usage', async (cut) => {
	const data = encoder.encode(line + '\n\n' + usage + '\n\n');
	const r = setup(new Response(bytes([data.slice(0, cut), data.slice(cut)])));
	await r.run();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback).toHaveBeenCalledWith({ status: true });
	expect(r.emit.mock.calls).toEqual([
		['fixture-channel', line],
		['fixture-channel', usage],
		['fixture-channel', { done: true }]
	]);
	expect(r.completion).toHaveBeenCalledOnce();
});
it('joins UTF-8 split at every byte', async () => {
	const r = setup(
		new Response(bytes(Array.from(encoder.encode(line + '\n'), (value) => new Uint8Array([value]))))
	);
	await r.run();
	expect(r.emit.mock.calls).toEqual([
		['fixture-channel', line],
		['fixture-channel', { done: true }]
	]);
});
it.each(['\r\n', ''])('keeps CRLF or unterminated final line %s', async (suffix) => {
	const r = setup(new Response(bytes([encoder.encode(line + suffix)])));
	await r.run();
	expect(r.emit.mock.calls).toEqual([
		['fixture-channel', line + (suffix === '\r\n' ? '\r' : '')],
		['fixture-channel', { done: true }]
	]);
});
it('finishes an empty stream with one ack and one done', async () => {
	const r = setup(new Response(bytes([])));
	await r.run();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback).toHaveBeenCalledWith({ status: true });
	expect(r.emit.mock.calls).toEqual([['fixture-channel', { done: true }]]);
});
it('sends a late read failure through the channel without a second callback', async () => {
	const r = setup(new Response(bytes([encoder.encode(line + '\n')], true)));
	await r.run();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback).toHaveBeenCalledWith({ status: true });
	expect(
		r.emit.mock.calls.some(
			([, value]) => value !== null && typeof value === 'object' && 'error' in value
		)
	).toBe(true);
	expect(r.emit).toHaveBeenLastCalledWith('fixture-channel', { done: true });
	expect(
		r.log.mock.calls
			.flat()
			.map((value) => String(value) + JSON.stringify(value))
			.join(' ')
	).not.toContain('private-fixture');
});
it.each([
	new Response('{"error":"private-fixture"}', { status: 403 }),
	new Response('<html>private-fixture</html>', { status: 503 }),
	new Response(null),
	null
])('acknowledges invalid response once as a structured error', async (response) => {
	const r = setup(response);
	await r.run();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback.mock.calls[0][0]).toEqual({ error: expect.any(String) });
	expect(
		r.log.mock.calls
			.flat()
			.map((value) => String(value) + JSON.stringify(value))
			.join(' ')
	).not.toContain('private-fixture');
	expect(r.emit.mock.calls).toEqual([['fixture-channel', { done: true }]]);
});
it('acknowledges a rejected request once without retry or private logs', async () => {
	const r = setup(null);
	r.completion.mockRejectedValue(new Error('private-fixture'));
	await r.run();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback.mock.calls[0][0]).toEqual({ error: expect.any(String) });
	expect(r.completion).toHaveBeenCalledOnce();
	expect(
		r.log.mock.calls
			.flat()
			.map((value) => String(value) + JSON.stringify(value))
			.join(' ')
	).not.toContain('private-fixture');
});
it('keeps JSON completion and leaves the caller model unchanged', async () => {
	const value = {
		choices: [],
		usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 }
	};
	const r = setup(new Response(JSON.stringify(value)), false);
	await r.run();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback).toHaveBeenCalledWith(value);
	expect(r.completion).toHaveBeenCalledWith(
		'fixture',
		{ model: 'fixture', stream: false },
		'https://fixture.invalid'
	);
	expect(r.body.model).toBe('prefix.fixture');
});
it('returns a structured error for malformed JSON', async () => {
	const r = setup(new Response('private-fixture'), false);
	await r.run();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback.mock.calls[0][0]).toEqual({ error: expect.any(String) });
	expect(
		r.log.mock.calls
			.flat()
			.map((value) => String(value) + JSON.stringify(value))
			.join(' ')
	).not.toContain('private-fixture');
});
it('uses the original session socket after a global socket replacement', async () => {
	const r = setup(new Response(bytes([encoder.encode(line + '\n')])));
	const other = vi.fn((channel: string, value: unknown) => [channel, value]);
	const completion = r.completion.getMockImplementation()!;
	r.completion.mockImplementation(async () => {
		r.context.$socket = { id: 'other-session', emit: other };
		return completion();
	});
	await r.run();
	expect(other).not.toHaveBeenCalled();
	expect(r.emit).toHaveBeenLastCalledWith('fixture-channel', { done: true });
});

it('rejects an absent direct URL without falling back to the backend', async () => {
	const r = setup(new Response(bytes([])));
	r.context.$settings.directConnections.OPENAI_API_BASE_URLS = [];
	await r.run();
	expect(r.completion).not.toHaveBeenCalled();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback.mock.calls[0][0]).toEqual({ error: expect.any(String) });
});
it('does not acknowledge or emit into a reconnected session during the request', async () => {
	const r = setup(new Response(bytes([encoder.encode(line + '\n')])));
	const completion = r.completion.getMockImplementation()!;
	r.completion.mockImplementation(async () => {
		r.context.$socket.id = 'reconnected-session';
		return completion();
	});
	await r.run();
	expect(r.callback).not.toHaveBeenCalled();
	expect(r.emit).not.toHaveBeenCalled();
});
it('stops delivery if the original socket reconnects after acknowledgement', async () => {
	const r = setup(new Response(bytes([encoder.encode(line + '\n')])));
	r.callback.mockImplementation((value) => {
		r.context.$socket.id = 'reconnected-session';
		return value;
	});
	await r.run();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.emit).not.toHaveBeenCalled();
});

it('keeps actual API request errors private without retry', async () => {
	const fetch = vi.fn(async () => {
		throw new Error('private-fixture');
	});
	const log = vi.fn((value: unknown) => value);
	const api = runInNewContext(
		ts.transpileModule(
			declaration(
				readFileSync(process.env.OPENAI_API_SOURCE ?? 'src/lib/apis/openai/index.ts', 'utf8'),
				'chatCompletion'
			).replace('export ', '') + '\nchatCompletion',
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		{ fetch, AbortController, WEBUI_BASE_URL: '', console: { error: log } }
	);
	const r = setup(null, true, { chatCompletion: api });
	await r.run();
	expect(fetch).toHaveBeenCalledOnce();
	expect(r.callback).toHaveBeenCalledOnce();
	expect(r.callback.mock.calls[0][0]).toEqual({ error: expect.any(String) });
	expect(
		log.mock.calls
			.flat()
			.map((value) => String(value) + JSON.stringify(value))
			.join(' ')
	).not.toContain('private-fixture');
});
