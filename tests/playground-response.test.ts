// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const paths = [
	'src/lib/components/playground/Chat.svelte',
	'src/lib/components/playground/Completions.svelte'
];
function declaration(source: string, name: string): string {
	const ast = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
	const node = ast.statements.find(
		(statement) =>
			ts.isVariableStatement(statement) &&
			statement.declarationList.declarations.some((d) => d.name.getText(ast) === name)
	);
	if (!node) throw new Error(`Missing actual handler ${name}`);
	return node.getText(ast).replace(/^export /, '');
}
function setup(path: string, fetcher: typeof fetch) {
	const source = readFileSync(path, 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing actual script');
	const script = source.slice(instance.content.start, instance.content.end);
	const chat = path.endsWith('/Chat.svelte');
	const names = [
		'scrollToBottom',
		'stopResponse',
		chat ? 'chatCompletionHandler' : 'textCompletionHandler',
		...(chat ? ['addHandler'] : []),
		'submitHandler'
	];
	const textarea = { style: { height: '' }, scrollHeight: 30, scrollTop: 0 };
	const context = {
		selectedModelId: 'fixture',
		$models: [{ id: 'fixture' }],
		$i18n: { t: (key: string): string => key },
		params: { temperature: 0, seed: null },
		system: 'Инструкция',
		role: 'user',
		message: 'Задача',
		text: 'Начало: ',
		messages: [] as { role: string; content: string }[],
		loading: false,
		stopResponseFlag: false,
		responseController: null as AbortController | null,
		messagesContainerElement: textarea,
		textCompletionAreaElement: textarea,
		localStorage: { token: 'fixture' },
		document: { getElementById: vi.fn(() => textarea as object | null) },
		tick: async (): Promise<void> => {},
		toast: { error: vi.fn() },
		console: { log: vi.fn(), error: vi.fn() },
		WEBUI_BASE_URL: 'https://fixture.invalid',
		fetch: vi.fn(fetcher),
		AbortController,
		TextDecoderStream,
		TransformStream
	};
	const code = ts.transpileModule(
		declaration(readFileSync('src/lib/utils/index.ts', 'utf8'), 'splitStream') +
			'\n' +
			declaration(readFileSync('src/lib/apis/openai/index.ts', 'utf8'), 'chatCompletion') +
			'\n' +
			names.map((name) => declaration(script, name)).join('\n') +
			'\n({submitHandler, stopResponse})',
		{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
	).outputText;
	const handlers = runInNewContext(code, context) as {
		submitHandler: () => Promise<void>;
		stopResponse: () => void;
	};
	return { ...handlers, context, chat };
}
const encoder = new TextEncoder();
const chunk = 'data: {"choices":[{"delta":{"content":"Ответ"}}]}\n\n';
function response(fail = false): Response {
	let sent = false;
	return new Response(
		new ReadableStream<Uint8Array>({
			pull(controller) {
				if (!sent) {
					sent = true;
					controller.enqueue(encoder.encode(chunk));
				} else if (fail) controller.error(new Error('private-provider-detail'));
				else controller.close();
			}
		})
	);
}

it.each(paths)('%s keeps streamed content and one original request', async (path) => {
	const res = response();
	const s = setup(path, async () => res);
	await s.submitHandler();
	expect(s.context.loading).toBe(false);
	expect(s.context.fetch).toHaveBeenCalledTimes(1);
	const body = JSON.parse(String(s.context.fetch.mock.calls[0][1]?.body));
	expect(body.model).toBe('fixture');
	expect(body.stream).toBe(true);
	if (s.chat) {
		expect(body.messages).toEqual([
			{ role: 'system', content: 'Инструкция' },
			{ role: 'user', content: 'Задача' }
		]);
		expect(body.temperature).toBe(0);
		expect(body.seed).toBeUndefined();
		expect(s.context.messages.at(-1)?.content).toBe('Ответ');
	} else expect(s.context.text).toBe('Начало: Ответ');
	expect(res.body?.locked).toBe(false);
});

it.each(paths)('%s does not send another request on concurrent Run actions', async (path) => {
	const s = setup(path, async () => response());
	await Promise.all([s.submitHandler(), s.submitHandler()]);
	expect(s.context.fetch).toHaveBeenCalledTimes(1);
	if (s.chat)
		expect(s.context.messages.filter((message) => message.role === 'user')).toHaveLength(1);
});

it('chat preserves received content when its textarea is absent', async () => {
	const s = setup(paths[0], async () => response());
	s.context.document.getElementById.mockReturnValue(null);
	await s.submitHandler();
	expect(s.context.messages.at(-1)?.content).toBe('Ответ');
	expect(s.context.toast.error).not.toHaveBeenCalled();
});

it.each(paths)(
	'%s finishes at the final SSE marker without waiting for HTTP close',
	async (path) => {
		let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
		const s = setup(path, async (_, init) => {
			init?.signal?.addEventListener('abort', () => streamController?.error(new Error('aborted')), {
				once: true
			});
			return new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						streamController = controller;
						controller.enqueue(encoder.encode(chunk + 'data: [DONE]\r\n\r\n'));
					}
				})
			);
		});
		let finished = false;
		const failures: unknown[] = [];
		const run = s.submitHandler().then(
			() => {
				finished = true;
			},
			(error: unknown) => {
				failures.push(error);
			}
		);
		try {
			await vi.waitFor(() => expect(finished).toBe(true), { timeout: 1000 });
			expect(s.context.loading).toBe(false);
			expect(failures).toEqual([]);
			expect(s.context.toast.error).not.toHaveBeenCalled();
			expect(s.chat ? s.context.messages.at(-1)?.content : s.context.text).toContain('Ответ');
			expect(s.context.fetch).toHaveBeenCalledTimes(1);
		} finally {
			streamController?.error(new Error('test cleanup'));
			await run;
		}
	}
);

it.each(paths)(
	'%s restores controls after a failed request without retry or private errors',
	async (path) => {
		const s = setup(path, async () => {
			throw new Error('private-provider-detail');
		});
		await expect(s.submitHandler()).resolves.toBeUndefined();
		expect(s.context.loading).toBe(false);
		expect(s.context.stopResponseFlag).toBe(false);
		expect(s.context.toast.error).toHaveBeenCalledOnce();
		expect(s.context.fetch).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(s.context.console.error.mock.calls)).not.toContain(
			'private-provider-detail'
		);
		expect(JSON.stringify(s.context.toast.error.mock.calls)).not.toContain(
			'private-provider-detail'
		);
	}
);

it.each(paths)('%s reports an empty successful HTTP body and restores controls', async (path) => {
	const s = setup(path, async () => new Response(null, { status: 204 }));
	await expect(s.submitHandler()).resolves.toBeUndefined();
	expect(s.context.loading).toBe(false);
	expect(s.context.toast.error).toHaveBeenCalledOnce();
	expect(s.context.fetch).toHaveBeenCalledTimes(1);
});

it.each(paths)(
	'%s preserves partial content and releases the reader on a late failure',
	async (path) => {
		const res = response(true);
		const s = setup(path, async () => res);
		await expect(s.submitHandler()).resolves.toBeUndefined();
		expect(s.context.loading).toBe(false);
		expect(s.context.toast.error).toHaveBeenCalledOnce();
		expect(s.chat ? s.context.messages.at(-1)?.content : s.context.text).toContain('Ответ');
		expect(res.body?.locked).toBe(false);
		expect(s.context.fetch).toHaveBeenCalledTimes(1);
	}
);

it.each(paths)('%s cancels while waiting for HTTP without another request', async (path) => {
	let signal: AbortSignal | undefined;
	let rejectPending: ((reason: Error) => void) | undefined;
	const s = setup(path, async (_, init) => {
		signal = init?.signal ?? undefined;
		return new Promise<Response>((_, reject) => {
			rejectPending = reject;
			signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
		});
	});
	const failures: unknown[] = [];
	const run = s.submitHandler().catch((error: unknown) => {
		failures.push(error);
	});
	try {
		await vi.waitFor(() => expect(s.context.fetch).toHaveBeenCalledOnce());
		s.stopResponse();
		expect(signal?.aborted).toBe(true);
		await run;
		expect(s.context.loading).toBe(false);
		expect(s.context.toast.error).not.toHaveBeenCalled();
		expect(s.context.fetch).toHaveBeenCalledTimes(1);
		expect(failures).toEqual([]);
	} finally {
		// Release the deliberately stalled baseline even when its cancellation assertion fails.
		s.context.responseController?.abort();
		rejectPending?.(new Error('test cleanup'));
		await run;
	}
});

it.each(paths)('%s cancels a stalled reader and releases its lock', async (path) => {
	let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
	let res: Response | undefined;
	const s = setup(path, async (_, init) => {
		res = new Response(
			new ReadableStream<Uint8Array>({
				start: (controller) => {
					streamController = controller;
				}
			})
		);
		init?.signal?.addEventListener('abort', () => streamController?.error(new Error('aborted')), {
			once: true
		});
		return res;
	});
	const failures: unknown[] = [];
	const run = s.submitHandler().catch((error: unknown) => {
		failures.push(error);
	});
	try {
		await vi.waitFor(() => expect(res?.body?.locked).toBe(true));
		s.stopResponse();
		expect(s.context.fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
		await run;
		expect(res?.body?.locked).toBe(false);
		expect(s.context.loading).toBe(false);
		expect(s.context.toast.error).not.toHaveBeenCalled();
		expect(s.context.fetch).toHaveBeenCalledTimes(1);
		expect(failures).toEqual([]);
	} finally {
		streamController?.error(new Error('test cleanup'));
		await run;
	}
});
