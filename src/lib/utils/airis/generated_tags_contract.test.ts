import { afterEach, expect, it, vi } from 'vitest';
import { generateTags } from '$lib/apis';

vi.mock('$lib/constants', () => ({ WEBUI_BASE_URL: 'https://airis.test' }));
vi.mock('$lib/utils', () => ({ convertOpenApiToToolPayload: vi.fn() }));
vi.mock('$lib/apis/openai', () => ({ getOpenAIModelsDirect: vi.fn() }));
afterEach(() => {
	vi.unstubAllGlobals();
});

it('keeps only string tags from the actual generation response', async () => {
	for (const [tags, expected] of [
		[
			['plan', 3, null, { name: 'object' }, 'text'],
			['plan', 'text']
		],
		[null, []],
		['invalid', []]
	] as const) {
		const fetchResponse = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					choices: [{ message: { content: JSON.stringify({ tags }) } }]
				})
			)
		);
		vi.stubGlobal('fetch', fetchResponse);
		expect(
			await generateTags(
				'test-token',
				'test-model',
				[{ role: 'assistant', content: 'text' }],
				'test-chat'
			)
		).toEqual(expected);
		expect(fetchResponse).toHaveBeenCalledOnce();
	}
});
