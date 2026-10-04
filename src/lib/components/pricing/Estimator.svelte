<script context="module" lang="ts">
	type AudioMode = { id: 'tts' | 'stt'; label: string };

	export type PricingEstimatorConfig = {
		uncertainty: { min: number; max: number };
		text: {
			enabled: boolean;
			modelId?: string;
			tokensInPerMessage: number;
			tokensOutPerMessage: number;
			default: { messagesPerDay: number };
		};
		image: {
			enabled: boolean;
			default: { count: number };
		};
		audio: {
			enabled: boolean;
			modes: AudioMode[];
			default: { mode: 'tts' | 'stt'; chars: number; minutes: number };
		};
	};
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { trackEvent } from '$lib/utils/analytics';
	import type { PublicRateCardResponse, PublicRateCardModel } from '$lib/apis/billing';
	import {
		calculateTextEstimate,
		calculateUsageEstimate,
		pickCheapestTextModel
	} from '$lib/utils/airis/pricing_estimator';

	export let config: PricingEstimatorConfig;
	export let rateCard: PublicRateCardResponse | null = null;
	export let recommendedModelIdByType: {
		text?: string | null;
		image?: string | null;
		audio?: string | null;
	} = {};
	export let loading: boolean = false;
	export let error: string | null = null;
	export let primaryLabel: string = 'Начать бесплатно';
	export let onPrimaryAction: (() => void) | null = null;
	export let onScrollToCalculation: (() => void) | null = null;

	let selectedTextModel = '';
	let selectedImageModel = '';
	let selectedAudioModel = '';
	let textScenario: 'continuous' | 'separate' = 'separate';
	let activeTab: 'text' | 'image' | 'audio' = 'text';
	let textMessagesPerDay = config.text.default.messagesPerDay;

	let imageCount = config.image.default.count;

	let audioMode: 'tts' | 'stt' = config.audio.default.mode;
	let audioChars = config.audio.default.chars;
	let audioMinutes = config.audio.default.minutes;

	let changeTimeout: ReturnType<typeof setTimeout> | null = null;

	const formatMoney = (kopeks: number | null): string => {
		if (kopeks === null || kopeks === undefined) return '—';
		const currency = rateCard?.currency ?? 'RUB';
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat('ru-RU', {
				style: 'currency',
				currency
			}).format(amount);
		} catch {
			return `${amount.toFixed(2)} ${currency}`.trim();
		}
	};

	const resolveModel = (
		preferredId: string | null | undefined,
		predicate: (model: PublicRateCardModel) => boolean
	): PublicRateCardModel | null => {
		if (!rateCard?.models?.length) return null;
		if (preferredId) {
			const preferred = rateCard.models.find((model) => model.id === preferredId);
			if (preferred && predicate(preferred)) return preferred;
		}
		return rateCard.models.find(predicate) ?? null;
	};

	const hasTextRates = (model: PublicRateCardModel): boolean => {
		return model.rates.text_in_1000_tokens !== null && model.rates.text_out_1000_tokens !== null;
	};

	const hasImageRates = (model: PublicRateCardModel): boolean => {
		return model.rates.image_1024 !== null;
	};

	const hasAudioRates = (model: PublicRateCardModel): boolean => {
		return model.rates.tts_1000_chars !== null || model.rates.stt_minute !== null;
	};

	// Keep the async rate-card dependency explicit so the estimate recalculates after the API response.
	$: rateCardModels = rateCard?.models ?? [];
	$: textModelPreference =
		selectedTextModel || config.text.modelId || recommendedModelIdByType.text;
	$: textModel = pickCheapestTextModel(rateCardModels, textModelPreference);
	$: imageModel = rateCard
		? resolveModel(selectedImageModel || recommendedModelIdByType.image, hasImageRates)
		: null;
	$: audioModel = rateCard
		? resolveModel(selectedAudioModel || recommendedModelIdByType.audio, hasAudioRates)
		: null;

	$: textRatesAvailable = textModel ? hasTextRates(textModel) : false;
	$: imageRatesAvailable = imageModel ? hasImageRates(imageModel) : false;
	$: audioRatesAvailable = audioModel ? hasAudioRates(audioModel) : false;

	$: availableTabs = [
		{ id: 'text', label: 'Текст', enabled: config.text.enabled && textRatesAvailable },
		{ id: 'image', label: 'Изображения', enabled: config.image.enabled && imageRatesAvailable },
		{ id: 'audio', label: 'Аудио', enabled: config.audio.enabled && audioRatesAvailable }
	].filter((tab) => tab.enabled);

	$: if (availableTabs.length && !availableTabs.find((tab) => tab.id === activeTab)) {
		activeTab = availableTabs[0].id as 'text' | 'image' | 'audio';
	}

	$: audioModesAvailable = audioModel
		? config.audio.modes.filter((mode) => {
				if (mode.id === 'tts') return audioModel.rates.tts_1000_chars !== null;
				if (mode.id === 'stt') return audioModel.rates.stt_minute !== null;
				return false;
			})
		: [];

	$: if (audioModesAvailable.length && !audioModesAvailable.find((mode) => mode.id === audioMode)) {
		audioMode = audioModesAvailable[0].id;
	}

	const computeImageEstimate = (
		model: PublicRateCardModel | null,
		count: number
	): { min: number; max: number } | null =>
		calculateUsageEstimate(model?.rates.image_1024 ?? null, count, 'image', config.uncertainty);
	const computeAudioEstimate = (
		model: PublicRateCardModel | null,
		mode: 'tts' | 'stt',
		chars: number,
		minutes: number
	): { min: number; max: number } | null =>
		mode === 'tts'
			? calculateUsageEstimate(
					model?.rates.tts_1000_chars ?? null,
					chars,
					'tts',
					config.uncertainty
				)
			: calculateUsageEstimate(model?.rates.stt_minute ?? null, minutes, 'stt', config.uncertainty);
	const formatRange = (range: { min: number; max: number } | null): string => {
		if (!range) return '—';
		return `${formatMoney(range.min)} – ${formatMoney(range.max)}`;
	};

	const handleTabChange = (tab: 'text' | 'image' | 'audio'): void => {
		activeTab = tab;
		trackEvent('pricing_estimator_tab_change', { tab });
	};

	const scheduleEstimatorChange = (): void => {
		if (changeTimeout) {
			clearTimeout(changeTimeout);
		}
		changeTimeout = setTimeout(() => {
			trackEvent('pricing_estimator_change', { tab: activeTab });
		}, 400);
	};

	const scrollToCalculation = (): void => {
		if (onScrollToCalculation) {
			onScrollToCalculation();
			return;
		}
		const target = document.getElementById('calculation');
		target?.scrollIntoView({
			behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			block: 'start'
		});
	};

	const handlePrimaryAction = (): void => {
		if (onPrimaryAction) {
			onPrimaryAction();
		}
	};

	onDestroy(() => {
		if (changeTimeout) clearTimeout(changeTimeout);
	});
	// Keep model/rate dependencies in the reactive statements; the helpers intentionally hide their reads.
	$: textInputValid =
		Number.isSafeInteger(textMessagesPerDay) &&
		textMessagesPerDay > 0 &&
		textMessagesPerDay <= 1000;
	$: textEstimate = textInputValid
		? calculateTextEstimate(
				textModel,
				config.text.tokensInPerMessage,
				config.text.tokensOutPerMessage,
				textMessagesPerDay,
				config.uncertainty,
				textScenario
			)
		: null;
	$: imageEstimate = computeImageEstimate(imageModel, imageCount);
	$: audioEstimate = computeAudioEstimate(audioModel, audioMode, audioChars, audioMinutes);
</script>

<div class="space-y-8">
	<p class="text-xs text-gray-500">
		Выберите модель и сценарий. Это примерная стоимость без учёта бесплатного остатка, а не
		обещанная сумма списания.
	</p>

	<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
		{#if loading}
			<div
				class="h-24 rounded-xl bg-gray-200/70 animate-pulse motion-reduce:animate-none"
				aria-hidden="true"
			></div>
		{:else}
			{#if error}
				<p class="text-sm text-gray-500">{error}</p>
			{/if}

			{#if !availableTabs.length}
				<p class="text-sm text-gray-500">
					Расчёт временно недоступен: для выбранных функций пока нет актуальной ставки.
				</p>
			{:else}
				<div role="group" aria-label="Тип задачи" class="flex flex-wrap gap-2">
					{#each availableTabs as tab}
						<button
							type="button"
							id={`estimator-tab-${tab.id}`}
							aria-pressed={activeTab === tab.id}
							aria-controls={`estimator-panel-${tab.id}`}
							on:click={() => handleTabChange(tab.id as 'text' | 'image' | 'audio')}
							class={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 ${
								activeTab === tab.id
									? 'border-gray-900 bg-gray-900 text-white'
									: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
							}`}
						>
							{tab.label}
						</button>
					{/each}
				</div>

				<div class="mt-6">
					{#if activeTab === 'text'}
						<div
							id="estimator-panel-text"
							role="region"
							aria-labelledby="estimator-tab-text"
							class="space-y-4"
						>
							<label class="block text-sm text-gray-700"
								>Модель
								<select
									value={textModel?.id ?? ''}
									on:change={(event) => {
										selectedTextModel = event.currentTarget.value;
										scheduleEstimatorChange();
									}}
									class="mt-2 block min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-gray-900"
								>
									{#each rateCardModels.filter(hasTextRates) as model}<option value={model.id}
											>{model.display_name}</option
										>{/each}
								</select></label
							>
							<label class="block text-sm text-gray-700"
								>Как вы общаетесь
								<select
									bind:value={textScenario}
									on:change={scheduleEstimatorChange}
									class="mt-2 block min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-gray-900"
									><option value="separate">Каждый запрос — новый чат</option><option
										value="continuous">Все сообщения — один длинный чат</option
									></select
								></label
							>
							<div class="grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr] md:items-end">
								<label class="text-sm text-gray-600">
									Сообщений в день
									<input
										type="number"
										min="1"
										max="1000"
										bind:value={textMessagesPerDay}
										on:input={scheduleEstimatorChange}
										class="mt-2 min-h-11 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
									/>
								</label>
								<p class="text-xs text-gray-500">
									{textScenario === 'continuous'
										? 'За 30 дней вся предыдущая переписка снова отправляется модели и входит в стоимость.'
										: '30 дней, без предыдущей переписки: каждый запрос начинается с пустого чата.'}
									Пример: {config.text.tokensInPerMessage} токенов в запросе и {config.text
										.tokensOutPerMessage} в ответе. Токены — короткие части текста.
								</p>
							</div>
							<div class="text-lg font-semibold text-gray-900 tabular-nums">
								≈ {formatRange(textEstimate)} / месяц
							</div>
						</div>
					{:else if activeTab === 'image'}
						<div
							id="estimator-panel-image"
							role="region"
							aria-labelledby="estimator-tab-image"
							class="space-y-4"
						>
							<label class="block text-sm text-gray-700"
								>Модель<select
									value={imageModel?.id ?? ''}
									on:change={(event) => {
										selectedImageModel = event.currentTarget.value;
										scheduleEstimatorChange();
									}}
									class="mt-2 block min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-gray-900"
									>{#each rateCardModels.filter(hasImageRates) as model}<option value={model.id}
											>{model.display_name}</option
										>{/each}</select
								></label
							>
							<label class="text-sm text-gray-600">
								Количество изображений
								<input
									type="number"
									min="1"
									max="10000"
									step="1"
									bind:value={imageCount}
									on:input={scheduleEstimatorChange}
									class="mt-2 min-h-11 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
								/>
							</label>
							<div class="text-lg font-semibold text-gray-900 tabular-nums">
								≈ {formatRange(imageEstimate)}
							</div>
						</div>
					{:else if activeTab === 'audio'}
						<div
							id="estimator-panel-audio"
							role="region"
							aria-labelledby="estimator-tab-audio"
							class="space-y-4"
						>
							<label class="block text-sm text-gray-700"
								>Модель<select
									value={audioModel?.id ?? ''}
									on:change={(event) => {
										selectedAudioModel = event.currentTarget.value;
										scheduleEstimatorChange();
									}}
									class="mt-2 block min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-gray-900"
									>{#each rateCardModels.filter(hasAudioRates) as model}<option value={model.id}
											>{model.display_name}</option
										>{/each}</select
								></label
							>
							<div class="flex flex-wrap gap-2">
								{#each audioModesAvailable as mode}
									<button
										type="button"
										on:click={() => {
											audioMode = mode.id;
											scheduleEstimatorChange();
										}}
										class={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 ${
											audioMode === mode.id
												? 'border-gray-900 bg-gray-900 text-white'
												: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
										}`}
									>
										{mode.label}
									</button>
								{/each}
							</div>
							{#if audioMode === 'tts'}
								<label class="text-sm text-gray-600">
									Символов для озвучки
									<input
										type="number"
										min="1"
										max="10000000"
										step="1"
										bind:value={audioChars}
										on:input={scheduleEstimatorChange}
										class="mt-2 min-h-11 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
									/>
								</label>
							{:else}
								<label class="text-sm text-gray-600">
									Минут распознавания
									<input
										type="number"
										min="0.01"
										max="43200"
										step="any"
										bind:value={audioMinutes}
										on:input={scheduleEstimatorChange}
										class="mt-2 min-h-11 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
									/>
								</label>
							{/if}
							<div class="text-lg font-semibold text-gray-900 tabular-nums">
								≈ {formatRange(audioEstimate)}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			{#if !loading && availableTabs.length && ((activeTab === 'text' && !textInputValid) || (activeTab === 'image' && imageEstimate === null) || (activeTab === 'audio' && audioEstimate === null))}<p
					class="mt-4 text-sm text-red-700"
					role="alert"
				>
					{activeTab === 'text'
						? 'Укажите целое число сообщений от 1 до 1 000.'
						: activeTab === 'image'
							? 'Укажите целое число изображений от 1 до 10 000.'
							: audioMode === 'tts'
								? 'Укажите целое число символов от 1 до 10 000 000.'
								: 'Укажите длительность больше нуля, не более 43 200 минут. Дробные минуты допустимы.'}
				</p>{/if}
			<div class="mt-6 flex flex-wrap items-center gap-4">
				<button
					type="button"
					class="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900"
					on:click={handlePrimaryAction}
				>
					{primaryLabel}
				</button>
				<button
					type="button"
					class="min-h-11 text-sm font-semibold text-gray-600 hover:text-gray-900"
					on:click={scrollToCalculation}
				>
					Как считается стоимость
				</button>
			</div>
		{/if}
	</div>
</div>
