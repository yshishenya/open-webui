// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { importChats } from '$lib/apis/chats';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
vi.mock('$lib/utils', () => ({ getTimeRange: vi.fn() }));
afterEach(() => {
	vi.unstubAllGlobals();
});
it('preserves the array response, one POST, authorization and payload', async () => {
	const rows = [{ id: 'new-chat', folder_id: null, pinned: false, extra: 7 }];
	const fetch = vi.fn<[string, RequestInit], Promise<Response>>(
		async () => new Response(JSON.stringify(rows))
	);
	vi.stubGlobal('fetch', fetch);
	await expect(importChats('fixture', [{ chat: {} }])).resolves.toEqual(rows);
	expect(fetch).toHaveBeenCalledOnce();
	expect(fetch.mock.calls[0][0]).toBe('/api/v1/chats/import');
	const init = fetch.mock.calls[0][1];
	expect(init.method).toBe('POST');
	expect(new Headers(init.headers).get('Authorization')).toBe('Bearer fixture');
	expect(JSON.parse(String(init.body))).toEqual({ chats: [{ chat: {} }] });
});
it.each(['null', '{}', '[{}]'])('rejects an invalid response %s', async (body) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(body))
	);
	await expect(importChats('fixture', [{ chat: {} }])).rejects.toThrow();
});
it.each(['network', 'HTTP', 'JSON'])('rejects %s refusal without retrying', async (kind) => {
	const fetch = vi.fn(async () => {
		if (kind === 'network') throw Error('Unavailable');
		if (kind === 'HTTP') return new Response('{}', { status: 403 });
		return new Response('{');
	});
	vi.stubGlobal('fetch', fetch);
	await expect(importChats('fixture', [{ chat: {} }])).rejects.toThrow();
	expect(fetch).toHaveBeenCalledOnce();
});
