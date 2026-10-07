import { expect } from '@playwright/test';
import { test } from './onboarding-paths.fixture';

declare global {
	interface Window {
		readonly __airisCaptureProof: { requests: number; stopped: number; detached: boolean };
	}
}

test('failed screen frame releases tracks and leaves the draft usable', async ({
	page,
	account
}) => {
	await page.addInitScript((token: string) => localStorage.setItem('token', token), account.token);
	await page.goto('/');
	const input = page.getByLabel(/^(Send a Message|How can I help you today\?)$/);
	await expect(input).toBeVisible();
	await input.fill('Draft before failed frame');
	await page.evaluate(() => {
		// Only disposable native API doubles; never opens capture permission or real devices.
		const stream = new MediaStream();
		let stopped = 0;
		let requests = 0;
		const videos: HTMLMediaElement[] = [];
		Object.defineProperty(stream, 'getTracks', {
			value: () =>
				[0, 1].map(() => ({
					stop: (): void => {
						stopped += 1;
					}
				}))
		});
		Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
			value: async (): Promise<MediaStream> => {
				requests += 1;
				return stream;
			}
		});
		const play = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function (): Promise<void> {
			if (this.srcObject === stream) {
				videos.push(this);
				return Promise.reject(new Error('Disposable frame playback failure'));
			}
			return play.call(this);
		};
		Object.defineProperty(window, '__airisCaptureProof', {
			get: () => ({
				requests,
				stopped,
				detached: videos.length === 1 && videos[0].srcObject === null
			})
		});
	});
	await page.locator('#input-menu-button').click();
	await page.getByRole('button', { name: 'Capture', exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => window.__airisCaptureProof))
		.toEqual({
			requests: 1,
			stopped: 2,
			detached: true
		});
	await expect(input).toContainText('Draft before failed frame');
	await input.fill('Draft remains usable after capture failure');
	await expect(input).toContainText('Draft remains usable after capture failure');
});
