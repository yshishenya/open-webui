<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { tick, getContext, onMount, onDestroy } from 'svelte';
	import { config, settings } from '$lib/stores';
	import { blobToFile } from '$lib/utils';

	import { transcribeAudio } from '$lib/apis/audio';
	import XMark from '$lib/components/icons/XMark.svelte';

	import dayjs from 'dayjs';
	import LocalizedFormat from 'dayjs/plugin/localizedFormat';
	dayjs.extend(LocalizedFormat);

	const i18n = getContext('i18n');

	export let recording = false;
	export let transcribe = true;
	export let displayMedia = false;

	export let echoCancellation = true;
	export let noiseSuppression = true;
	export let autoGainControl = true;

	export let className = ' p-2.5 w-full max-w-full';

	export let onCancel = () => {};
	export let onConfirm: (data: {
		text: string;
		filename?: string;
		file?: File;
		blob?: Blob;
	}) => void | Promise<void> = () => {};

	let loading = false;
	let confirmed = false;

	let durationSeconds = 0;
	let durationCounter: ReturnType<typeof setInterval> | null = null;

	let transcription = '';

	const startDurationCounter = (): void => {
		stopDurationCounter();
		durationCounter = setInterval(() => {
			durationSeconds++;
		}, 1000);
	};

	const stopDurationCounter = (): void => {
		if (durationCounter !== null) clearInterval(durationCounter);
		durationCounter = null;
		durationSeconds = 0;
	};

	$: if (recording) {
		startRecording();
	} else {
		stopRecording();
	}

	const formatSeconds = (seconds) => {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		const formattedSeconds = remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds;
		return `${minutes}:${formattedSeconds}`;
	};

	let wakeLock: Awaited<ReturnType<typeof navigator.wakeLock.request>> | null = null;
	let recordingRequest = 0;
	let destroyed = false;
	let recognitionTimeout: ReturnType<typeof setTimeout> | undefined;
	let audioContext: AudioContext | null = null;

	const requestWakeLock = async (): Promise<void> => {
		if (wakeLock?.released) wakeLock = null;
		if (destroyed || !recording || confirmed || wakeLock) return;
		const request = recordingRequest;
		if ('wakeLock' in navigator) {
			try {
				const lock = await navigator.wakeLock.request('screen');
				// Another request can own/release a lock while this one awaits permission.
				const currentLock = wakeLock as Awaited<
					ReturnType<typeof navigator.wakeLock.request>
				> | null;
				if (currentLock?.released) wakeLock = null;
				if (wakeLock || request !== recordingRequest || destroyed || !recording || confirmed) {
					await lock.release();
					return;
				}
				wakeLock = lock;
				console.log('Wake Lock acquired');

				wakeLock.addEventListener('release', () => {
					console.log('Wake Lock released');
				});
			} catch (err) {
				console.log('Wake Lock request failed:', err);
			}
		}
	};

	const releaseWakeLock = async (): Promise<void> => {
		const lock = wakeLock;
		wakeLock = null;
		if (lock) {
			try {
				await lock.release();
			} catch (err) {
				console.log('Wake Lock release failed:', err);
			}
		}
	};

	let stream: MediaStream | null = null;
	let speechRecognition;

	let mediaRecorder: MediaRecorder | null = null;

	const MIN_DECIBELS = -45;
	let VISUALIZER_BUFFER_LENGTH = 300;

	let visualizerData = Array(VISUALIZER_BUFFER_LENGTH).fill(0);

	// Function to calculate the RMS level from time domain data
	const calculateRMS = (data: Uint8Array) => {
		let sumSquares = 0;
		for (let i = 0; i < data.length; i++) {
			const normalizedValue = (data[i] - 128) / 128; // Normalize the data
			sumSquares += normalizedValue * normalizedValue;
		}
		return Math.sqrt(sumSquares / data.length);
	};

	const normalizeRMS = (rms) => {
		rms = rms * 10;
		const exp = 1.5; // Adjust exponent value; values greater than 1 expand larger numbers more and compress smaller numbers more
		const scaledRMS = Math.pow(rms, exp);

		// Scale between 0.01 (1%) and 1.0 (100%)
		return Math.min(1.0, Math.max(0.01, scaledRMS));
	};

	const analyseAudio = (stream: MediaStream): void => {
		const request = recordingRequest;
		audioContext = new AudioContext();
		const audioStreamSource = audioContext.createMediaStreamSource(stream);

		const analyser = audioContext.createAnalyser();
		analyser.minDecibels = MIN_DECIBELS;
		audioStreamSource.connect(analyser);

		const bufferLength = analyser.frequencyBinCount;

		const domainData = new Uint8Array(bufferLength);
		const timeDomainData = new Uint8Array(analyser.fftSize);

		const detectSound = () => {
			const processFrame = () => {
				if (request !== recordingRequest || destroyed || !recording || loading || confirmed) return;

				if (recording && !loading) {
					analyser.getByteTimeDomainData(timeDomainData);
					analyser.getByteFrequencyData(domainData);

					// Calculate RMS level from time domain data
					const rmsLevel = calculateRMS(timeDomainData);
					// Push the calculated decibel level to visualizerData
					visualizerData.push(normalizeRMS(rmsLevel));

					// Ensure visualizerData array stays within the buffer length
					if (visualizerData.length >= VISUALIZER_BUFFER_LENGTH) {
						visualizerData.shift();
					}

					visualizerData = visualizerData;

					// if (domainData.some((value) => value > 0)) {
					// 	lastSoundTime = Date.now();
					// }

					// if (recording && Date.now() - lastSoundTime > 3000) {
					// 	if ($settings?.speechAutoSend ?? false) {
					// 		confirmRecording();
					// 	}
					// }
				}

				window.requestAnimationFrame(processFrame);
			};

			window.requestAnimationFrame(processFrame);
		};

		detectSound();
	};

	const onStopHandler = async (
		audioBlob: Blob,
		ext: string = 'wav',
		request = recordingRequest
	): Promise<void> => {
		// Create a blob from the audio chunks

		await tick();
		if (request !== recordingRequest || destroyed || !confirmed) return;
		const file = blobToFile(audioBlob, `Recording-${dayjs().format('L LT')}.${ext}`);

		if (transcribe) {
			if ($config.audio.stt.engine === 'web' || ($settings?.audio?.stt?.engine ?? '') === 'web') {
				// Confirm from the recorder's terminal event, regardless of recognition/stop ordering.
				onConfirm({ text: transcription });
				return;
			}

			const res = await transcribeAudio(
				localStorage.token,
				file,
				$settings?.audio?.stt?.language
			).catch((error) => {
				if (request === recordingRequest && !destroyed) toast.error(`${error}`);
				return null;
			});

			if (request !== recordingRequest || destroyed || !confirmed) return;
			if (res) {
				console.log(res);
				onConfirm(res);
			}
		} else {
			onConfirm({
				text: '',
				file: file,
				blob: audioBlob
			});
		}
	};

	const startRecording = async (): Promise<void> => {
		if (destroyed || !recording || loading || mediaRecorder) return;
		const request = ++recordingRequest;
		loading = true;
		let acquired: MediaStream | null = null;
		let started = false;
		try {
			acquired = displayMedia
				? await navigator.mediaDevices.getDisplayMedia({ audio: true })
				: await navigator.mediaDevices.getUserMedia({
						audio: { echoCancellation, noiseSuppression, autoGainControl }
					});
			if (request !== recordingRequest || destroyed || !recording) return;
			if (displayMedia) {
				stream = new MediaStream(acquired.getAudioTracks());
				acquired.getVideoTracks().forEach((track) => track.stop());
			} else {
				stream = acquired;
			}
			const recordingStream = stream;
			const mimeTypes = [
				'audio/webm; codecs=opus',
				'audio/webm',
				'audio/ogg; codecs=opus',
				'audio/mp4',
				'audio/wav'
			];
			const recorder = new MediaRecorder(recordingStream, {
				mimeType: mimeTypes.find((type) => MediaRecorder.isTypeSupported(type))
			});
			mediaRecorder = recorder;
			const chunks: Blob[] = [];
			recorder.onstart = async (): Promise<void> => {
				if (request !== recordingRequest || destroyed || !recording || confirmed) return;
				loading = false;
				startDurationCounter();
				try {
					await requestWakeLock();
					if (request !== recordingRequest || destroyed || !recording || confirmed) return;
					analyseAudio(recordingStream);
				} catch (error) {
					if (request === recordingRequest && !destroyed) {
						console.error('Error starting recording:', error);
						toast.error($i18n.t('Error starting recording.'));
						await cancelRecording();
					}
				}
			};
			recorder.ondataavailable = (event): void => {
				chunks.push(event.data);
			};
			recorder.onstop = async (): Promise<void> => {
				if (request !== recordingRequest || destroyed) return;
				if (!confirmed) {
					await stopRecording();
					return;
				}
				const type = chunks[0]?.type || recorder.mimeType || 'audio/webm';
				const ext = type.startsWith('audio/') ? type.split('/')[1].split(';')[0] || 'webm' : 'webm';
				// Native stop queues final dataavailable before onstop; keep this session's chunks.
				const audioBlob = new Blob(chunks, { type });
				try {
					await onStopHandler(audioBlob, ext, request);
				} finally {
					if (request === recordingRequest && !destroyed) {
						confirmed = false;
						loading = false;
						recording = false;
					}
				}
			};
			recorder.start();
			if (transcribe) {
				if ($config.audio.stt.engine === 'web' || ($settings?.audio?.stt?.engine ?? '') === 'web') {
					if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
						// reset accumulated transcription from previous sessions
						transcription = '';

						// Create a SpeechRecognition object
						const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
						speechRecognition = recognition;

						// Set continuous to true for continuous recognition
						recognition.continuous = true;

						// Set the timeout for turning off the recognition after inactivity (in milliseconds)
						const inactivityTimeout = 2000; // 3 seconds

						// Start recognition
						recognition.start();

						// Event triggered when speech is recognized
						recognition.onresult = async (event: {
							results: Record<number, Record<number, { transcript: string }>>;
						}): Promise<void> => {
							if (request !== recordingRequest || destroyed || !recording || confirmed) return;
							// Clear the inactivity timeout
							clearTimeout(recognitionTimeout);

							// Handle recognized speech
							console.log(event);
							const transcript = event.results[Object.keys(event.results).length - 1][0].transcript;

							transcription = `${transcription}${transcript}`;

							await tick();
							if (request !== recordingRequest || destroyed || !recording || confirmed) return;
							document.getElementById('chat-input')?.focus();

							// Restart the inactivity timeout
							recognitionTimeout = setTimeout(() => {
								console.log('Speech recognition turned off due to inactivity.');
								if (request === recordingRequest && !destroyed && recording) recognition.stop();
							}, inactivityTimeout);
						};

						// Event triggered when recognition is ended
						recognition.onend = function (): void {
							if (request !== recordingRequest || destroyed || !recording || confirmed) return;
							// Restart recognition after it ends
							console.log('recognition ended');

							confirmRecording();
						};

						// Event triggered when an error occurs
						recognition.onerror = function (event: { error: string }): void {
							if (request !== recordingRequest || destroyed) return;
							console.log(event);
							toast.error($i18n.t(`Speech recognition error: {{error}}`, { error: event.error }));
							onCancel();

							cancelRecording();
						};
					}
				}
			}
			started = true;
		} catch (error) {
			if (request === recordingRequest && !destroyed) {
				console.error('Error starting recording:', error);
				toast.error(
					$i18n.t(acquired ? 'Error starting recording.' : 'Error accessing media devices.')
				);
				await stopRecording();
			}
		} finally {
			if (!started && acquired)
				acquired.getTracks().forEach((track) => {
					if (track.readyState !== 'ended') track.stop();
				});
		}
	};

	const cancelRecording = async (): Promise<void> => {
		await stopRecording();
	};

	const stopRecording = async (preserveConfirmation = false): Promise<void> => {
		if (!preserveConfirmation) {
			recordingRequest++;
			confirmed = false;
			recording = false;
			loading = false;
			if (speechRecognition) speechRecognition.onend = null;
		}
		const recorder = mediaRecorder;
		mediaRecorder = null;
		const owned = stream;
		stream = null;
		const context = audioContext;
		audioContext = null;
		const recognition = speechRecognition;
		speechRecognition = null;
		clearTimeout(recognitionTimeout);
		recognitionTimeout = undefined;
		stopDurationCounter();
		visualizerData = Array(VISUALIZER_BUFFER_LENGTH).fill(0);
		try {
			if (recorder && recorder.state !== 'inactive') recorder.stop();
		} catch (error) {
			console.error('Error stopping recording:', error);
		} finally {
			owned?.getTracks().forEach((track) => {
				if (track.readyState !== 'ended') track.stop();
			});
		}
		try {
			recognition?.stop();
		} catch (error) {
			console.error('Error stopping speech recognition:', error);
		}
		await releaseWakeLock();
		if (context) {
			try {
				await context.close();
			} catch (error) {
				console.error('Error closing audio analysis:', error);
			}
		}
	};

	const confirmRecording = async (): Promise<void> => {
		if (
			destroyed ||
			!recording ||
			confirmed ||
			!mediaRecorder ||
			mediaRecorder.state === 'inactive'
		)
			return;
		loading = true;
		confirmed = true;
		await stopRecording(true);
	};

	let resizeObserver;
	let containerWidth;

	const handleKeyDown = (e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			cancelRecording();
			onCancel();
		}
	};

	const handleVisibilityChange = async () => {
		if (recording && document.visibilityState === 'visible') {
			await requestWakeLock();
		}
	};

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		// listen to width changes
		resizeObserver = new ResizeObserver(() => {
			VISUALIZER_BUFFER_LENGTH = Math.floor(window.innerWidth / 4);
			if (visualizerData.length > VISUALIZER_BUFFER_LENGTH) {
				visualizerData = visualizerData.slice(visualizerData.length - VISUALIZER_BUFFER_LENGTH);
			} else {
				visualizerData = Array(VISUALIZER_BUFFER_LENGTH - visualizerData.length)
					.fill(0)
					.concat(visualizerData);
			}
		});

		resizeObserver.observe(document.body);
	});

	onDestroy((): void => {
		destroyed = true;
		stopRecording();
		window.removeEventListener('keydown', handleKeyDown);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		// remove resize observer
		resizeObserver.disconnect();
	});
</script>

<div
	bind:clientWidth={containerWidth}
	class="{loading
		? ' bg-gray-100/50 dark:bg-gray-850/50'
		: 'bg-indigo-300/10 dark:bg-indigo-500/10 '} rounded-full flex justify-between {className}"
>
	<div class="flex items-center mr-1">
		<button
			type="button"
			aria-label={$i18n.t('Cancel')}
			class="p-1.5

            {loading
				? ' bg-gray-200 dark:bg-gray-700/50'
				: 'bg-indigo-400/20 text-indigo-600 dark:text-indigo-300 '} 


             rounded-full"
			on:click={async () => {
				cancelRecording();
				onCancel();
			}}
		>
			<XMark className={'size-4'} />
		</button>
	</div>

	<div
		class="flex flex-1 self-center items-center justify-between ml-2 mx-1 overflow-hidden h-6"
		dir="rtl"
	>
		<div
			class="flex items-center gap-0.5 h-6 w-full max-w-full overflow-hidden overflow-x-hidden flex-wrap"
		>
			{#each visualizerData.slice().reverse() as rms}
				<div class="flex items-center h-full">
					<div
						class="w-[2px] shrink-0
                    
                    {loading
							? ' bg-gray-500 dark:bg-gray-400   '
							: 'bg-indigo-500 dark:bg-indigo-400  '} 
                    
                    inline-block h-full"
						style="height: {Math.min(100, Math.max(14, rms * 100))}%;"
					></div>
				</div>
			{/each}
		</div>
	</div>

	<div class="flex">
		<div class="  mx-1.5 pr-1 flex justify-center items-center">
			<div
				class="text-sm
        
        
        {loading ? ' text-gray-500  dark:text-gray-400  ' : ' text-indigo-400 '} 
       font-normal flex-1 mx-auto text-center"
			>
				{formatSeconds(durationSeconds)}
			</div>
		</div>

		<div class="flex items-center">
			{#if loading}
				<div class=" text-gray-500 rounded-full cursor-not-allowed">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
						fill="currentColor"
						><style>
							.spinner_OSmW {
								transform-origin: center;
								animation: spinner_T6mA 0.75s step-end infinite;
							}
							@keyframes spinner_T6mA {
								8.3% {
									transform: rotate(30deg);
								}
								16.6% {
									transform: rotate(60deg);
								}
								25% {
									transform: rotate(90deg);
								}
								33.3% {
									transform: rotate(120deg);
								}
								41.6% {
									transform: rotate(150deg);
								}
								50% {
									transform: rotate(180deg);
								}
								58.3% {
									transform: rotate(210deg);
								}
								66.6% {
									transform: rotate(240deg);
								}
								75% {
									transform: rotate(270deg);
								}
								83.3% {
									transform: rotate(300deg);
								}
								91.6% {
									transform: rotate(330deg);
								}
								100% {
									transform: rotate(360deg);
								}
							}
						</style><g class="spinner_OSmW"
							><rect x="11" y="1" width="2" height="5" opacity=".14" /><rect
								x="11"
								y="1"
								width="2"
								height="5"
								transform="rotate(30 12 12)"
								opacity=".29"
							/><rect
								x="11"
								y="1"
								width="2"
								height="5"
								transform="rotate(60 12 12)"
								opacity=".43"
							/><rect
								x="11"
								y="1"
								width="2"
								height="5"
								transform="rotate(90 12 12)"
								opacity=".57"
							/><rect
								x="11"
								y="1"
								width="2"
								height="5"
								transform="rotate(120 12 12)"
								opacity=".71"
							/><rect
								x="11"
								y="1"
								width="2"
								height="5"
								transform="rotate(150 12 12)"
								opacity=".86"
							/><rect x="11" y="1" width="2" height="5" transform="rotate(180 12 12)" /></g
						></svg
					>
				</div>
			{:else}
				<button
					id="confirm-recording-button"
					type="button"
					aria-label={$i18n.t('Confirm recording')}
					class="p-1.5 bg-indigo-500 text-white dark:bg-indigo-500 dark:text-blue-950 rounded-full"
					on:click={async () => {
						await confirmRecording();
					}}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2.5"
						stroke="currentColor"
						class="size-4"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
					</svg>
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.visualizer {
		display: flex;
		height: 100%;
	}

	.visualizer-bar {
		width: 2px;
		background-color: #4a5aba; /* or whatever color you need */
	}
</style>
