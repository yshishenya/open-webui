// @vitest-environment node
import { createServer } from 'node:http';
import { synthesizeOpenAISpeech } from '$lib/apis/audio';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('$lib/constants', () => ({ AUDIO_API_BASE_URL: '/api/v1/audio' }));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

// Call the public API with its optional fifth cancellation argument, including old source.
const synthesize = synthesizeOpenAISpeech as (
	token: string,
	voice: string | undefined,
	text: string,
	model?: string,
	signal?: AbortSignal
) => Promise<unknown>;

it('returns a fully read audio blob and preserves the request payload', async () => {
	const fetch = vi.fn(
		async () => new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } })
	);
	vi.stubGlobal('fetch', fetch);
	const result = await synthesize('fixture', 'voice', 'hello', 'model');
	expect(result).toBeInstanceOf(Blob);
	expect(await (result as Blob).text()).toBe('audio');
	expect(fetch.mock.calls[0]).toEqual([
		expect.stringContaining('/speech'),
		expect.objectContaining({
			method: 'POST',
			body: JSON.stringify({ input: 'hello', voice: 'voice', model: 'model' })
		})
	]);
});
it('does not request speech for an already cancelled signal', async () => {
	const fetch = vi.fn(async () => new Response('audio'));
	vi.stubGlobal('fetch', fetch);
	const c = new AbortController();
	c.abort();
	await expect(
		synthesize('fixture', undefined, 'hello', undefined, c.signal)
	).rejects.toMatchObject({ name: 'AbortError' });
	expect(fetch).not.toHaveBeenCalled();
});
it('propagates network errors instead of returning null', async () => {
	vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network refused')));
	await expect(synthesize('fixture', 'voice', 'hello')).rejects.toThrow('network refused');
});
it('preserves a useful HTTP detail without retrying the paid request', async () => {
	const fetch = vi.fn(
		async () => new Response(JSON.stringify({ detail: 'quota refused' }), { status: 403 })
	);
	vi.stubGlobal('fetch', fetch);
	await expect(synthesize('fixture', 'voice', 'hello')).rejects.toThrow('quota refused');
	expect(fetch).toHaveBeenCalledTimes(1);
});
it('times out an unfinished request and clears its timer and parent listener', async () => {
	vi.useFakeTimers();
	let child: AbortSignal | undefined;
	vi.stubGlobal(
		'fetch',
		vi.fn((url: string, options: RequestInit) => {
			expect(url).toBe('/api/v1/audio/speech');
			child = options.signal ?? undefined;
			return new Promise<Response>((_, reject) =>
				child?.addEventListener('abort', () => reject(child?.reason), { once: true })
			);
		})
	);
	const c = new AbortController();
	const remove = vi.spyOn(c.signal, 'removeEventListener');
	const outcome = synthesize('fixture', 'voice', 'hello', undefined, c.signal).then(
		() => 'resolved',
		(error: unknown) => error
	);
	await vi.advanceTimersByTimeAsync(60_000);
	expect(child?.aborted).toBe(true);
	expect(await outcome).toMatchObject({ name: 'TimeoutError' });
	expect(vi.getTimerCount()).toBe(0);
	expect(remove).toHaveBeenCalledTimes(1);
});
it('keeps the deadline active while reading the audio body', async () => {
	vi.useFakeTimers();
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, options: RequestInit) => {
			expect(url).toBe('/api/v1/audio/speech');
			return {
				ok: true,
				blob: () =>
					new Promise<Blob>((_, reject) =>
						options.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
							once: true
						})
					)
			};
		})
	);
	const outcome = synthesize('fixture', 'voice', 'hello').then(
		() => 'resolved',
		(error: unknown) => error
	);
	await vi.advanceTimersByTimeAsync(60_000);
	expect(await outcome).toMatchObject({ name: 'TimeoutError' });
	expect(vi.getTimerCount()).toBe(0);
});
it('clears timers and cancellation listeners after a successful body read', async () => {
	vi.useFakeTimers();
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('audio'))
	);
	const c = new AbortController();
	const remove = vi.spyOn(c.signal, 'removeEventListener');
	await synthesize('fixture', 'voice', 'hello', undefined, c.signal);
	expect(vi.getTimerCount()).toBe(0);
	expect(remove).toHaveBeenCalledTimes(1);
});
it('cancels real fetch body reading against a controlled loopback server', async () => {
	const nativeFetch = globalThis.fetch;
	let headersSent!: () => void;
	const ready = new Promise<void>((resolve) => {
		headersSent = resolve;
	});
	const server = createServer((request, response) => {
		request.resume();
		response.writeHead(200, { 'Content-Type': 'audio/mpeg' });
		response.write('start');
		headersSent();
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Missing server address');
	vi.stubGlobal('fetch', (url: string, options: RequestInit) => {
		expect(url).toBe('/api/v1/audio/speech');
		return nativeFetch(`http://127.0.0.1:${address.port}/speech`, options);
	});
	try {
		const c = new AbortController();
		const outcome = synthesize('fixture', 'voice', 'hello', undefined, c.signal).then(
			() => 'resolved',
			(error: unknown) => error
		);
		await ready;
		await new Promise((resolve) => setTimeout(resolve, 20));
		c.abort();
		expect(await outcome).toMatchObject({ name: 'AbortError' });
	} finally {
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
