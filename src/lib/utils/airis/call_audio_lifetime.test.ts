// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
};

// Execute the component's actual handlers; native events/devices below are synthetic.
const rig = () => {
	const source = readFileSync('src/lib/components/chat/MessageInput/CallOverlay.svelte', 'utf8');
	const script = parse(source).instance;
	if (!script) throw new Error('Missing script');
	const parsed = ts.createSourceFile(
		'call.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const names = [
		'startRecording',
		'stopAudioStream',
		'stopRecordingCallback',
		'transcribeHandler',
		'analyseAudio',
		'calculateRMS',
		'toggleMute',
		'closeAudioContext',
		'recordingError',
		'setWakeLock',
		'releaseWakeLock',
		'handleVisibilityChange',
		'endCall'
	];
	const declarations = parsed.statements
		.filter(ts.isVariableStatement)
		.flatMap((s) => [...s.declarationList.declarations])
		.filter((d) => names.includes(d.name.getText(parsed)))
		.map((d) => `const ${d.getText(parsed)};`);
	const hooks = parsed.statements
		.filter(ts.isExpressionStatement)
		.filter(
			(s) =>
				ts.isCallExpression(s.expression) &&
				['onMount', 'onDestroy'].includes(s.expression.expression.getText(parsed))
		)
		.map((s) => s.getText(parsed));
	const track = {
		readyState: 'live',
		stop: vi.fn(() => {
			track.readyState = 'ended';
		})
	};
	const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
	const recorders: Recorder[] = [];
	class Recorder {
		static failure = '';
		state = 'inactive';
		mimeType = 'audio/webm';
		onstart: (() => void) | null = null;
		onstop: (() => Promise<void> | void) | null = null;
		onerror: (() => void) | null = null;
		ondataavailable: ((event: { data: Blob }) => void) | null = null;
		constructor() {
			if (Recorder.failure === 'constructor') throw new Error('constructor refused');
			recorders.push(this);
		}
		start(): void {
			if (Recorder.failure === 'start') throw new Error('start refused');
			this.state = 'recording';
		}
		stop = vi.fn((): void => {
			if (this.state === 'inactive') throw new Error('already inactive');
			this.state = 'inactive';
		});
		data(text: string): void {
			this.ondataavailable?.({ data: new Blob([text], { type: this.mimeType }) });
		}
	}
	const contexts: Context[] = [];
	let sound = false;
	let now = 0;
	const frames: (() => void)[] = [];
	class Context {
		static failure = false;
		state = 'running';
		constructor() {
			contexts.push(this);
		}
		close = vi.fn(async (): Promise<void> => {
			this.state = 'closed';
		});
		createMediaStreamSource(): { connect: () => void } {
			return { connect: () => {} };
		}
		createAnalyser() {
			if (Context.failure) throw new Error('analyser refused');
			return {
				minDecibels: -55,
				maxDecibels: -30,
				frequencyBinCount: 1,
				fftSize: 1,
				getByteTimeDomainData: (data: Uint8Array): void => {
					data.fill(128);
				},
				getByteFrequencyData: (data: Uint8Array): void => {
					data.fill(sound ? 1 : 0);
				}
			};
		}
	}
	let mount: () => Promise<void> | void = () => {};
	let destroy: () => Promise<void> | void = () => {};
	const lock = {
		released: false,
		release: vi.fn(async (): Promise<void> => {
			lock.released = true;
		}),
		addEventListener: vi.fn()
	};
	const context = {
		$showCallOverlay: true,
		destroyed: false,
		audioStream: null as typeof stream | null,
		mediaRecorder: null as Recorder | null,
		audioContext: null as Context | null,
		audioChunks: [] as Blob[],
		audioStreamRequest: 0,
		callRequest: 0,
		startingRecording: false,
		pendingTranscriptions: 0,
		confirmed: false,
		hasStartedSpeaking: false,
		muted: false,
		assistantSpeaking: false,
		loading: false,
		emoji: null,
		cameraStream: null,
		files: [],
		rmsLevel: 0,
		MIN_DECIBELS: -55,
		wakeLock: null as typeof lock | null,
		navigator: {
			mediaDevices: { getUserMedia: vi.fn(async () => stream) },
			wakeLock: { request: vi.fn(async () => lock) }
		},
		MediaRecorder: Recorder,
		AudioContext: Context,
		Blob,
		window: {
			requestAnimationFrame: vi.fn((callback: () => void) => {
				frames.push(callback);
				return frames.length;
			})
		},
		Date: { now: () => now },
		console: { log: vi.fn(), error: vi.fn() },
		toast: { error: vi.fn() },
		$i18n: { t: (s: string): string => s },
		$settings: {},
		localStorage: { token: 'fixture' },
		tick: async (): Promise<void> => {},
		blobToFile: (blob: Blob, name: string) => ({ blob, name }),
		transcribeAudio: vi
			.fn<[string, { blob: Blob; name: string }, string?], Promise<{ text: string }>>()
			.mockResolvedValue({ text: 'complete phrase' }),
		submitPrompt: vi
			.fn<[string, { _raw?: boolean }?], Promise<void>>()
			.mockResolvedValue(undefined),
		stopAllAudio: vi.fn(async (): Promise<void> => {}),
		stopCamera: vi.fn(),
		takeScreenshot: vi.fn(),
		$model: null,
		$models: [],
		modelId: 'fixture',
		model: null,
		eventTarget: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
		document: {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			visibilityState: 'visible'
		},
		handleKeydown: () => {},
		chatStartHandler: () => {},
		chatEventHandler: () => {},
		chatFinishHandler: () => {},
		audioAbortController: { abort: vi.fn() },
		showCallOverlay: {
			set: vi.fn((value: boolean): void => {
				context.$showCallOverlay = value;
			})
		},
		dispatch: vi.fn(),
		onMount: (fn: typeof mount): void => {
			mount = fn;
		},
		onDestroy: (fn: typeof destroy): void => {
			destroy = fn;
		}
	};
	const presentNames = names.filter((n) =>
		declarations.some((d) => d.startsWith(`const ${n} `) || d.startsWith(`const ${n}=`))
	);
	const api = runInNewContext(
		ts.transpileModule(
			`${declarations.join('\n')}\n${hooks.join('\n')}\n({${presentNames.join(',')}})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		startRecording: () => Promise<void>;
		stopAudioStream: () => void | Promise<void>;
		toggleMute: () => void;
		transcribeHandler: (blob: Blob) => Promise<void>;
		setWakeLock: () => Promise<void>;
		endCall: () => void;
	};
	return {
		api,
		context,
		track,
		stream,
		recorders,
		contexts,
		Recorder,
		Context,
		lock,
		mount: () => mount(),
		destroy: () => destroy(),
		frame: (hasSound: boolean, time: number): void => {
			sound = hasSound;
			now = time;
			const callback = frames.shift();
			if (!callback) throw new Error('No frame');
			callback();
		}
	};
};

it('closes a call before delayed permission; late stream cannot record', async () => {
	const t = rig();
	const permission = deferred<typeof t.stream>();
	t.context.navigator.mediaDevices.getUserMedia.mockReturnValue(permission.promise);
	const pending = t.api.startRecording();
	t.context.$showCallOverlay = false;
	t.context.destroyed = true;
	await t.api.stopAudioStream();
	permission.resolve(t.stream);
	await pending;
	expect(t.track.readyState).toBe('ended');
	expect(t.recorders).toHaveLength(0);
	expect(t.contexts).toHaveLength(0);
});

it('releases tracks before async playback cleanup when unmounted', async () => {
	const t = rig();
	await t.api.startRecording();
	const playback = deferred<void>();
	t.context.stopAllAudio.mockReturnValue(playback.promise);
	const cleanup = t.destroy();
	expect(t.track.readyState).toBe('ended');
	playback.resolve();
	await cleanup;
	expect(t.contexts.every((c) => c.state === 'closed')).toBe(true);
});

it.each(['permission', 'constructor', 'analyser', 'start'])(
	'recovers from %s failure without leaking resources',
	async (failure) => {
		const t = rig();
		if (failure === 'permission')
			t.context.navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('denied'));
		if (failure === 'constructor') t.Recorder.failure = failure;
		if (failure === 'analyser') t.Context.failure = true;
		if (failure === 'start') t.Recorder.failure = failure;
		await t.api.startRecording();
		if (failure === 'start') t.frame(true, 0);
		expect(t.context.mediaRecorder).toBeNull();
		expect(t.context.audioStream).toBeNull();
		if (failure !== 'permission') expect(t.track.readyState).toBe('ended');
		expect(t.contexts.every((c) => c.state === 'closed')).toBe(true);
		t.Recorder.failure = '';
		t.Context.failure = false;
		t.track.readyState = 'live';
		await t.api.startRecording();
		expect(t.context.mediaRecorder).toBe(t.recorders.at(-1));
		expect(t.track.readyState).toBe('live');
		await t.api.stopAudioStream();
	}
);

it('keeps final native bytes and submits both successive phrases while STT overlaps', async () => {
	const t = rig();
	const transcript = deferred<{ text: string }>();
	const entered = deferred<void>();
	t.context.transcribeAudio.mockImplementationOnce(() => {
		entered.resolve();
		return transcript.promise;
	});
	await t.api.startRecording();
	t.frame(true, 0);
	t.frame(false, 2100);
	const first = t.recorders[0];
	first.data('a'.repeat(100));
	first.data('final');
	const stopped = first.onstop?.();
	await entered.promise;
	expect(t.recorders).toHaveLength(2);
	expect(t.context.loading).toBe(true);
	const second = t.recorders[1];
	t.frame(true, 2200);
	t.frame(false, 4400);
	second.data('b'.repeat(101));
	await second.onstop?.();
	expect(t.context.loading).toBe(true);
	transcript.resolve({ text: 'first phrase' });
	await stopped;
	expect(t.context.submitPrompt.mock.calls.map((c) => c[0])).toEqual([
		'complete phrase',
		'first phrase'
	]);
	const file = t.context.transcribeAudio.mock.calls[0][1] as unknown as {
		blob: Blob;
		name: string;
	};
	expect(await file.blob.text()).toBe('a'.repeat(100) + 'final');
	expect(file.blob.type).toBe('audio/webm');
	expect(file.name).toBe('recording.webm');
	expect(t.context.loading).toBe(false);
	expect(t.contexts[0].state).toBe('closed');
	await t.api.stopAudioStream();
});

it('old stop callback and queued animation frame cannot alter newer recorder', async () => {
	const t = rig();
	await t.api.startRecording();
	const first = t.recorders[0];
	const lateStop = first.onstop;
	await t.api.stopAudioStream();
	t.track.readyState = 'live';
	await t.api.startRecording();
	const second = t.recorders[1];
	await lateStop?.();
	t.frame(true, 0);
	expect(t.context.mediaRecorder).toBe(second);
	expect(second.state).toBe('inactive');
	expect(t.track.readyState).toBe('live');
	await t.api.stopAudioStream();
});

it.each(['result', 'error'])('drops late STT %s after closing the call', async (outcome) => {
	const t = rig();
	const transcript = deferred<{ text: string }>();
	const entered = deferred<void>();
	t.context.transcribeAudio.mockImplementation(() => {
		entered.resolve();
		return transcript.promise;
	});
	const pending = t.api.transcribeHandler(new Blob(['a'.repeat(101)], { type: 'audio/webm' }));
	await entered.promise;
	t.destroy();
	if (outcome === 'result') transcript.resolve({ text: 'late phrase' });
	else transcript.reject(new Error('Late STT refusal'));
	await pending;
	expect(t.context.submitPrompt).not.toHaveBeenCalled();
	expect(t.context.toast.error).not.toHaveBeenCalled();
});

it('mute discards a partial phrase and prepares the next recording', async () => {
	const t = rig();
	await t.api.startRecording();
	t.frame(true, 0);
	const first = t.recorders[0];
	first.data('partial'.repeat(30));
	t.api.toggleMute();
	first.data('final');
	await first.onstop?.();
	expect(t.context.submitPrompt).not.toHaveBeenCalled();
	expect(t.recorders).toHaveLength(2);
	expect(t.context.muted).toBe(true);
	await t.api.stopAudioStream();
});

it('mount starts recording without waiting for wake lock; teardown removes listeners and releases late lock', async () => {
	const t = rig();
	const permission = deferred<typeof t.lock>();
	t.context.navigator.wakeLock.request.mockReturnValue(permission.promise);
	const mounted = t.mount();
	await Promise.resolve();
	expect(t.context.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
	const cleanup = t.destroy();
	permission.resolve(t.lock);
	await mounted;
	await cleanup;
	await new Promise(setImmediate);
	expect(t.lock.release).toHaveBeenCalledTimes(1);
	for (const event of ['keydown', 'visibilitychange'])
		expect(
			t.context.document.removeEventListener.mock.calls.some((call) => call[0] === event)
		).toBe(true);
	expect(t.track.readyState).toBe('ended');
});

it('starts only one recorder while permission is pending and handles native recorder errors', async () => {
	const t = rig();
	const permission = deferred<typeof t.stream>();
	t.context.navigator.mediaDevices.getUserMedia.mockReturnValue(permission.promise);
	const pending = t.api.startRecording();
	await t.api.startRecording();
	expect(t.context.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
	permission.resolve(t.stream);
	await pending;
	expect(t.recorders).toHaveLength(1);
	t.recorders[0].onerror?.();
	expect(t.track.readyState).toBe('ended');
	expect(t.context.mediaRecorder).toBeNull();
	expect(t.contexts[0].state).toBe('closed');
});
