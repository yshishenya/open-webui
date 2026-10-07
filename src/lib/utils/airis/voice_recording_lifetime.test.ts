// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const deferred = <T>() => {
	let resolve: (value: T) => void = () => {
		throw new Error('Missing resolver');
	};
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

const rig = (displayMedia = false) => {
	const source = readFileSync('src/lib/components/chat/MessageInput/VoiceRecording.svelte', 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing component script');
	const parsed = ts.createSourceFile(
		'voice.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const names = [
		'startRecording',
		'stopRecording',
		'cancelRecording',
		'confirmRecording',
		'onStopHandler',
		'requestWakeLock',
		'releaseWakeLock',
		'startDurationCounter',
		'stopDurationCounter'
	];
	const declarations = parsed.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => [...statement.declarationList.declarations])
		.filter((declaration) => names.includes(declaration.name.getText(parsed)))
		.map((declaration) => `const ${declaration.getText(parsed)};`);
	expect(declarations).toHaveLength(names.length);
	const destroy = parsed.statements
		.filter(ts.isExpressionStatement)
		.find(
			(statement) =>
				ts.isCallExpression(statement.expression) &&
				statement.expression.expression.getText(parsed) === 'onDestroy'
		);
	if (!destroy) throw new Error('Missing destruction hook');
	const makeTracks = () =>
		[0, 1].map(() => {
			const track = {
				readyState: 'live',
				stop: vi.fn((): void => {
					track.readyState = 'ended';
				})
			};
			return track;
		});
	const tracks = makeTracks();
	class Stream {
		tracks: typeof tracks = [];
		constructor(initial: typeof tracks = []) {
			this.tracks = [...initial];
		}
		getTracks(): typeof tracks {
			return this.tracks;
		}
		getAudioTracks(): typeof tracks {
			return this.tracks.slice(0, 1);
		}
		getVideoTracks(): typeof tracks {
			return this.tracks.slice(1);
		}
		addTrack(track: (typeof tracks)[number]): void {
			this.tracks.push(track);
		}
	}
	const acquired = new Stream();
	acquired.tracks = tracks;
	const recognizers: Recognition[] = [];
	class Recognition {
		continuous = false;
		onresult:
			| ((event: {
					results: Record<number, Record<number, { transcript: string }>>;
			  }) => Promise<void>)
			| null = null;
		onend: (() => void) | null = null;
		onerror: ((event: { error: string }) => void) | null = null;
		constructor() {
			recognizers.push(this);
		}
		start(): void {}
		stop = vi.fn();
	}
	const recorders: Recorder[] = [];
	class Recorder {
		static failure: string | null = null;
		static isTypeSupported(): boolean {
			return true;
		}
		state = 'inactive';
		mimeType = 'audio/webm';
		onstart: (() => Promise<void> | void) | null = null;
		onstop: (() => Promise<void> | void) | null = null;
		ondataavailable: ((event: { data: Blob }) => void) | null = null;
		constructor() {
			if (Recorder.failure === 'constructor') throw new Error('constructor refused');
			recorders.push(this);
		}
		start(): void {
			if (Recorder.failure === 'start') throw new Error('start refused');
			this.state = 'recording';
		}
		stop(): void {
			if (this.state === 'inactive') throw new Error('already inactive');
			this.state = 'inactive';
		}
		data(text: string): void {
			this.ondataavailable?.({ data: new Blob([text], { type: this.mimeType }) });
		}
	}
	let destruction: () => void = () => {
		throw new Error('Missing hook');
	};
	const lock = {
		released: false,
		release: vi.fn(async (): Promise<void> => {}),
		addEventListener: vi.fn()
	};
	const context = {
		recording: true,
		loading: false,
		confirmed: false,
		destroyed: false,
		recordingRequest: 0,
		stream: null as Stream | null,
		mediaRecorder: null as Recorder | null,
		speechRecognition: null,
		audioChunks: [] as Blob[],
		audioContext: null as { close: () => Promise<void> } | null,
		recognitionTimeout: undefined,
		wakeLock: null as typeof lock | null,
		durationCounter: null,
		durationSeconds: 0,
		visualizerData: [],
		VISUALIZER_BUFFER_LENGTH: 300,
		transcription: '',
		displayMedia,
		transcribe: false,
		echoCancellation: true,
		noiseSuppression: true,
		autoGainControl: true,
		navigator: {
			mediaDevices: {
				getUserMedia: vi.fn(async () => acquired),
				getDisplayMedia: vi.fn(async () => acquired)
			},
			wakeLock: { request: vi.fn(async () => lock) }
		},
		MediaStream: Stream,
		MediaRecorder: Recorder,
		Blob,
		console: { log: vi.fn(), error: vi.fn() },
		$i18n: { t: (value: string): string => value },
		$config: { audio: { stt: { engine: '' } } },
		$settings: {},
		localStorage: { token: 'fixture' },
		toast: { error: vi.fn() },
		tick: async (): Promise<void> => {},
		dayjs: () => ({ format: () => 'fixture' }),
		blobToFile: (blob: Blob, name: string): File => new File([blob], name, { type: blob.type }),
		onConfirm: vi.fn(),
		onCancel: vi.fn(),
		transcribeAudio: vi.fn(),
		analyseAudio: vi.fn(),
		setInterval: vi.fn(() => 1),
		clearInterval: vi.fn(),
		setTimeout: vi.fn(() => 1),
		clearTimeout: vi.fn(),
		window: { removeEventListener: vi.fn(), SpeechRecognition: Recognition },
		document: { removeEventListener: vi.fn(), getElementById: () => null },
		resizeObserver: { disconnect: vi.fn() },
		handleKeyDown: () => {},
		handleVisibilityChange: () => {},
		onDestroy: (callback: () => void): void => {
			destruction = callback;
		}
	};
	const code = ts.transpileModule(
		`${declarations.join('\n')}\n${destroy.getText(parsed)}\n({${names.join(',')}})`,
		{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
	).outputText;
	const api = runInNewContext(code, context) as {
		startRecording: () => Promise<void>;
		stopRecording: () => Promise<void>;
		cancelRecording: () => Promise<void>;
		confirmRecording: () => Promise<void>;
		releaseWakeLock: () => Promise<void>;
		requestWakeLock: () => Promise<void>;
	};
	return {
		context,
		api,
		tracks,
		acquired,
		fresh: () => new Stream(makeTracks()),
		recorders,
		recognizers,
		Recorder,
		lock,
		destroy: () => destruction()
	};
};

it.each([false, true])(
	'failed recorder initialization releases all owned tracks: screen=%s',
	async (screen) => {
		for (const failure of ['constructor', 'start']) {
			const r = rig(screen);
			r.Recorder.failure = failure;
			await expect(r.api.startRecording()).resolves.toBeUndefined();
			r.tracks.forEach((track) => expect(track.readyState).toBe('ended'));
			expect(r.context.loading).toBe(false);
			expect(r.context.recording).toBe(false);
			expect(r.context.stream).toBeNull();
			expect(r.context.onConfirm).not.toHaveBeenCalled();
			r.Recorder.failure = null;
			r.context.recording = true;
			const fresh = r.fresh();
			const acquire = screen
				? r.context.navigator.mediaDevices.getDisplayMedia
				: r.context.navigator.mediaDevices.getUserMedia;
			acquire.mockResolvedValue(fresh);
			await r.api.startRecording();
			expect(fresh.getTracks().some((track) => track.readyState === 'live')).toBe(true);
			expect(r.recorders.at(-1)?.state).toBe('recording');
			await r.api.cancelRecording();
		}
	}
);

it.each(['cancel', 'destroy'])('late permission cannot reopen a %s recording', async (mode) => {
	const r = rig();
	const permission = deferred<typeof r.acquired>();
	r.context.navigator.mediaDevices.getUserMedia.mockReturnValue(permission.promise);
	const pending = r.api.startRecording();
	if (mode === 'cancel') {
		r.context.recording = false;
		await r.api.cancelRecording();
	} else r.destroy();
	permission.resolve(r.acquired);
	await pending;
	r.tracks.forEach((track) => expect(track.readyState).toBe('ended'));
	expect(r.recorders).toHaveLength(0);
	expect(r.context.stream).toBeNull();
	expect(r.context.setInterval).not.toHaveBeenCalled();
	expect(r.context.onConfirm).not.toHaveBeenCalled();
});

it('native final data is preserved and repeated confirmation is safe', async () => {
	const r = rig();
	await r.api.startRecording();
	const recorder = r.recorders[0];
	await recorder.onstart?.();
	recorder.data('prefix');
	await r.api.confirmRecording();
	await expect(r.api.confirmRecording()).resolves.toBeUndefined();
	expect(r.context.onConfirm).not.toHaveBeenCalled();
	recorder.data('final');
	await recorder.onstop?.();
	expect(r.context.onConfirm).toHaveBeenCalledTimes(1);
	const data = r.context.onConfirm.mock.calls[0][0] as { blob: Blob; file: File };
	expect(await data.blob.text()).toBe('prefixfinal');
	expect(await data.file.text()).toBe('prefixfinal');
	r.tracks.forEach((track) => expect(track.readyState).toBe('ended'));
});

it('canceled native callbacks cannot reset a newer recording', async () => {
	const r = rig();
	await r.api.startRecording();
	const old = r.recorders[0];
	await old.onstart?.();
	await r.api.cancelRecording();
	r.context.recording = true;
	r.context.navigator.mediaDevices.getUserMedia.mockResolvedValue(r.fresh());
	await r.api.startRecording();
	const next = r.recorders[1];
	await next.onstart?.();
	old.data('discard');
	await old.onstop?.();
	expect(r.context.recording).toBe(true);
	expect(r.context.mediaRecorder).toBe(next);
	expect(r.context.onConfirm).not.toHaveBeenCalled();
	await r.api.cancelRecording();
});

it('late wake lock is released and old release cannot clear a new owner', async () => {
	const r = rig();
	const lock = deferred<typeof r.lock>();
	r.context.navigator.wakeLock.request.mockReturnValue(lock.promise);
	await r.api.startRecording();
	const started = r.recorders[0].onstart?.();
	r.destroy();
	lock.resolve(r.lock);
	await started;
	expect(r.lock.release).toHaveBeenCalledTimes(1);
	expect(r.context.analyseAudio).not.toHaveBeenCalled();
	const released = deferred<void>();
	const old = { ...r.lock, release: vi.fn(() => released.promise) };
	r.context.wakeLock = old;
	const pending = r.api.releaseWakeLock();
	const next = { ...r.lock };
	r.context.wakeLock = next;
	released.resolve();
	await pending;
	expect(r.context.wakeLock).toBe(next);
});

it('analyser failure and spontaneous native stop release the current recording', async () => {
	for (const failure of ['analyse', 'native-stop']) {
		const r = rig();
		const close = vi.fn(async (): Promise<void> => {});
		if (failure === 'analyse')
			r.context.analyseAudio.mockImplementation(() => {
				r.context.audioContext = { close };
				throw new Error('analysis refused');
			});
		await r.api.startRecording();
		const recorder = r.recorders[0];
		await recorder.onstart?.();
		if (failure === 'native-stop') {
			recorder.state = 'inactive';
			await recorder.onstop?.();
		}
		r.tracks.forEach((track) => expect(track.readyState).toBe('ended'));
		expect(r.context.recording).toBe(false);
		expect(r.context.loading).toBe(false);
		expect(r.context.stream).toBeNull();
		expect(r.context.mediaRecorder).toBeNull();
		expect(r.context.onConfirm).not.toHaveBeenCalled();
		expect(r.lock.release).toHaveBeenCalledTimes(1);
		if (failure === 'analyse') expect(close).toHaveBeenCalledTimes(1);
	}
});

it.each(['cancel', 'destroy'])('a pending transcript cannot insert text after %s', async (mode) => {
	const r = rig();
	r.context.transcribe = true;
	const reply = deferred<{ text: string }>();
	const entered = deferred<void>();
	r.context.transcribeAudio.mockImplementation(() => {
		entered.resolve();
		return reply.promise;
	});
	await r.api.startRecording();
	const recorder = r.recorders[0];
	await recorder.onstart?.();
	recorder.data('recorded');
	await r.api.confirmRecording();
	const pending = recorder.onstop?.();
	await entered.promise;
	if (mode === 'cancel') await r.api.cancelRecording();
	else r.destroy();
	reply.resolve({ text: 'obsolete transcript' });
	await pending;
	expect(r.context.onConfirm).not.toHaveBeenCalled();
	r.tracks.forEach((track) => expect(track.readyState).toBe('ended'));
});

it('released native wake lock can be reacquired', async () => {
	const r = rig();
	r.context.wakeLock = { ...r.lock, released: true };
	await r.api.requestWakeLock();
	expect(r.context.wakeLock).toBe(r.lock);
	expect(r.lock.release).not.toHaveBeenCalled();
});

it.each(['recognition-first', 'recorder-first', 'cancel'])(
	'web recognition confirms once across native terminal ordering: %s',
	async (mode) => {
		const r = rig();
		r.context.transcribe = true;
		r.context.$config.audio.stt.engine = 'web';
		await r.api.startRecording();
		const recorder = r.recorders[0];
		const recognition = r.recognizers[0];
		await recorder.onstart?.();
		await recognition.onresult?.({ results: { 0: { 0: { transcript: 'Recorded words' } } } });
		const ended = recognition.onend;
		if (mode === 'recognition-first') ended?.();
		else if (mode === 'cancel') await r.api.cancelRecording();
		else await r.api.confirmRecording();
		recorder.data('final');
		await recorder.onstop?.();
		ended?.();
		await recorder.onstop?.();
		expect(r.context.onConfirm).toHaveBeenCalledTimes(mode === 'cancel' ? 0 : 1);
		if (mode !== 'cancel')
			expect(r.context.onConfirm).toHaveBeenCalledWith({ text: 'Recorded words' });
		expect(r.context.transcribeAudio).not.toHaveBeenCalled();
		r.tracks.forEach((track) => expect(track.readyState).toBe('ended'));
		expect(r.context.recording).toBe(false);
	}
);

it('confirmation releases a pending wake lock without restarting analysis', async () => {
	const r = rig();
	const lock = deferred<typeof r.lock>();
	r.context.navigator.wakeLock.request.mockReturnValue(lock.promise);
	await r.api.startRecording();
	const started = r.recorders[0].onstart?.();
	await r.api.confirmRecording();
	r.recorders[0].data('final');
	await r.recorders[0].onstop?.();
	lock.resolve(r.lock);
	await started;
	expect(r.lock.release).toHaveBeenCalledTimes(1);
	expect(r.context.analyseAudio).not.toHaveBeenCalled();
	expect(r.context.onConfirm).toHaveBeenCalledTimes(1);
});
