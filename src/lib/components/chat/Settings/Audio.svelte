<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { createEventDispatcher, onMount, onDestroy, getContext } from 'svelte';

	import { settings, config, type Settings } from '$lib/stores';
	import { getVoices as _getVoices } from '$lib/apis/audio';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import type { KokoroTTS } from 'kokoro-js';
	import type { SpeechSettings } from '$lib/utils/airis/frontend-contracts';

	import Switch from '$lib/components/common/Switch.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import UserSettingField from './UserSettingField.svelte';
	import UserSettingRow from './UserSettingRow.svelte';
	import SettingsSelect from '$lib/components/common/SettingsSelect.svelte';
	import UserSettingSection from './UserSettingSection.svelte';
	const dispatch = createEventDispatcher();

	const i18n = getContext<Writable<i18nType>>('i18n');

	export let saveSettings: (value: Partial<Settings>) => void | Promise<void>;

	// Audio
	let speechAutoSend = false;
	let responseAutoPlayback = false;
	let nonLocalVoices = false;

	let STTEngine = '';
	let STTLanguage = '';

	let TTSEngine = '';
	let TTSEngineConfig: NonNullable<NonNullable<SpeechSettings['tts']>['engineConfig']> = {};

	let TTSModel: KokoroTTS | null = null;
	type KokoroProgress = Parameters<
		NonNullable<NonNullable<Parameters<typeof KokoroTTS.from_pretrained>[1]>['progress_callback']>
	>[0];
	let TTSModelProgress: KokoroProgress | null = null;
	let TTSModelLoading = false;

	let voices: { id: string; name: string; localService?: boolean }[] = [];
	let destroyed = false;
	let mounted = false;
	let voiceRequest: AbortController | null = null;
	let modelGeneration = 0;
	let loadedDtype: typeof TTSEngineConfig.dtype | null = null;
	let modelLoad: {
		dtype: typeof TTSEngineConfig.dtype;
		promise: Promise<KokoroTTS | null>;
	} | null = null;
	let voice = '';

	// Audio speed control
	let playbackRate = 1;
	const inputClass =
		'h-7 w-full rounded-lg border border-gray-100/50 bg-gray-50/40 px-2 text-xs text-gray-700 outline-hidden transition-colors placeholder:text-gray-300 focus:border-blue-400 dark:border-white/[0.04] dark:bg-white/[0.03] dark:text-gray-300 dark:placeholder:text-gray-700 dark:focus:border-blue-500';

	const releaseModel = (model: KokoroTTS): void => {
		void model.model
			.dispose()
			.catch((error: unknown) => console.error('Error releasing voice model:', error));
	};

	const loadKokoro = (): Promise<KokoroTTS | null> => {
		const dtype = TTSEngineConfig.dtype ?? 'fp32';
		if (TTSModel && loadedDtype === dtype) return Promise.resolve(TTSModel);
		if (modelLoad?.dtype === dtype) return modelLoad.promise;
		if (TTSModel) releaseModel(TTSModel);
		TTSModel = null;
		TTSModelProgress = null;
		TTSModelLoading = true;
		const generation = ++modelGeneration;
		const promise = (async (): Promise<KokoroTTS | null> => {
			try {
				const { KokoroTTS } = await import('kokoro-js');
				if (destroyed || modelGeneration !== generation) return null;
				const model = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
					dtype,
					device: navigator.gpu ? 'webgpu' : 'wasm',
					progress_callback: (event): void => {
						if (!destroyed && modelGeneration === generation) TTSModelProgress = event;
					}
				});
				if (
					destroyed ||
					modelGeneration !== generation ||
					TTSEngine !== 'browser-kokoro' ||
					(TTSEngineConfig.dtype ?? 'fp32') !== dtype
				) {
					releaseModel(model);
					return null;
				}
				TTSModel = model;
				loadedDtype = dtype;
				return model;
			} catch (error) {
				if (!destroyed && modelGeneration === generation) toast.error(`${error}`);
				return null;
			} finally {
				if (modelGeneration === generation) {
					modelLoad = null;
					TTSModelLoading = false;
				}
			}
		})();
		modelLoad = { dtype, promise };
		return promise;
	};

	const getVoices = async (): Promise<void> => {
		if (destroyed) return;
		voiceRequest?.abort();
		const controller = new AbortController();
		voiceRequest = controller;
		try {
			if (TTSEngine === 'browser-kokoro') {
				const model = await loadKokoro();
				if (controller.signal.aborted || destroyed || !model) return;
				voices = Object.entries(model.voices).map(([id, value]) => ({
					id,
					name: value.name,
					localService: false
				}));
			} else {
				if (TTSModel) releaseModel(TTSModel);
				TTSModel = null;
				loadedDtype = null;
				modelLoad = null;
				modelGeneration++;
				TTSModelLoading = false;
				if (!($config?.audio?.tts?.engine ?? '')) {
					const nativeVoices =
						typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices();
					voices = nativeVoices.map((v) => ({
						id: v.voiceURI,
						name: v.name,
						localService: v.localService
					}));
					// Preserve a voice saved by the old name-based selector.
					if (!voices.some((v) => v.id === voice))
						voice = nativeVoices.find((v) => v.name === voice)?.voiceURI ?? voice;
				} else {
					const res = await _getVoices(localStorage.token, controller.signal);
					if (!controller.signal.aborted && !destroyed) voices = res.voices;
				}
			}
		} catch (error) {
			if (!controller.signal.aborted && !destroyed) toast.error(`${error}`);
		}
	};

	const nativeVoicesChanged = (): void => {
		if (TTSEngine !== 'browser-kokoro' && !($config?.audio?.tts?.engine ?? '')) void getVoices();
	};

	const setResponseAutoPlayback = async (enabled: boolean): Promise<void> => {
		responseAutoPlayback = enabled;
		await saveSettings({ responseAutoPlayback });
	};

	const setSpeechAutoSend = async (enabled: boolean): Promise<void> => {
		speechAutoSend = enabled;
		await saveSettings({ speechAutoSend });
	};

	onMount(() => {
		playbackRate = $settings.audio?.tts?.playbackRate ?? 1;
		speechAutoSend = $settings.speechAutoSend ?? false;
		responseAutoPlayback = $settings.responseAutoPlayback ?? false;

		STTEngine = $settings?.audio?.stt?.engine ?? '';
		STTLanguage = $settings?.audio?.stt?.language ?? '';

		TTSEngine = $settings?.audio?.tts?.engine ?? '';
		TTSEngineConfig = { ...$settings?.audio?.tts?.engineConfig };

		if ($settings?.audio?.tts?.defaultVoice === ($config?.audio?.tts?.voice ?? '')) {
			voice = $settings?.audio?.tts?.voice ?? $config?.audio?.tts?.voice ?? '';
		} else {
			voice = $config?.audio?.tts?.voice ?? '';
		}

		nonLocalVoices = $settings.audio?.tts?.nonLocalVoices ?? false;

		mounted = true;
		if (typeof speechSynthesis !== 'undefined')
			speechSynthesis.addEventListener('voiceschanged', nativeVoicesChanged);
		void getVoices();
	});

	$: if (mounted && TTSEngine !== undefined && TTSEngineConfig && $config) void getVoices();

	onDestroy(() => {
		destroyed = true;
		voiceRequest?.abort();
		if (typeof speechSynthesis !== 'undefined')
			speechSynthesis.removeEventListener('voiceschanged', nativeVoicesChanged);
		if (TTSModel) releaseModel(TTSModel);
		TTSModel = null;
		modelLoad = null;
		modelGeneration++;
		TTSModelLoading = false;
	});
</script>

<form
	id="tab-audio"
	class="flex flex-col h-full justify-between text-sm"
	on:submit|preventDefault={async () => {
		saveSettings({
			audio: {
				stt: {
					engine: STTEngine !== '' ? STTEngine : undefined,
					language: STTLanguage !== '' ? STTLanguage : undefined
				},
				tts: {
					engine: TTSEngine !== '' ? TTSEngine : undefined,
					engineConfig: TTSEngineConfig,
					playbackRate: playbackRate,
					voice: voice !== '' ? voice : undefined,
					defaultVoice: $config?.audio?.tts?.voice ?? '',
					nonLocalVoices: !($config?.audio?.tts?.engine ?? '') ? nonLocalVoices : undefined
				}
			}
		});
		dispatch('save');
	}}
>
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">{$i18n.t('Audio')}</h2>

	<div class="flex-1 min-h-0 overflow-y-auto scrollbar-hover pr-1.5">
		<UserSettingSection title={$i18n.t('STT Settings')} first>
			{#if $config?.audio?.stt?.engine !== 'web'}
				<UserSettingRow
					label={$i18n.t('Speech-to-Text Engine')}
					description={$i18n.t('Choose the engine used to transcribe voice input.')}
				>
					<SettingsSelect
						bind:value={STTEngine}
						ariaLabel={$i18n.t('Speech-to-Text Engine')}
						placeholder={$i18n.t('Select an engine')}
					>
						<option value="">{$i18n.t('Default')}</option>
						<option value="web">{$i18n.t('Web API')}</option>
					</SettingsSelect>
				</UserSettingRow>

				<UserSettingRow
					label={$i18n.t('Language')}
					description={$i18n.t(
						'Set a speech recognition language or leave it blank to detect automatically.'
					)}
				>
					<Tooltip
						content={$i18n.t(
							'The language of the input audio. Supplying the input language in ISO-639-1 (e.g. en) format will improve accuracy and latency. Leave blank to automatically detect the language.'
						)}
						placement="top"
					>
						<input
							type="text"
							bind:value={STTLanguage}
							aria-label={$i18n.t('Speech-to-Text Language')}
							placeholder={$i18n.t('e.g. en')}
							class="h-7 w-24 rounded-lg border border-gray-100/50 bg-gray-50/40 px-2 text-right text-xs text-gray-700 outline-hidden transition-colors placeholder:text-gray-300 focus:border-blue-400 dark:border-white/[0.04] dark:bg-white/[0.03] dark:text-gray-300 dark:placeholder:text-gray-700 dark:focus:border-blue-500"
						/>
					</Tooltip>
				</UserSettingRow>
			{/if}

			<UserSettingRow
				label={$i18n.t('Instant Auto-Send After Voice Transcription')}
				description={$i18n.t(
					'Send transcribed voice input immediately after speech recognition finishes.'
				)}
			>
				<Switch
					state={speechAutoSend}
					ariaLabel={$i18n.t('Instant Auto-Send After Voice Transcription')}
					on:change={(event) => {
						setSpeechAutoSend(event.detail);
					}}
				/>
			</UserSettingRow>
		</UserSettingSection>

		<UserSettingSection title={$i18n.t('TTS Settings')}>
			<UserSettingRow
				label={$i18n.t('Text-to-Speech Engine')}
				description={$i18n.t('Choose the engine used to read assistant responses aloud.')}
			>
				<SettingsSelect
					bind:value={TTSEngine}
					ariaLabel={$i18n.t('Text-to-Speech Engine')}
					placeholder={$i18n.t('Select an engine')}
				>
					<option value="">{$i18n.t('Default')}</option>
					<option value="browser-kokoro">{$i18n.t('Kokoro.js (Browser)')}</option>
				</SettingsSelect>
			</UserSettingRow>

			{#if TTSEngine === 'browser-kokoro'}
				<UserSettingRow
					label={$i18n.t('Kokoro.js Dtype')}
					description={$i18n.t('Select the local model precision used by Kokoro.js.')}
				>
					<SettingsSelect
						bind:value={TTSEngineConfig.dtype}
						ariaLabel={$i18n.t('Kokoro.js Dtype')}
						placeholder={$i18n.t('Select dtype')}
					>
						<option value="" disabled selected>{$i18n.t('Select dtype')}</option>
						<option value="fp32">fp32</option>
						<option value="fp16">fp16</option>
						<option value="q8">q8</option>
						<option value="q4">q4</option>
					</SettingsSelect>
				</UserSettingRow>
			{/if}

			<UserSettingRow
				label={$i18n.t('Auto-Playback Response')}
				description={$i18n.t('Play assistant responses aloud automatically.')}
			>
				<Switch
					state={responseAutoPlayback}
					ariaLabel={$i18n.t('Auto-Playback Response')}
					on:change={(event) => {
						setResponseAutoPlayback(event.detail);
					}}
				/>
			</UserSettingRow>

			<UserSettingRow
				label={$i18n.t('Speech Playback Speed')}
				description={$i18n.t('Adjust how quickly spoken responses are played.')}
			>
				<div class="relative flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600">
					<input
						type="number"
						min="0"
						step="0.01"
						bind:value={playbackRate}
						aria-label={$i18n.t('Speech Playback Speed')}
						class="h-7 w-16 rounded-lg border border-gray-100/50 bg-gray-50/40 px-2 text-right text-xs text-gray-700 outline-hidden transition-colors focus:border-blue-400 dark:border-white/[0.04] dark:bg-white/[0.03] dark:text-gray-300 dark:focus:border-blue-500"
					/>
					x
				</div>
			</UserSettingRow>
		</UserSettingSection>

		{#if TTSEngine === 'browser-kokoro'}
			{#if TTSModel}
				<UserSettingSection title={$i18n.t('Voice')}>
					<UserSettingField
						label={$i18n.t('Set Voice')}
						description={$i18n.t('Choose the Kokoro.js voice used for speech output.')}
					>
						<input
							list="voice-list"
							class={inputClass}
							bind:value={voice}
							aria-label={$i18n.t('Voice')}
							placeholder={$i18n.t('Select a voice')}
						/>

						<datalist id="voice-list">
							{#each voices as voice}
								<option value={voice.id}>{voice.name}</option>
							{/each}
						</datalist>
					</UserSettingField>
				</UserSettingSection>
			{:else if TTSModelLoading}
				<UserSettingSection title={$i18n.t('Voice')}>
					<div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
						<Spinner className="size-4" />

						<div class="shimmer">
							{$i18n.t('Loading Kokoro.js...')}
							{TTSModelProgress && TTSModelProgress.status === 'progress'
								? `(${Math.round(TTSModelProgress.progress * 10) / 10}%)`
								: ''}
						</div>
					</div>

					<div class="text-[0.6875rem] text-gray-400 dark:text-gray-600">
						{$i18n.t('Please do not close the settings page while loading the model.')}
					</div>
				</UserSettingSection>
			{/if}
		{:else if !($config?.audio?.tts?.engine ?? '')}
			<UserSettingSection title={$i18n.t('Voice')}>
				<UserSettingField
					label={$i18n.t('Set Voice')}
					description={$i18n.t('Choose the browser voice used for speech output.')}
				>
					<SettingsSelect bind:value={voice} className="w-full" ariaLabel={$i18n.t('Voice')}>
						<option value="" selected={voice !== ''}>{$i18n.t('Default')}</option>
						{#each voices.filter((v) => nonLocalVoices || v.localService === true) as _voice}
							<option
								value={_voice.id}
								class="bg-gray-100 dark:bg-gray-700"
								selected={voice === _voice.id}>{_voice.name}</option
							>
						{/each}
					</SettingsSelect>
				</UserSettingField>
				<UserSettingRow
					label={$i18n.t('Allow non-local voices')}
					description={$i18n.t('Include voices that are not provided by a local speech service.')}
				>
					<Switch bind:state={nonLocalVoices} />
				</UserSettingRow>
			</UserSettingSection>
		{:else if Boolean($config?.audio?.tts?.engine)}
			<UserSettingSection title={$i18n.t('Voice')}>
				<UserSettingField
					label={$i18n.t('Set Voice')}
					description={$i18n.t('Choose the configured text-to-speech service voice.')}
				>
					<input
						list="voice-list"
						class={inputClass}
						bind:value={voice}
						aria-label={$i18n.t('Voice')}
						placeholder={$i18n.t('Select a voice')}
					/>

					<datalist id="voice-list">
						{#each voices as voice}
							<option value={voice.id}>{voice.name}</option>
						{/each}
					</datalist>
				</UserSettingField>
			</UserSettingSection>
		{/if}
	</div>

	<div class="shrink-0 flex justify-end text-sm font-normal">
		<button
			class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
			type="submit"
		>
			{$i18n.t('Save')}
		</button>
	</div>
</form>
