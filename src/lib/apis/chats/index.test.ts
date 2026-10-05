// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	(globalThis as typeof globalThis & { APP_VERSION: string }).APP_VERSION = 'test';
	(globalThis as typeof globalThis & { APP_BUILD_HASH: string }).APP_BUILD_HASH = 'test';
});

import { getAllChats, getChatById } from './index';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('getChatById', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns the chat payload for a successful response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'chat-1' }), { status: 200 }))
		);

		await expect(getChatById('token', 'chat-1')).resolves.toEqual({ id: 'chat-1' });
	});

	it('does not turn an invalid response into a successful null result', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 502 })));

		await expect(getChatById('token', 'chat-1')).rejects.toThrow('Chat request failed: 502');
	});
});

describe('chat export stream', () => {
	it('joins fragmented UTF-8 and keeps the final line without a newline', async () => {
		const bytes = new TextEncoder().encode('{"title":"Привет"}\n\n{"id":"last"}');
		const stream = new ReadableStream<Uint8Array>({
			start(controller): void {
				for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
				controller.close();
			}
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)));
		await expect(getAllChats('')).resolves.toEqual([{ title: 'Привет' }, { id: 'last' }]);
	});

	it('finishes on an empty stream', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('')));
		await expect(getAllChats('')).resolves.toEqual([]);
	});
});
