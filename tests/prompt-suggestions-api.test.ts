// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { setDefaultPromptSuggestions } from '$lib/apis/configs';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1', WEBUI_BASE_URL: '' }));
afterEach(() => {
	vi.unstubAllGlobals();
});
const rows = [{ title: ['Title', 'Subtitle'], content: 'Task' }];
it('preserves one POST, authorization, array body and server result', async () => {
	const fetch = vi.fn<[url: string, init: RequestInit], Promise<Response>>(
		async () => new Response(JSON.stringify(rows))
	);
	vi.stubGlobal('fetch', fetch);
	await expect(setDefaultPromptSuggestions('token', rows)).resolves.toEqual(rows);
	expect(fetch).toHaveBeenCalledOnce();
	expect(fetch.mock.calls[0][0]).toBe('/api/v1/configs/suggestions');
	const init = fetch.mock.calls[0][1];
	expect(init.method).toBe('POST');
	expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token');
	expect(JSON.parse(String(init.body))).toEqual({ suggestions: rows });
});
it.each(['network', 'HTTP', 'JSON'])(
	'rejects %s refusal instead of silently resolving null',
	async (kind) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				if (kind === 'network') throw Error('private-detail');
				if (kind === 'HTTP') return new Response('{}', { status: 403 });
				return new Response('{');
			})
		);
		await expect(setDefaultPromptSuggestions('token', rows)).rejects.toThrow();
	}
);
it.each([
	'null',
	'{}',
	'[{}]',
	'[{"content":4,"title":[]}]',
	'[{"content":"Task","title":null}]',
	'[{"content":"Task","title":[4]}]'
])('rejects malformed server response %s', async (body) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(body))
	);
	await expect(setDefaultPromptSuggestions('token', rows)).rejects.toThrow();
});
it('accepts an empty server list', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('[]'))
	);
	await expect(setDefaultPromptSuggestions('token', [])).resolves.toEqual([]);
});
