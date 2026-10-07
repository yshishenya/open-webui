import { expect } from '@playwright/test';
import { test } from './onboarding-paths.fixture';

declare global {
	interface Window {
		readonly __airisCallAudio: {
			pending: boolean;
			resume: () => void;
			readonly requests: number;
			readonly recorders: number;
			readonly live: number;
			readonly contexts: number;
			readonly releasedLocks: number;
		};
	}
}

test('call closes pending microphone/wake permission and releases resources after reopening', async ({
	page,
	account
}) => {
	await page.addInitScript((token: string) => localStorage.setItem('token', token), account.token);
	await page.goto('/');
	const input = page.getByLabel(/^(Send a Message|How can I help you today\?)$/);
	await expect(input).toBeVisible();
	await page.evaluate(() => {
		// Native silent streams are synthetic; this never requests a real device.
		const NativeContext = window.AudioContext;
		const NativeRecorder = window.MediaRecorder;
		const streams: MediaStream[] = [];
		const contexts: AudioContext[] = [];
		const resumes: (() => void)[] = [];
		let requests = 0;
		let recorders = 0;
		let releasedLocks = 0;
		const control = {
			pending: true,
			resume: (): void => {
				resumes.splice(0).forEach((resolve) => resolve());
			},
			get requests(): number {
				return requests;
			},
			get recorders(): number {
				return recorders;
			},
			get live(): number {
				return streams
					.flatMap((stream) => stream.getTracks())
					.filter((track) => track.readyState === 'live').length;
			},
			get contexts(): number {
				return contexts.filter((context) => context.state !== 'closed').length;
			},
			get releasedLocks(): number {
				return releasedLocks;
			}
		};
		const permission = async (): Promise<void> => {
			if (control.pending) await new Promise<void>((resolve) => resumes.push(resolve));
		};
		window.AudioContext = class extends NativeContext {
			constructor() {
				super();
				contexts.push(this);
			}
		};
		window.MediaRecorder = class extends NativeRecorder {
			constructor(stream: MediaStream) {
				super(stream);
				recorders++;
			}
		};
		Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
			value: async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
				requests++;
				// The input permission probe must finish before CallOverlay is mounted.
				if (constraints.audio !== true) await permission();
				const generator = new NativeContext();
				const stream = generator.createMediaStreamDestination().stream;
				streams.push(stream);
				return stream;
			}
		});
		Object.defineProperty(navigator, 'wakeLock', {
			value: {
				request: async () => {
					await permission();
					const lock = {
						released: false,
						release: async (): Promise<void> => {
							lock.released = true;
							releasedLocks++;
						}
					};
					return lock;
				}
			}
		});
		Object.defineProperty(window, '__airisCallAudio', { value: control });
	});
	const voice = page.getByRole('button', { name: 'Voice mode', exact: true });
	const end = page.getByRole('button', { name: 'End call', exact: true });
	await voice.click();
	await expect(end).toBeVisible();
	await expect.poll(() => page.evaluate(() => window.__airisCallAudio.requests)).toBe(2);
	await end.click();
	await expect(end).toBeHidden();
	await page.evaluate(() => window.__airisCallAudio.resume());
	await expect
		.poll(() =>
			page.evaluate(() => ({
				live: window.__airisCallAudio.live,
				recorders: window.__airisCallAudio.recorders,
				contexts: window.__airisCallAudio.contexts,
				released: window.__airisCallAudio.releasedLocks
			}))
		)
		.toEqual({ live: 0, recorders: 0, contexts: 0, released: 1 });
	await page.evaluate(() => {
		window.__airisCallAudio.pending = false;
	});
	await voice.click();
	await expect
		.poll(() =>
			page.evaluate(() => ({
				live: window.__airisCallAudio.live,
				recorders: window.__airisCallAudio.recorders,
				contexts: window.__airisCallAudio.contexts
			}))
		)
		.toEqual({ live: 1, recorders: 1, contexts: 1 });
	await end.click();
	await expect(end).toBeHidden();
	await expect
		.poll(() =>
			page.evaluate(() => ({
				live: window.__airisCallAudio.live,
				contexts: window.__airisCallAudio.contexts,
				released: window.__airisCallAudio.releasedLocks
			}))
		)
		.toEqual({ live: 0, contexts: 0, released: 2 });
	await input.fill('Draft remains usable after ending a call');
	await expect(input).toContainText('Draft remains usable after ending a call');
});
