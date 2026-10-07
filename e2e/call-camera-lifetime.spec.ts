import { expect } from '@playwright/test';
import { test } from './onboarding-paths.fixture';

declare global {
	interface Window {
		readonly __airisCallCamera: {
			mode: string;
			resume: () => void;
			readonly requests: number;
			readonly stopped: number;
			readonly live: number;
			readonly attached: boolean;
		};
	}
}

test('camera retries after playback failure and releases a late stream after ending call', async ({
	page,
	account
}) => {
	await page.addInitScript((token: string) => localStorage.setItem('token', token), account.token);
	await page.goto('/');
	const input = page.getByLabel(/^(Send a Message|How can I help you today\?)$/);
	await expect(input).toBeVisible();
	await page.evaluate(() => {
		// Synthetic silent audio and disposable video doubles; never accesses real devices.
		const streams: MediaStream[] = [];
		let requests = 0;
		let stopped = 0;
		const tracks: { readyState: string; stop: () => void }[] = [];
		const control = {
			mode: 'play-failed',
			resume: (): void => {},
			get requests(): number {
				return requests;
			},
			get stopped(): number {
				return stopped;
			},
			get live(): number {
				return tracks.filter((track) => track.readyState === 'live').length;
			},
			get attached(): boolean {
				const video = document.getElementById('camera-feed') as HTMLVideoElement | null;
				return Boolean(video?.srcObject);
			}
		};
		Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
			value: async (): Promise<MediaDeviceInfo[]> => [
				{
					deviceId: 'disposable-camera',
					kind: 'videoinput',
					label: 'Disposable Camera',
					groupId: 'fixture',
					toJSON: () => ({})
				}
			]
		});
		Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
			value: async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
				if (!constraints.video) {
					const audio = new AudioContext();
					const destination = audio.createMediaStreamDestination();
					return destination.stream;
				}
				requests += 1;
				const stream = new MediaStream();
				const ownTracks = [0, 1].map(() => {
					const track = {
						readyState: 'live',
						stop: (): void => {
							stopped += 1;
							track.readyState = 'ended';
						}
					};
					tracks.push(track);
					return track;
				});
				Object.defineProperty(stream, 'getTracks', { value: () => ownTracks });
				streams.push(stream);
				if (control.mode === 'pending')
					await new Promise<void>((resolve) => {
						control.resume = resolve;
					});
				return stream;
			}
		});
		const play = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function (): Promise<void> {
			if (streams.includes(this.srcObject as MediaStream)) {
				return control.mode === 'play-failed'
					? Promise.reject(new Error('Disposable camera playback failure'))
					: Promise.resolve();
			}
			return play.call(this);
		};
		Object.defineProperty(window, '__airisCallCamera', { value: control });
	});
	await page.getByRole('button', { name: 'Voice mode', exact: true }).click();
	const camera = page.getByRole('button', { name: 'Camera', exact: true });
	await expect(camera).toBeVisible();
	await camera.click();
	await expect
		.poll(() =>
			page.evaluate(() => ({
				requests: window.__airisCallCamera.requests,
				stopped: window.__airisCallCamera.stopped,
				live: window.__airisCallCamera.live,
				attached: window.__airisCallCamera.attached
			}))
		)
		.toEqual({ requests: 1, stopped: 2, live: 0, attached: false });
	await expect(camera).toBeVisible();
	await page.evaluate(() => {
		window.__airisCallCamera.mode = 'success';
	});
	await camera.click();
	await expect.poll(() => page.evaluate(() => window.__airisCallCamera.live)).toBe(2);
	await expect.poll(() => page.evaluate(() => window.__airisCallCamera.attached)).toBe(true);
	await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
	await expect.poll(() => page.evaluate(() => window.__airisCallCamera.live)).toBe(0);
	await page.evaluate(() => {
		window.__airisCallCamera.mode = 'pending';
	});
	await camera.click();
	await expect.poll(() => page.evaluate(() => window.__airisCallCamera.requests)).toBe(3);
	await page.getByRole('button', { name: 'End call', exact: true }).click();
	await expect(page.getByRole('button', { name: 'End call', exact: true })).toBeHidden();
	await page.evaluate(() => window.__airisCallCamera.resume());
	await expect
		.poll(() =>
			page.evaluate(() => ({
				requests: window.__airisCallCamera.requests,
				stopped: window.__airisCallCamera.stopped,
				live: window.__airisCallCamera.live,
				attached: window.__airisCallCamera.attached
			}))
		)
		.toEqual({ requests: 3, stopped: 6, live: 0, attached: false });
	await input.fill('The draft remains usable after closing the camera');
	await expect(input).toContainText('The draft remains usable after closing the camera');
});
