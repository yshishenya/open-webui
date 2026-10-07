// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

it.each(['camera', 'screen'])(
	'call video owns and releases only the current stream: %s',
	async (device) => {
		const source = readFileSync('src/lib/components/chat/MessageInput/CallOverlay.svelte', 'utf8');
		const instance = parse(source).instance;
		if (!instance) throw new Error('Missing component script');
		const parsed = ts.createSourceFile(
			'camera.ts',
			source.slice(instance.content.start, instance.content.end),
			ts.ScriptTarget.Latest,
			true
		);
		const names = ['startCamera', 'startVideoStream', 'stopVideoStream', 'stopCamera'];
		const handlers = parsed.statements
			.filter(ts.isVariableStatement)
			.flatMap((s) => [...s.declarationList.declarations])
			.filter((d) => names.includes(d.name.getText(parsed)))
			.map((d) => `const ${d.getText(parsed)};`);
		expect(handlers).toHaveLength(names.length);
		const tracks = (): { readyState: string; stop: () => void }[] =>
			[0, 1].map(() => {
				const track = {
					readyState: 'live',
					stop: vi.fn((): void => {
						track.readyState = 'ended';
					})
				};
				return track;
			});
		const video = { srcObject: null as object | null, play: vi.fn(async (): Promise<void> => {}) };
		const context = {
			camera: true,
			cameraStream: null as object | null,
			videoStreamRequest: 0,
			destroyed: false,
			selectedVideoInputDeviceId: device,
			document: { getElementById: () => video },
			navigator: { mediaDevices: { getUserMedia: vi.fn(), getDisplayMedia: vi.fn() } },
			getVideoInputDevices: vi.fn(async (): Promise<void> => {}),
			tick: vi.fn(async (): Promise<void> => {}),
			console: { error: vi.fn() },
			toast: { error: vi.fn() },
			$i18n: { t: (s: string): string => s }
		};
		const code = ts.transpileModule(`${handlers.join('\n')}\n({${names.join(',')}})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText;
		const api = runInNewContext(code, context) as {
			startCamera: () => Promise<void>;
			startVideoStream: () => Promise<void>;
			stopVideoStream: () => void;
			stopCamera: () => void;
		};
		const acquire =
			device === 'screen'
				? context.navigator.mediaDevices.getDisplayMedia
				: context.navigator.mediaDevices.getUserMedia;
		const released = (list: ReturnType<typeof tracks>): void => {
			list.forEach((track) => {
				expect(track.readyState).toBe('ended');
				expect(track.stop).toHaveBeenCalledTimes(1);
			});
		};
		for (const failure of ['enumerate', 'play', 'denied']) {
			context.camera = true;
			const list = tracks();
			const stream = { getTracks: () => list };
			acquire.mockImplementation(async () => {
				if (failure === 'denied') throw new Error('denied');
				return stream;
			});
			context.getVideoInputDevices.mockImplementation(async () => {
				if (failure === 'enumerate') throw new Error('enumerate');
			});
			video.play.mockImplementation(async () => {
				if (failure === 'play') throw new Error('play');
			});
			await expect(api.startVideoStream()).resolves.toBeUndefined();
			if (failure !== 'denied') released(list);
			else list.forEach((track) => expect(track.stop).not.toHaveBeenCalled());
			expect(context.cameraStream).toBeNull();
			expect(video.srcObject).toBeNull();
			expect(context.camera).toBe(false);
		}
		context.getVideoInputDevices.mockImplementation(async () => {});
		video.play.mockImplementation(async () => {});
		for (const point of ['acquire', 'enumerate', 'play']) {
			context.camera = true;
			const list = tracks();
			const stream = { getTracks: () => list };
			let resume: () => void = () => {
				throw new Error('Not waiting');
			};
			const pending = new Promise<void>((resolve) => {
				resume = resolve;
			});
			let entered: () => void = () => {
				throw new Error('Not entered');
			};
			const waiting = new Promise<void>((resolve) => {
				entered = resolve;
			});
			acquire.mockImplementation(async () => {
				if (point === 'acquire') {
					entered();
					await pending;
				}
				return stream;
			});
			context.getVideoInputDevices.mockImplementation(async () => {
				if (point === 'enumerate') {
					entered();
					await pending;
				}
			});
			video.play.mockImplementation(async () => {
				if (point === 'play') {
					entered();
					await pending;
				}
			});
			const start = api.startVideoStream();
			await waiting;
			api.stopCamera();
			resume();
			await start;
			released(list);
			expect(context.cameraStream).toBeNull();
			expect(video.srcObject).toBeNull();
		}
		for (const point of ['acquire', 'enumerate', 'play', 'play-reject']) {
			context.camera = true;
			const oldTracks = tracks();
			const newTracks = tracks();
			const oldStream = { getTracks: () => oldTracks };
			const newStream = { getTracks: () => newTracks };
			let resume: () => void = () => {
				throw new Error('Not waiting');
			};
			let entered: () => void = () => {
				throw new Error('Not entered');
			};
			const pending = new Promise<void>((resolve) => {
				resume = resolve;
			});
			const waiting = new Promise<void>((resolve) => {
				entered = resolve;
			});
			const pause = async (): Promise<void> => {
				entered();
				await pending;
			};
			acquire
				.mockImplementationOnce(async () => {
					if (point === 'acquire') await pause();
					return oldStream;
				})
				.mockResolvedValue(newStream);
			context.getVideoInputDevices
				.mockImplementationOnce(async () => {
					if (point === 'enumerate') await pause();
				})
				.mockImplementation(async () => {});
			video.play
				.mockImplementationOnce(async () => {
					if (point.startsWith('play')) await pause();
					if (point === 'play-reject') throw new Error('Obsolete playback');
				})
				.mockImplementation(async () => {});
			const oldStart = api.startVideoStream();
			await waiting;
			api.stopVideoStream();
			await api.startVideoStream();
			resume();
			await oldStart;
			released(oldTracks);
			newTracks.forEach((track) => expect(track.stop).not.toHaveBeenCalled());
			expect(context.cameraStream).toBe(newStream);
			expect(video.srcObject).toBe(newStream);
			expect(context.camera).toBe(true);
			api.stopCamera();
			released(newTracks);
			expect(video.srcObject).toBeNull();
			acquire.mockReset();
			context.getVideoInputDevices.mockReset();
			video.play.mockReset();
		}
		context.destroyed = true;
		context.camera = true;
		acquire.mockClear();
		await api.startVideoStream();
		expect(acquire).not.toHaveBeenCalled();
		context.destroyed = false;
		context.camera = false;
		context.getVideoInputDevices.mockRejectedValueOnce(new Error('initial enumeration'));
		await expect(api.startCamera()).resolves.toBeUndefined();
		expect(context.camera).toBe(false);
		expect(acquire).not.toHaveBeenCalled();
	}
);
