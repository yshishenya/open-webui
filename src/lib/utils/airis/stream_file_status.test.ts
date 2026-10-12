// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { getErrorMessage } from './error_message';

const root = process.env.AIRIS_TEST_ARTIFACT_ROOT ?? '.';
const source = (file: string): string => {
	const text = readFileSync(join(root, file), 'utf8');
	const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	return ast.statements
		.filter((node) => !ts.isImportDeclaration(node))
		.map((node) => node.getText(ast).replace(/^export /, ''))
		.join('\n');
};
const utility = readFileSync('src/lib/utils/index.ts', 'utf8');
const splitStart = utility.indexOf('export const splitStream');
const splitEnd = utility.indexOf('\nexport ', splitStart + 1);
const splitStream = runInNewContext(
	ts.transpileModule(
		utility.slice(splitStart, splitEnd).replace('export ', '') + '\nsplitStream',
		{}
	).outputText,
	{ TransformStream }
) as (separator: string) => TransformStream<string, string>;
const rig = (fetch = vi.fn()) => {
	const log = vi.fn();
	const context = {
		fetch,
		WEBUI_API_BASE_URL: 'https://fixture.invalid',
		EventSourceParserStream,
		TextDecoderStream,
		FormData,
		URLSearchParams,
		AbortController,
		setTimeout,
		clearTimeout,
		document: { visibilityState: 'hidden' },
		getErrorMessage,
		splitStream,
		console: { log, error: log, warn: log }
	};
	const api = runInNewContext(
		ts.transpileModule(
			source('src/lib/apis/streaming/index.ts') +
				'\n' +
				source('src/lib/apis/files/index.ts') +
				'\n({createOpenAITextStream,uploadFile,getFileProcessStatus})',
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		createOpenAITextStream: (
			body: ReadableStream<Uint8Array>,
			split: boolean
		) => Promise<AsyncGenerator<{ done: boolean; value: string; [key: string]: unknown }>>;
		uploadFile: (
			token: string,
			file: File,
			metadata?: object | null,
			process?: boolean | null,
			stream?: boolean
		) => Promise<{ id: string; data?: object; error?: string }>;
		getFileProcessStatus: (token: string, id: string) => Promise<Response>;
	};
	return { api, fetch, log, context };
};
const stream = (text: string, close = true) => {
	const cancel = vi.fn();
	const encoded = new TextEncoder().encode(text);
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (let i = 0; i < encoded.length; i += 2) controller.enqueue(encoded.slice(i, i + 2));
			if (close) controller.close();
		},
		cancel
	});
	return { body, cancel };
};
const file = (): File => new File(['Private fixture words'], 'fixture.txt', { type: 'text/plain' });
const record = { id: 'fixture', data: { status: 'pending' } };
const post = (): Response => Response.json(record);

it.each([false, true])(
	'keeps UTF-8 text and every wire metadata field with split=%s',
	async (split) => {
		const r = rig();
		const usage = { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10, extra: 'unchanged' };
		const events = [
			{ sources: [{ document: ['Private fixture words'] }] },
			{ selected_model_id: 'fixture-model' },
			{ usage },
			{ choices: [{ delta: { content: 'Привет 🌍' } }] }
		];
		const bytes = stream(
			events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n'
		);
		const updates = [];
		for await (const update of await r.api.createOpenAITextStream(bytes.body, split))
			updates.push(update);
		expect(
			updates
				.filter((x) => !x.done)
				.map((x) => x.value)
				.join('')
		).toBe('Привет 🌍');
		expect(updates.find((x) => x.usage)?.usage).toEqual(usage);
		expect(updates.find((x) => x.sources)?.sources).toEqual(events[0].sources);
		expect(updates.find((x) => x.selectedModelId)?.selectedModelId).toBe('fixture-model');
		expect(updates.at(-1)).toEqual({ done: true, value: '' });
		expect(JSON.stringify(r.log.mock.calls)).not.toContain('Private fixture words');
	}
);

it.each(['done', 'error', 'consumer'])('cancels an open source on %s completion', async (mode) => {
	const r = rig();
	const payload =
		mode === 'done'
			? '[DONE]'
			: mode === 'error'
				? '{"error":"refused"}'
				: '{"choices":[{"delta":{"content":"first"}}]}';
	const bytes = stream(`data: ${payload}\n\n`, false);
	for await (const update of await r.api.createOpenAITextStream(bytes.body, false)) {
		if (mode === 'consumer' || update.done) break;
	}
	await vi.waitFor(() => expect(bytes.cancel).toHaveBeenCalledOnce());
});

it.each(['null-body', 'http', 'network'])(
	'rejects %s processing status without returning a ready file',
	async (mode) => {
		const fetch = vi.fn().mockResolvedValueOnce(post());
		if (mode === 'network') fetch.mockRejectedValueOnce(new Error('Private fixture words'));
		else fetch.mockResolvedValueOnce(new Response(null, { status: mode === 'http' ? 403 : 200 }));
		const r = rig(fetch);
		await expect(r.api.uploadFile('fixture-token', file())).rejects.toThrow(
			'file processing status'
		);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(JSON.stringify(r.log.mock.calls)).not.toContain('Private fixture words');
	}
);

it('preserves upload metadata, process opt-out and the explicit stream opt-out', async () => {
	const r = rig(vi.fn().mockResolvedValueOnce(post()));
	expect(await r.api.uploadFile('fixture-token', file(), { language: 'ru' }, false, false)).toEqual(
		record
	);
	expect(r.fetch).toHaveBeenCalledOnce();
	const [url, options] = r.fetch.mock.calls[0];
	expect(url).toContain('process=false');
	expect(options.headers.authorization).toBe('Bearer fixture-token');
	expect(options.body.get('metadata')).toBe('{"language":"ru"}');
	expect(await options.body.get('file').text()).toBe('Private fixture words');
});

it.each(['completed', 'failed'])(
	'retains %s processing data and errors without private logs',
	async (status) => {
		const event = status === 'failed' ? { status, error: 'Private fixture words' } : { status };
		const bytes = stream(`data: ${JSON.stringify(event)}\n\n`);
		const r = rig(
			vi.fn().mockResolvedValueOnce(post()).mockResolvedValueOnce(new Response(bytes.body))
		);
		const result = await r.api.uploadFile('fixture-token', file());
		expect(result.data).toEqual(event);
		if (status === 'failed') expect(result.error).toBe(event.error);
		expect(JSON.stringify(r.log.mock.calls)).not.toContain('Private fixture words');
	}
);

it.each([
	['pending', record],
	['not_found', record],
	['pending', { ...record, data: null }],
	['not_found', { ...record, data: null }]
])('rejects a stream that ends with %s instead of a terminal status', async (status, uploaded) => {
	const bytes = stream(`data: ${JSON.stringify({ status })}\n\ndata: [DONE]\n\n`);
	const r = rig(
		vi
			.fn()
			.mockResolvedValueOnce(Response.json(uploaded))
			.mockResolvedValueOnce(new Response(bytes.body))
	);
	await expect(r.api.uploadFile('fixture-token', file())).rejects.toThrow('file processing status');
});

it('skips malformed events and finishes a live processing stream without waiting for EOF', async () => {
	const bytes = stream(
		'data: null\n\ndata: {\n\ndata: {"status":2}\n\ndata: {"status":"failed"}\n\n',
		false
	);
	const r = rig(
		vi.fn().mockResolvedValueOnce(post()).mockResolvedValueOnce(new Response(bytes.body))
	);
	const result = await r.api.uploadFile('fixture-token', file());
	expect(result.data).toEqual({ status: 'failed' });
	expect(result.error).toBe('File processing failed.');
	await vi.waitFor(() => expect(bytes.cancel).toHaveBeenCalledOnce());
});

it('bounds the status connection and clears the timer after the headers arrive', async () => {
	const r = rig(vi.fn().mockResolvedValue(new Response('data: {}\n\n')));
	const clear = vi.spyOn(r.context, 'clearTimeout');
	const response = await r.api.getFileProcessStatus('fixture-token', 'fixture');
	expect(clear).toHaveBeenCalledOnce();
	expect(r.fetch.mock.calls[0][1].signal.aborted).toBe(false);
	await response.body?.cancel();
	const waiting = rig(
		vi.fn(
			(_url: string, options: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					options.signal.addEventListener('abort', () =>
						reject(new Error('Private fixture words'))
					);
				})
		)
	);
	vi.spyOn(waiting.context, 'setTimeout').mockImplementation((callback) => {
		queueMicrotask(() => {
			if (typeof callback === 'function') callback();
		});
		return setTimeout(() => {}, 0);
	});
	const clearWaiting = vi.spyOn(waiting.context, 'clearTimeout');
	await expect(waiting.api.getFileProcessStatus('fixture-token', 'fixture')).rejects.toThrow(
		'file processing status'
	);
	expect(waiting.fetch).toHaveBeenCalledOnce();
	expect(clearWaiting).toHaveBeenCalledOnce();
	expect(JSON.stringify(waiting.log.mock.calls)).not.toContain('Private fixture words');
});
