// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	(globalThis as typeof globalThis & { APP_VERSION: string }).APP_VERSION = 'test';
	(globalThis as typeof globalThis & { APP_BUILD_HASH: string }).APP_BUILD_HASH = 'test';
});

import { getChatById } from './index';

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
