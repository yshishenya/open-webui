// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { synthesizeOpenAISpeech } from '$lib/apis/audio';
import type { OnStoppedCallback } from '$lib/utils/audio';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('$lib/constants', () => ({ AUDIO_API_BASE_URL: '/api/v1/audio' }));

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
const rig = () => {
	vi.useFakeTimers();
	const source = readFileSync('src/lib/components/chat/Messages/ResponseMessage.svelte', 'utf8');
	const script = parse(source).instance;
	if (!script) throw new Error('Missing script');
	const parsed = ts.createSourceFile(
		'response.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const names = ['stopAudio', 'getVoiceId', 'speak'];
	const declarations = parsed.statements
		.filter(ts.isVariableStatement)
		.flatMap((s) => [...s.declarationList.declarations])
		.filter((d) => names.includes(d.name.getText(parsed)))
		.map((d) => `const ${d.getText(parsed)};`);
	const hooks = parsed.statements
		.filter(ts.isExpressionStatement)
		.filter(
			(s) =>
				ts.isCallExpression(s.expression) && s.expression.expression.getText(parsed) === 'onDestroy'
		)
		.map((s) => s.getText(parsed));
	const queue = {
		id: null as string | null,
		onStopped: null as OnStoppedCallback | null,
		setId(id: string): void {
			if (this.id === id) return;
			this.id = id;
			this.onStopped?.({ event: 'id-change', id });
		},
		setPlaybackRate: vi.fn(),
		enqueue: vi.fn(),
		stop: vi.fn(() => {
			queue.onStopped?.({ event: 'stop', id: queue.id });
		})
	};
	const utterances: Utterance[] = [];
	class Utterance {
		rate = 1;
		voice?: { voiceURI: string };
		onend: (() => void) | null = null;
		onerror: (() => void) | null = null;
		constructor(public text: string) {
			utterances.push(this);
		}
	}
	const worker = {
		init: vi.fn(async (): Promise<void> => {}),
		generate: vi.fn(async (): Promise<string> => 'blob:kokoro')
	};
	let destroy: () => void = () => {};
	let urlId = 0;
	const response = {
		ok: true,
		blob: vi.fn(async (): Promise<Blob> => new Blob(['audio'])),
		json: vi.fn(async () => ({}))
	};
	const fetch = vi.fn(async (url: string, options: RequestInit) => {
		expect(url).toBe('/api/v1/audio/speech');
		expect(options.method).toBe('POST');
		return response;
	});
	vi.stubGlobal('fetch', fetch);
	const context = {
		AbortController,
		SpeechSynthesisUtterance: Utterance,
		Blob,
		speaking: false,
		loadingSpeech: false,
		speakAbort: null as AbortController | null,
		visibleResponseContent: 'First. Second.',
		model: null,
		message: { id: 'message' },
		$settings: {
			audio: { tts: { engine: '', playbackRate: 1, engineConfig: { dtype: 'fp32' } } },
			conversationMode: false
		},
		$config: { audio: { tts: { engine: 'openai', split_on: 'punctuation', voice: 'voice' } } },
		$TTSWorker: worker as typeof worker | null,
		TTSWorker: { set: vi.fn() },
		KokoroWorker: class {
			constructor() {
				return worker;
			}
		},
		$audioQueue: queue as typeof queue | null,
		synthesizeOpenAISpeech,
		getMessageContentParts: vi.fn(() => ['First.', 'Second.']),
		URL: { createObjectURL: vi.fn(() => `blob:server-${++urlId}`), revokeObjectURL: vi.fn() },
		speechSynthesis: {
			getVoices: vi.fn(() => [] as { voiceURI: string }[]),
			speak: vi.fn(),
			cancel: vi.fn()
		},
		localStorage: { token: 'fixture' },
		toast: { info: vi.fn(), error: vi.fn() },
		$i18n: { t: (s: string) => s },
		document: { getElementById: vi.fn(() => ({ click: vi.fn() })) },
		console: { debug: vi.fn(), error: vi.fn() },
		setInterval,
		clearInterval,
		setTimeout,
		clearTimeout,
		buttonsContainerElement: null,
		contentContainerElement: null,
		buttonsWheelHandler: () => {},
		contentCopyHandler: () => {},
		onDestroy: (fn: () => void): void => {
			destroy = fn;
		}
	};
	const api = runInNewContext(
		ts.transpileModule(`${declarations.join('\n')}\n${hooks.join('\n')}\n({speak,stopAudio})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as { speak: () => Promise<void>; stopAudio: () => void };
	return { api, context, queue, worker, response, fetch, utterances, destroy: () => destroy() };
};
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

it('uses the native default voice without waiting forever for voices', async () => {
	const r = rig();
	r.context.$config.audio.tts.engine = '';
	await r.api.speak();
	await vi.advanceTimersByTimeAsync(500);
	expect(r.context.speechSynthesis.speak).toHaveBeenCalledTimes(1);
	expect(vi.getTimerCount()).toBe(0);
	r.utterances[0]?.onend?.();
	expect(r.context.speaking).toBe(false);
	r.destroy();
});
it('stops pending synthesis on component destruction and discards late audio', async () => {
	const r = rig();
	const late = deferred<typeof r.response>();
	r.fetch.mockReturnValue(late.promise);
	const p = r.api.speak();
	r.destroy();
	late.resolve(r.response);
	await p;
	expect(r.queue.enqueue).not.toHaveBeenCalled();
	expect(r.context.speaking).toBe(false);
	expect(r.context.loadingSpeech).toBe(false);
});
it('does not stop another message when an idle component is destroyed', () => {
	const r = rig();
	r.queue.id = 'another';
	r.destroy();
	r.api.stopAudio();
	expect(r.queue.stop).not.toHaveBeenCalled();
});
it('discards a body received after interruption before creating a URL', async () => {
	const r = rig();
	const body = deferred<Blob>();
	r.response.blob.mockReturnValue(body.promise);
	const p = r.api.speak();
	await vi.advanceTimersByTimeAsync(0);
	r.api.stopAudio();
	body.resolve(new Blob(['late']));
	await p;
	expect(r.queue.enqueue).not.toHaveBeenCalled();
	expect(r.context.URL.createObjectURL).not.toHaveBeenCalled();
});
it('releases a Kokoro URL received after interruption', async () => {
	const r = rig();
	r.context.$settings.audio.tts.engine = 'browser-kokoro';
	const late = deferred<string>();
	r.worker.generate.mockReturnValue(late.promise);
	const p = r.api.speak();
	r.api.stopAudio();
	late.resolve('blob:late');
	await p;
	expect(r.queue.enqueue).not.toHaveBeenCalled();
	expect(r.context.URL.revokeObjectURL).toHaveBeenCalledWith('blob:late');
});
it('continues the next sentence after the first finishes during synthesis', async () => {
	const r = rig();
	const late = deferred<typeof r.response>();
	r.fetch.mockResolvedValueOnce(r.response).mockReturnValueOnce(late.promise);
	const p = r.api.speak();
	await vi.advanceTimersByTimeAsync(0);
	expect(r.queue.enqueue).toHaveBeenCalledTimes(1);
	r.queue.onStopped?.({ event: 'empty-queue', id: 'message' });
	late.resolve(r.response);
	await p;
	expect(r.queue.enqueue).toHaveBeenCalledTimes(2);
	expect(r.context.speaking).toBe(true);
	r.queue.onStopped?.({ event: 'empty-queue', id: 'message' });
	expect(r.context.speaking).toBe(false);
	r.destroy();
});
it('stops requesting later paid sentences after a synthesis failure', async () => {
	const r = rig();
	r.fetch.mockRejectedValue(new TypeError('provider refused'));
	await r.api.speak();
	expect(r.fetch).toHaveBeenCalledTimes(1);
	expect(r.context.speaking).toBe(false);
	expect(r.context.loadingSpeech).toBe(false);
	expect(r.context.toast.error).toHaveBeenCalledTimes(1);
});
it('contains Kokoro initialization failure and clears loading state', async () => {
	const r = rig();
	r.context.$settings.audio.tts.engine = 'browser-kokoro';
	r.context.$TTSWorker = null;
	r.worker.init.mockRejectedValue(new Error('init refused'));
	await expect(r.api.speak()).resolves.toBeUndefined();
	expect(r.context.loadingSpeech).toBe(false);
	expect(r.context.speaking).toBe(false);
	expect(r.worker.generate).not.toHaveBeenCalled();
});
it('uses selected Kokoro even when the server uses native speech', async () => {
	const r = rig();
	r.context.$settings.audio.tts.engine = 'browser-kokoro';
	r.context.$config.audio.tts.engine = '';
	await r.api.speak();
	expect(r.worker.generate).toHaveBeenCalledTimes(2);
	expect(r.queue.enqueue).toHaveBeenCalledTimes(2);
	expect(r.context.speechSynthesis.speak).not.toHaveBeenCalled();
	r.destroy();
});
it('cancels its request when another message takes the shared queue', async () => {
	const r = rig();
	const late = deferred<typeof r.response>();
	r.fetch.mockReturnValue(late.promise);
	const p = r.api.speak();
	r.queue.setId('another');
	late.resolve(r.response);
	await p;
	expect(r.queue.enqueue).not.toHaveBeenCalled();
	expect(r.context.speaking).toBe(false);
	expect(r.queue.id).toBe('another');
});
