// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

// Actual component handlers with synthetic native audio and controlled provider replies.
const rig = () => {
	vi.useFakeTimers();
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
		'finishedMessages',
		'currentMessageId',
		'currentUtterance',
		'audioAbortController',
		'audioCache',
		'emojiCache',
		'messages',
		'getVoiceId',
		'speakSpeechSynthesisHandler',
		'playAudio',
		'stopAllAudio',
		'fetchAudio',
		'monitorAndPlayAudio',
		'chatStartHandler',
		'chatEventHandler',
		'chatFinishHandler',
		'clearAudioCache',
		'endCall',
		'takeScreenshot'
	];
	const code = parsed.statements
		.filter(ts.isVariableStatement)
		.flatMap((s) => [...s.declarationList.declarations])
		.filter((d) => names.includes(d.name.getText(parsed)))
		.map((d) => `let ${d.getText(parsed)};`)
		.join('\n');
	class AudioElement {
		src = '';
		muted = false;
		currentTime = 0;
		playbackRate = 1;
		onended: (() => void) | null = null;
		onerror: (() => void) | null = null;
		play = vi.fn(async (): Promise<void> => {});
		pause = vi.fn();
	}
	const audio = new AudioElement();
	const utterances: Utterance[] = [];
	class Utterance {
		rate = 1;
		onend: (() => void) | null = null;
		onerror: (() => void) | null = null;
		constructor(public text: string) {
			utterances.push(this);
		}
	}
	const context = {
		AbortController,
		HTMLAudioElement: AudioElement,
		Audio: class extends AudioElement {
			constructor(url: string) {
				super();
				this.src = url;
			}
		},
		SpeechSynthesisUtterance: Utterance,
		destroyed: false,
		$showCallOverlay: true,
		assistantSpeaking: false,
		chatStreaming: false,
		emoji: null,
		model: null,
		modelId: 'model',
		chatId: 'chat',
		$settings: { audio: { tts: { engine: '', playbackRate: 1 } }, showEmojiInCall: false },
		$config: { audio: { tts: { engine: 'openai', voice: 'voice' } } },
		$TTSWorker: { generate: vi.fn(async (): Promise<string> => 'blob:kokoro') },
		speechSynthesis: { getVoices: vi.fn(() => []), speak: vi.fn(), cancel: vi.fn() },
		document: {
			getElementById: vi.fn((id: string): object | null => (id === 'audioElement' ? audio : null))
		},
		callRequest: 0,
		stopAudioStream: vi.fn(),
		stopCamera: vi.fn(),
		releaseWakeLock: vi.fn(),
		showCallOverlay: { set: vi.fn() },
		dispatch: vi.fn(),
		localStorage: { token: 'fixture' },
		synthesizeOpenAISpeech: vi.fn(async () => ({
			blob: async (): Promise<Blob> => new Blob(['audio'])
		})),
		generateEmoji: vi.fn(async (): Promise<string> => '🙂'),
		URL: { createObjectURL: vi.fn(() => 'blob:server'), revokeObjectURL: vi.fn() },
		stopResponse: vi.fn(async (): Promise<void> => {}),
		console: { log: vi.fn(), error: vi.fn() },
		toast: { error: vi.fn() },
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval
	};
	const api = runInNewContext(
		ts.transpileModule(
			code +
				'\n({endCall, takeScreenshot, playAudio, speakSpeechSynthesisHandler, stopAllAudio, fetchAudio, monitorAndPlayAudio, chatStartHandler, chatEventHandler, chatFinishHandler, get cache(){return audioCache}, get signal(){return audioAbortController.signal}})',
			{ compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }
		).outputText,
		context
	) as {
		playAudio: (audio: AudioElement) => Promise<void>;
		speakSpeechSynthesisHandler: (text: string) => Promise<void>;
		stopAllAudio: () => Promise<void>;
		endCall: () => void;
		takeScreenshot: () => string | undefined;
		fetchAudio: (text: string) => Promise<unknown>;
		monitorAndPlayAudio: (id: string, signal: AbortSignal) => Promise<void>;
		chatStartHandler: (event: { detail: { id: string } }) => Promise<void> | void;
		chatEventHandler: (event: { detail: { id: string; content: string } }) => Promise<void> | void;
		chatFinishHandler: (event: { detail: { id: string } }) => Promise<void> | void;
		cache: Map<string, unknown>;
		signal: AbortSignal;
	};
	return { api, context, audio, utterances };
};

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
});

const settled = async (promise: Promise<unknown>): Promise<boolean> => {
	let done = false;
	void promise.then(() => {
		done = true;
	});
	await vi.advanceTimersByTimeAsync(500);
	return done;
};

it('settles when the shared audio element is absent', async () => {
	const r = rig();
	r.context.document.getElementById.mockReturnValue(null);
	expect(await settled(r.api.playAudio(r.audio))).toBe(true);
});
it('settles a rejected play and releases handlers', async () => {
	const r = rig();
	r.audio.play.mockRejectedValue(new Error('play refused'));
	expect(await settled(r.api.playAudio(r.audio))).toBe(true);
	expect(r.audio.onended).toBeNull();
});
it('settles on media error', async () => {
	const r = rig();
	const p = r.api.playAudio(r.audio);
	r.audio.onerror?.();
	expect(await settled(p)).toBe(true);
});
it('settles interruption and never unmutes a late play', async () => {
	const r = rig();
	const late = deferred<void>();
	r.audio.play.mockReturnValue(late.promise);
	const p = r.api.playAudio(r.audio);
	await r.api.stopAllAudio();
	late.resolve();
	expect(await settled(p)).toBe(true);
	expect(r.audio.muted).toBe(true);
	expect(r.api.signal.aborted).toBe(true);
});
it('settles natural playback and releases handlers', async () => {
	const r = rig();
	const p = r.api.playAudio(r.audio);
	r.audio.onended?.();
	expect(await settled(p)).toBe(true);
	expect(r.audio.onended).toBeNull();
});
it('uses the native default voice without a polling leak', async () => {
	const r = rig();
	const p = r.api.speakSpeechSynthesisHandler('hello');
	await vi.advanceTimersByTimeAsync(500);
	expect(r.context.speechSynthesis.speak).toHaveBeenCalledTimes(1);
	r.utterances[0]?.onend?.();
	expect(await settled(p)).toBe(true);
	expect(vi.getTimerCount()).toBe(0);
});
it('settles native speech errors and interruption', async () => {
	const r = rig();
	const first = r.api.speakSpeechSynthesisHandler('first');
	await vi.advanceTimersByTimeAsync(200);
	r.utterances[0]?.onerror?.();
	expect(await settled(first)).toBe(true);
	const second = r.api.speakSpeechSynthesisHandler('second');
	await r.api.stopAllAudio();
	expect(await settled(second)).toBe(true);
	expect(vi.getTimerCount()).toBe(0);
});
it('records failed synthesis so the finished queue can drain', async () => {
	const r = rig();
	r.context.synthesizeOpenAISpeech.mockRejectedValue(new Error('provider refused'));
	await r.api.fetchAudio('failed');
	expect(r.api.cache.has('failed')).toBe(true);
	expect(r.api.cache.get('failed')).toBeNull();
});
it('discards late server audio after interruption before creating a URL', async () => {
	const r = rig();
	const late = deferred<{ blob: () => Promise<Blob> }>();
	r.context.synthesizeOpenAISpeech.mockReturnValue(late.promise);
	const p = r.api.fetchAudio('late');
	await r.api.stopAllAudio();
	late.resolve({ blob: async () => new Blob(['late']) });
	await p;
	expect(r.api.cache.size).toBe(0);
	expect(r.context.URL.createObjectURL).not.toHaveBeenCalled();
});
it('revokes generated URLs when replacing a message and starting a fresh queue', async () => {
	const r = rig();
	await r.api.fetchAudio('hello');
	await r.api.chatStartHandler({ detail: { id: 'next' } });
	expect(r.context.URL.revokeObjectURL).toHaveBeenCalledWith('blob:server');
	expect(r.api.cache.size).toBe(0);
	expect(r.api.signal.aborted).toBe(false);
	await r.api.stopAllAudio();
});
it('revokes late Kokoro URLs and keeps closed audio out of cache', async () => {
	const r = rig();
	r.context.$settings.audio.tts.engine = 'browser-kokoro';
	const late = deferred<string>();
	r.context.$TTSWorker.generate.mockReturnValue(late.promise);
	const p = r.api.fetchAudio('late');
	await r.api.stopAllAudio();
	late.resolve('blob:late');
	await p;
	expect(r.api.cache.size).toBe(0);
	expect(r.context.URL.revokeObjectURL).toHaveBeenCalledWith('blob:late');
});
it('does not let an old finish event mark a new response as finished', async () => {
	const r = rig();
	await r.api.chatStartHandler({ detail: { id: 'new' } });
	await r.api.chatFinishHandler({ detail: { id: 'old' } });
	expect(r.context.chatStreaming).toBe(true);
	await r.api.stopAllAudio();
});

it('finishes an empty response without waiting for a first sentence', async () => {
	const r = rig();
	await r.api.chatStartHandler({ detail: { id: 'empty' } });
	await r.api.chatFinishHandler({ detail: { id: 'empty' } });
	await vi.advanceTimersByTimeAsync(500);
	expect(r.context.assistantSpeaking).toBe(false);
	expect(vi.getTimerCount()).toBe(0);
});

it('drains a failed sentence and plays the next successful sentence', async () => {
	const r = rig();
	r.context.synthesizeOpenAISpeech.mockRejectedValueOnce(new Error('first refused'));
	await r.api.chatStartHandler({ detail: { id: 'message' } });
	await r.api.chatEventHandler({ detail: { id: 'message', content: 'first' } });
	await r.api.chatEventHandler({ detail: { id: 'message', content: 'second' } });
	await r.api.chatFinishHandler({ detail: { id: 'message' } });
	await vi.advanceTimersByTimeAsync(500);
	expect(r.audio.play).toHaveBeenCalledTimes(1);
	r.audio.onended?.();
	await vi.advanceTimersByTimeAsync(500);
	expect(r.context.assistantSpeaking).toBe(false);
	expect(vi.getTimerCount()).toBe(0);
	await r.api.stopAllAudio();
});

it('plays Kokoro audio even when the server uses native speech', async () => {
	const r = rig();
	r.context.$settings.audio.tts.engine = 'browser-kokoro';
	r.context.$config.audio.tts.engine = '';
	await r.api.chatStartHandler({ detail: { id: 'kokoro' } });
	await r.api.chatEventHandler({ detail: { id: 'kokoro', content: 'hello' } });
	await vi.advanceTimersByTimeAsync(500);
	expect(r.audio.src).toBe('blob:kokoro');
	expect(r.audio.play).toHaveBeenCalledTimes(1);
	expect(r.context.speechSynthesis.speak).not.toHaveBeenCalled();
	await r.api.stopAllAudio();
	await vi.advanceTimersByTimeAsync(500);
	expect(vi.getTimerCount()).toBe(0);
});

it('interrupts queued sentences and ignores later events from that response', async () => {
	const r = rig();
	await r.api.chatStartHandler({ detail: { id: 'old' } });
	await r.api.chatEventHandler({ detail: { id: 'old', content: 'first' } });
	await r.api.chatEventHandler({ detail: { id: 'old', content: 'second' } });
	await vi.advanceTimersByTimeAsync(500);
	await r.api.stopAllAudio();
	await r.api.chatEventHandler({ detail: { id: 'old', content: 'third' } });
	await vi.advanceTimersByTimeAsync(500);
	expect(r.audio.play).toHaveBeenCalledTimes(1);
	expect(r.context.synthesizeOpenAISpeech).toHaveBeenCalledTimes(2);
	expect(vi.getTimerCount()).toBe(0);
});

it('deduplicates a pending sentence and rejects a late emoji after interruption', async () => {
	const r = rig();
	r.context.$settings.showEmojiInCall = true;
	const late = deferred<string>();
	r.context.generateEmoji.mockReturnValue(late.promise);
	const p = r.api.fetchAudio('same');
	await r.api.fetchAudio('same');
	expect(r.context.generateEmoji).toHaveBeenCalledTimes(1);
	await r.api.stopAllAudio();
	late.resolve('🙂');
	await p;
	expect(r.api.cache.size).toBe(0);
	expect(r.context.synthesizeOpenAISpeech).not.toHaveBeenCalled();
});

it('releases a URL received after destruction', async () => {
	const r = rig();
	r.context.$settings.audio.tts.engine = 'browser-kokoro';
	const late = deferred<string>();
	r.context.$TTSWorker.generate.mockReturnValue(late.promise);
	const p = r.api.fetchAudio('late');
	r.context.destroyed = true;
	late.resolve('blob:destroyed');
	await p;
	expect(r.context.URL.revokeObjectURL).toHaveBeenCalledWith('blob:destroyed');
	expect(r.audio.play).not.toHaveBeenCalled();
});

it('handles synchronous playback and native synthesis refusal', async () => {
	const r = rig();
	r.audio.play.mockImplementation(() => {
		throw new Error('sync play refused');
	});
	expect(await settled(r.api.playAudio(r.audio))).toBe(true);
	r.context.speechSynthesis.speak.mockImplementation(() => {
		throw new Error('speech refused');
	});
	expect(await settled(r.api.speakSpeechSynthesisHandler('hello'))).toBe(true);
});

it('ending a call settles active playback before any component destruction', async () => {
	const r = rig();
	const p = r.api.playAudio(r.audio);
	r.api.endCall();
	expect(await settled(p)).toBe(true);
	expect(r.api.signal.aborted).toBe(true);
	expect(r.context.showCallOverlay.set).toHaveBeenCalledWith(false);
	expect(r.context.stopAudioStream).toHaveBeenCalledTimes(1);
});

it('contains response-stop rejection while still cancelling playback', async () => {
	const r = rig();
	r.context.chatStreaming = true;
	r.context.stopResponse.mockRejectedValue(new Error('stop refused'));
	const p = r.api.playAudio(r.audio);
	await r.api.stopAllAudio();
	expect(await settled(p)).toBe(true);
	expect(r.context.console.error).toHaveBeenCalled();
});

it('skips a camera snapshot when the video or drawing context is missing', () => {
	const r = rig();
	const canvas = { getContext: vi.fn((): object | null => null) };
	r.context.document.getElementById.mockImplementation((id) =>
		id === 'camera-canvas' ? canvas : null
	);
	expect(r.api.takeScreenshot()).toBeUndefined();
	canvas.getContext.mockReturnValue({ drawImage: vi.fn() });
	expect(r.api.takeScreenshot()).toBeUndefined();
});

it('takes a ready video snapshot without logging image content', () => {
	const r = rig();
	const video = { videoWidth: 640, videoHeight: 480 };
	const drawImage = vi.fn();
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => ({ drawImage }),
		toDataURL: vi.fn(() => 'data:image/png;base64,fixture')
	};
	r.context.document.getElementById.mockImplementation((id) =>
		id === 'camera-canvas' ? canvas : video
	);
	expect(r.api.takeScreenshot()).toBe('data:image/png;base64,fixture');
	expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480);
	expect(r.context.console.log).not.toHaveBeenCalled();
});
