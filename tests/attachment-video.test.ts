// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { expect, it, vi } from 'vitest';
import Textarea from '../src/lib/components/common/Textarea.svelte';
import AttachmentVideo from '../src/lib/components/airis/AttachmentVideo.svelte';

const errorToast = vi.hoisted(() => vi.fn());
vi.mock('svelte-sonner', () => ({ toast: { error: errorToast } }));

it.each(['replacement', 'invalid', 'destroy-pending'])(
	'keeps native video controls and safely handles captions: %s',
	async (scenario) => {
		const i18n = createInstance();
		await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
		const create = vi.fn().mockReturnValueOnce('blob:one').mockReturnValueOnce('blob:two');
		const revoke = vi.fn();
		Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
		errorToast.mockClear();
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(AttachmentVideo, {
			target,
			context: new Map([['i18n', writable(i18n)]]),
			props: { src: '/api/v1/files/video/content' }
		});
		let destroyed = false;
		try {
			await tick();
			expect(target.querySelector('video')?.controls).toBe(true);
			expect(target.querySelector('video')?.getAttribute('src')).toBe(
				'/api/v1/files/video/content'
			);
			const input = target.querySelector<HTMLInputElement>('input[type=file]')!;
			const choose = (text: () => Promise<string>): void => {
				const file = Object.assign(new File([], 'captions.vtt', { type: 'text/vtt' }), { text });
				Object.defineProperty(input, 'files', { configurable: true, value: [file] });
				input.dispatchEvent(new Event('change', { bubbles: true }));
			};
			if (scenario === 'destroy-pending') {
				let finish: (text: string) => void = () => {};
				choose(
					() =>
						new Promise((resolve) => {
							finish = resolve;
						})
				);
				await unmount(component);
				destroyed = true;
				finish('WEBVTT\n');
				await tick();
				expect(create).not.toHaveBeenCalled();
			} else {
				choose(async () => 'WEBVTT\n\n00:00.000 --> 00:01.000\nHello\n');
				await vi.waitFor(() =>
					expect(target.querySelector('track')?.getAttribute('src')).toBe('blob:one')
				);
				if (scenario === 'replacement') {
					choose(async () => 'WEBVTT\n');
					await vi.waitFor(() =>
						expect(target.querySelector('track')?.getAttribute('src')).toBe('blob:two')
					);
					expect(revoke).toHaveBeenCalledWith('blob:one');
				} else {
					const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
					choose(async () => 'invalid file');
					await vi.waitFor(() => expect(errorToast).toHaveBeenCalledWith('Invalid subtitles file'));
					expect(target.querySelector('track')?.getAttribute('src')).toBe('blob:one');
					expect(revoke).not.toHaveBeenCalled();
					warning.mockRestore();
				}
			}
		} finally {
			if (!destroyed) await unmount(component);
			target.remove();
		}
		if (scenario !== 'destroy-pending')
			expect(revoke).toHaveBeenLastCalledWith(scenario === 'replacement' ? 'blob:two' : 'blob:one');
	}
);

it('forwards actual editor keyboard shortcuts through the shared textarea', async () => {
	vi.useFakeTimers();
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		callback(0);
		return 0;
	});
	const target = document.createElement('div');
	document.body.append(target);
	const onKeydown = vi.fn();
	const component = mount(Textarea, { target, props: { onKeydown } });
	try {
		await tick();
		await vi.advanceTimersByTimeAsync(100);
		const textarea = target.querySelector('textarea')!;
		for (const event of [
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
			new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })
		]) {
			textarea.dispatchEvent(event);
			expect(onKeydown).toHaveBeenLastCalledWith(event);
		}
		expect(onKeydown).toHaveBeenCalledTimes(2);
	} finally {
		await unmount(component);
		target.remove();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	}
});
