type AudioQueueEvent = 'stop' | 'empty-queue' | 'id-change' | 'error';

interface AudioQueueStopDetail {
	event: AudioQueueEvent;
	id: string | null;
}

const SILENT_WAV =
	'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export type OnStoppedCallback = (detail: AudioQueueStopDetail) => void;

export class AudioQueue {
	private audio: HTMLAudioElement;
	private queue: string[] = [];
	private current: string | null = null;
	private playback = 0;
	private readonly _onEnded = (): void => {
		if (this.current && this.audio.ended) this.next();
	};
	private readonly _onError = (): void => {
		if (this.current && this.audio.error) this.next();
	};
	private readonly _onGesture = (): void => this.#unlock();

	id: string | null = null;
	onStopped: OnStoppedCallback | null = null;

	constructor(audioElement: HTMLAudioElement) {
		this.audio = audioElement;
		this.audio.addEventListener('ended', this._onEnded);
		this.audio.addEventListener('error', this._onError);
		document.addEventListener('pointerdown', this._onGesture, true);
		document.addEventListener('keydown', this._onGesture, true);
	}

	setId(newId: string): void {
		if (this.id === newId) return;

		this.#halt();
		this.id = newId;
		this.onStopped?.({ event: 'id-change', id: newId });
	}

	setPlaybackRate(rate: number): void {
		this.audio.defaultPlaybackRate = rate;
		this.audio.playbackRate = rate;
	}

	enqueue(url: string): void {
		this.queue.push(url);

		// Auto-play if nothing is currently playing or loaded
		if (this.audio.paused && !this.current) {
			this.next();
		}
	}

	play(): void {
		if (!this.current && this.queue.length > 0) {
			this.next();
		} else if (this.current) {
			this.#play();
		}
	}

	/** Play silence inside the first user gesture so WebKit allows later programmatic playback. */
	#unlock(): void {
		if (this.current || !this.audio.paused) return;

		this.audio.src = SILENT_WAV;
		this.audio
			.play()
			.then(() => this.#removeGestureListeners())
			.catch(() => {})
			.finally(() => {
				if (this.current) return;

				this.audio.pause();
				if (this.queue.length) this.next();
			});
	}

	next(): void {
		this.#revoke(this.current);
		this.current = this.queue.shift() ?? null;

		if (this.current) {
			this.audio.src = this.current;
			this.#play();
		} else {
			this.#halt();
			this.onStopped?.({ event: 'empty-queue', id: this.id });
		}
	}

	stop(): void {
		this.#halt();
		this.onStopped?.({ event: 'stop', id: this.id });
	}

	destroy(): void {
		this.audio.removeEventListener('ended', this._onEnded);
		this.audio.removeEventListener('error', this._onError);
		this.stop();
		this.#removeGestureListeners();
		this.onStopped = null;
	}

	#play(): void {
		const playback = ++this.playback;
		const failed = (error: unknown): void => {
			if (playback !== this.playback) return;
			console.error('Error playing queued audio:', error);
			this.next();
		};
		this.audio.muted = false;
		try {
			void this.audio.play().catch(failed);
		} catch (error) {
			failed(error);
		}
	}

	#revoke(url: string | null): void {
		if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
	}

	#removeGestureListeners(): void {
		document.removeEventListener('pointerdown', this._onGesture, true);
		document.removeEventListener('keydown', this._onGesture, true);
	}

	/**
	 * Pause audio and clear queue without firing onStopped.
	 * Callers that need the callback should invoke it themselves.
	 */
	#halt(): void {
		this.playback++;
		this.#revoke(this.current);
		for (const url of this.queue) this.#revoke(url);
		this.audio.pause();
		this.audio.currentTime = 0;
		this.audio.removeAttribute('src');
		this.audio.load();
		this.queue = [];
		this.current = null;
	}
}
