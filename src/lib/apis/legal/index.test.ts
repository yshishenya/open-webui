// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	(globalThis as typeof globalThis & { APP_VERSION: string }).APP_VERSION = 'test';
	(globalThis as typeof globalThis & { APP_BUILD_HASH: string }).APP_BUILD_HASH = 'test';
});

import { acceptLegalDocs, getLegalRequirements, getLegalStatus } from './index';

const legalStatus = {
	docs: [],
	needs_accept: false,
	server_time: 1
};

describe('legal API', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	it('retries a temporary gateway failure and returns the legal status', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response('<!doctype html>', { status: 502 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify(legalStatus), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			);
		vi.stubGlobal('fetch', fetchMock);

		await expect(getLegalStatus('token')).resolves.toEqual(legalStatus);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('does not expose an HTML gateway response to the user', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('<!doctype html>', { status: 502 }))
		);

		await expect(getLegalRequirements()).rejects.toThrow(
			'Не удалось загрузить юридические документы. Попробуйте ещё раз.'
		);
	});

	it('does not retry a legal acceptance POST after an ambiguous gateway failure', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('<!doctype html>', { status: 502 }));
		vi.stubGlobal('fetch', fetchMock);

		await expect(acceptLegalDocs('token', ['terms_offer'])).rejects.toThrow(
			'Не удалось принять документы. Попробуйте ещё раз.'
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
