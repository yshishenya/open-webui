// @vitest-environment node
import { AudioQueue } from '$lib/utils/audio';
import { afterEach, expect, it, vi } from 'vitest';

const rig = () => {
	class Audio extends EventTarget {
		paused = true;
		ended = false;
		error: { message: string } | null = null;
		src = '';
		muted = false;
		currentTime = 0;
		playbackRate = 1;
		play = vi.fn(async (): Promise<void> => {
			this.paused = false;
			this.ended = false;
			this.error = null;
		});
		pause = vi.fn((): void => {
			this.paused = true;
		});
		removeAttribute = vi.fn();
		load = vi.fn();
	}
	const audio = new Audio();
	const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
	const queue = new AudioQueue(audio as unknown as HTMLAudioElement);
	queue.setId('message');
	return { audio, queue, revoke };
};
afterEach((): void => {
	vi.restoreAllMocks();
});

it('releases completed and queued blob URLs on natural end and stop', () => {
	const r = rig();
	r.queue.enqueue('blob:first');
	r.queue.enqueue('blob:second');
	r.audio.ended = true;
	r.audio.dispatchEvent(new Event('ended'));
	expect(r.revoke).toHaveBeenCalledWith('blob:first');
	r.queue.stop();
	expect(r.revoke).toHaveBeenCalledWith('blob:second');
});
it('releases all owned URLs when another message takes the queue', () => {
	const r = rig();
	r.queue.enqueue('blob:first');
	r.queue.enqueue('blob:second');
	r.queue.setId('next');
	expect(r.revoke.mock.calls.flat()).toEqual(['blob:first', 'blob:second']);
	expect(r.queue.id).toBe('next');
});
it('moves past a rejected play without an unhandled rejection', async () => {
	const r = rig();
	r.audio.play.mockRejectedValueOnce(new Error('play refused'));
	const stopped = vi.fn();
	r.queue.onStopped = stopped;
	r.queue.enqueue('blob:first');
	r.queue.enqueue('blob:second');
	await vi.waitFor(() => {
		expect(r.revoke).toHaveBeenCalledWith('blob:first');
		expect(r.audio.src).toBe('blob:second');
	});
	r.queue.destroy();
});
it('moves past a native media error', () => {
	const r = rig();
	r.queue.enqueue('blob:first');
	r.queue.enqueue('blob:second');
	r.audio.error = { message: 'decode refused' };
	r.audio.dispatchEvent(new Event('error'));
	expect(r.audio.src).toBe('blob:second');
	expect(r.revoke).toHaveBeenCalledWith('blob:first');
	r.queue.destroy();
});
it('does not let an old play rejection alter the next message', async () => {
	const r = rig();
	let reject!: (error: Error) => void;
	r.audio.play.mockReturnValueOnce(
		new Promise<void>((_, fail) => {
			reject = fail;
		})
	);
	r.queue.enqueue('blob:first');
	r.queue.setId('next');
	r.queue.enqueue('blob:next');
	reject(new Error('late refusal'));
	await Promise.resolve();
	await Promise.resolve();
	expect(r.audio.src).toBe('blob:next');
	expect(r.revoke).not.toHaveBeenCalledWith('blob:next');
	r.queue.destroy();
});
it('does not revoke ordinary URLs and removes native listeners on destroy', () => {
	const r = rig();
	const removed = vi.spyOn(r.audio, 'removeEventListener');
	r.queue.enqueue('https://fixture/audio.mp3');
	r.queue.destroy();
	expect(r.revoke).not.toHaveBeenCalled();
	expect(removed.mock.calls.map(([name]) => name)).toEqual(
		expect.arrayContaining(['ended', 'error'])
	);
});
it('ignores native ended events when it does not own current audio', () => {
	const r = rig();
	const stopped = vi.fn();
	r.queue.onStopped = stopped;
	r.audio.dispatchEvent(new Event('ended'));
	expect(stopped).not.toHaveBeenCalled();
	r.queue.destroy();
});

it('handles a synchronous play refusal and releases the failed URL', () => {
	const r = rig();
	r.audio.play.mockImplementationOnce(() => {
		throw new Error('sync play refused');
	});
	r.queue.enqueue('blob:failed');
	expect(r.revoke).toHaveBeenCalledWith('blob:failed');
	r.queue.destroy();
});

it('ignores delayed native events whose state no longer belongs to current playback', () => {
	const r = rig();
	r.queue.enqueue('blob:old');
	r.queue.setId('next');
	r.queue.enqueue('blob:next');
	r.audio.dispatchEvent(new Event('error'));
	r.audio.dispatchEvent(new Event('ended'));
	expect(r.audio.src).toBe('blob:next');
	expect(r.revoke).not.toHaveBeenCalledWith('blob:next');
	r.queue.destroy();
});
