// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { getGravatarUrl } from '$lib/apis/utils';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
afterEach(() => {
	vi.unstubAllGlobals();
});
it('encodes the complete email without changing GET/auth or URL response', async () => {
	const fetch = vi.fn<[url: string, init: RequestInit], Promise<Response>>(
		async () => new Response('"https://www.gravatar.com/avatar/fixture"')
	);
	vi.stubGlobal('fetch', fetch);
	await expect(getGravatarUrl('token', 'a+b&c@example.test')).resolves.toBe(
		'https://www.gravatar.com/avatar/fixture'
	);
	const url = new URL(fetch.mock.calls[0][0], 'https://example.test');
	expect(url.searchParams.get('email')).toBe('a+b&c@example.test');
	expect(url.searchParams.size).toBe(1);
	expect(fetch.mock.calls[0][1].method).toBe('GET');
	expect(new Headers(fetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer token');
});
it.each(['null', '{}', '""'])('rejects a malformed avatar response %s', async (body) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(body))
	);
	await expect(getGravatarUrl('token', 'user@example.test')).rejects.toThrow();
});
it('supports pre-request cancellation without contacting the server', async () => {
	const fetch = vi.fn(),
		controller = new AbortController();
	vi.stubGlobal('fetch', fetch);
	controller.abort(Error('cancelled'));
	await expect(getGravatarUrl('token', 'user@example.test', controller.signal)).rejects.toThrow(
		'cancelled'
	);
	expect(fetch).not.toHaveBeenCalled();
});
