import { expect, type Page } from '@playwright/test';
import { test } from './onboarding-paths.fixture';

declare global {
	interface Window {
		readonly __airisVoiceRecording: {
			mode: string;
			resume: () => void;
			readonly requests: number;
			readonly live: number;
			readonly starts: number;
			dispose: () => Promise<void>;
		};
	}
}

async function installRecording(page: Page): Promise<void> {
	await page.evaluate(() => {
		// Synthetic silent native audio and recorder events; never accesses hardware.
		const tracks: MediaStreamTrack[] = [];
		const contexts: AudioContext[] = [];
		let requests = 0;
		let starts = 0;
		const control = {
			mode: 'constructor-failed',
			resume: (): void => {},
			get requests(): number {
				return requests;
			},
			get starts(): number {
				return starts;
			},
			get live(): number {
				return tracks.filter((track) => track.readyState === 'live').length;
			},
			dispose: async (): Promise<void> => {
				tracks.forEach((track) => track.stop());
				await Promise.all(contexts.map((context) => context.close()));
			}
		};
		Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
			value: async (): Promise<MediaStream> => {
				requests += 1;
				const context = new AudioContext();
				contexts.push(context);
				const stream = context.createMediaStreamDestination().stream;
				tracks.push(...stream.getTracks());
				// Every entry first obtains/releases a caller permission stream.
				if (control.mode === 'pending' && requests % 2 === 0)
					await new Promise<void>((resolve) => {
						control.resume = resolve;
					});
				return stream;
			}
		});
		class Recorder {
			static isTypeSupported(): boolean {
				return true;
			}
			state = 'inactive';
			mimeType = 'audio/webm';
			onstart: (() => void) | null = null;
			onstop: (() => void) | null = null;
			ondataavailable: ((event: { data: Blob }) => void) | null = null;
			constructor() {
				if (control.mode === 'constructor-failed') throw new Error('Disposable recorder refused');
			}
			start(): void {
				starts += 1;
				this.state = 'recording';
				setTimeout(() => {
					this.ondataavailable?.({ data: new Blob(['prefix'], { type: this.mimeType }) });
					this.onstart?.();
				}, 0);
			}
			stop(): void {
				if (this.state === 'inactive') throw new Error('Disposable recorder already inactive');
				this.state = 'inactive';
				setTimeout(() => {
					this.ondataavailable?.({ data: new Blob(['final'], { type: this.mimeType }) });
					this.onstop?.();
				}, 0);
			}
		}
		Object.defineProperty(window, 'MediaRecorder', { value: Recorder });
		Object.defineProperty(window, '__airisVoiceRecording', { value: control });
	});
}

test('voice recording retries after failure and transcribes all final bytes once', async ({
	page,
	account
}) => {
	await page.addInitScript((token: string) => localStorage.setItem('token', token), account.token);
	await page.goto('/');
	const input = page.getByLabel(/^(Send a Message|How can I help you today\?)$/);
	await expect(input).toBeVisible();
	await installRecording(page);
	let calls = 0;
	let uploaded = '';
	await page.route('**/api/v1/audio/transcriptions', async (route) => {
		calls += 1;
		uploaded = route.request().postDataBuffer()?.toString('utf8') || '';
		await route.fulfill({ json: { text: 'Recorded transcript' } });
	});
	const voice = page.getByRole('button', { name: 'Voice Input', exact: true });
	await voice.click();
	await expect(voice).toBeVisible();
	await expect.poll(() => page.evaluate(() => window.__airisVoiceRecording.live)).toBe(0);
	await page.evaluate(() => {
		window.__airisVoiceRecording.mode = 'success';
	});
	await voice.click();
	const confirm = page.getByRole('button', { name: 'Confirm recording', exact: true });
	await expect(confirm).toBeVisible();
	await expect.poll(() => page.evaluate(() => window.__airisVoiceRecording.live)).toBe(1);
	await confirm.click();
	await expect(input).toContainText('Recorded transcript');
	expect(calls).toBe(1);
	expect(uploaded).toContain('prefixfinal');
	await expect.poll(() => page.evaluate(() => window.__airisVoiceRecording.live)).toBe(0);
	await expect(voice).toBeVisible();
	await page.evaluate(() => window.__airisVoiceRecording.dispose());
});

test('cancel releases late permission and ignores a transcript returned after cancellation', async ({
	page,
	account
}) => {
	await page.addInitScript((token: string) => localStorage.setItem('token', token), account.token);
	await page.goto('/');
	const input = page.getByLabel(/^(Send a Message|How can I help you today\?)$/);
	await expect(input).toBeVisible();
	await input.fill('Keep this draft');
	await installRecording(page);
	await page.evaluate(() => {
		window.__airisVoiceRecording.mode = 'pending';
	});
	const voice = page.getByRole('button', { name: 'Voice Input', exact: true });
	await voice.click();
	await expect.poll(() => page.evaluate(() => window.__airisVoiceRecording.requests)).toBe(2);
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await page.evaluate(() => window.__airisVoiceRecording.resume());
	await expect.poll(() => page.evaluate(() => window.__airisVoiceRecording.live)).toBe(0);
	expect(await page.evaluate(() => window.__airisVoiceRecording.starts)).toBe(0);
	await expect(input).toContainText('Keep this draft');
	await page.evaluate(() => {
		window.__airisVoiceRecording.mode = 'success';
	});
	let resume: () => void = () => {};
	const reply = new Promise<void>((resolve) => {
		resume = resolve;
	});
	let calls = 0;
	await page.route('**/api/v1/audio/transcriptions', async (route) => {
		calls += 1;
		await reply;
		await route.fulfill({ json: { text: 'Obsolete transcript' } });
	});
	await voice.click();
	await page.getByRole('button', { name: 'Confirm recording', exact: true }).click();
	await expect.poll(() => calls).toBe(1);
	await expect.poll(() => page.evaluate(() => window.__airisVoiceRecording.live)).toBe(0);
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	const completed = page.waitForResponse('**/api/v1/audio/transcriptions');
	resume();
	await completed;
	await expect(voice).toBeVisible();
	// Exercise a new recording so obsolete callbacks have an observable newer owner.
	await voice.click();
	await expect(page.getByRole('button', { name: 'Confirm recording', exact: true })).toBeVisible();
	await expect.poll(() => page.evaluate(() => window.__airisVoiceRecording.live)).toBe(1);
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(input).toContainText('Keep this draft');
	await expect(input).not.toContainText('Obsolete transcript');
	expect(calls).toBe(1);
	await expect.poll(() => page.evaluate(() => window.__airisVoiceRecording.live)).toBe(0);
	await page.evaluate(() => window.__airisVoiceRecording.dispose());
});
