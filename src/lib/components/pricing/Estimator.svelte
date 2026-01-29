<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';
	import type { PublicRateCardResponse, PublicRateCardModel } from '$lib/apis/billing';

	type TextBucket = { label: string; tokens: number };
	type ReplyMultiplier = { label: string; value: number };
	type TextPreset = {
		id: string;
		label: string;
		description: string;
		messagesPerDay: number;
		bucket: string;
		replyMultiplier: number;
	};
	type ImagePreset = { id: string; label: string; description: string; count: number };
	type AudioMode = { id: 'tts' | 'stt'; label: string };

	export type PricingEstimatorConfig = {
		uncertainty: { min: number; max: number };
		text: {
			enabled: boolean;
			buckets: Record<string, TextBucket>;
			replyMultipliers: ReplyMultiplier[];
			presets: TextPreset[];
			default: { messagesPerDay: number; bucket: string; replyMultiplier: number };
		};
		image: {
			enabled: boolean;
			presets: ImagePreset[];
			default: { count: number };
		};
		audio: {
			enabled: boolean;
			modes: AudioMode[];
			default: { mode: 'tts' | 'stt'; chars: number; minutes: number };
		};
	};

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

	let activeTab: 'text' | 'image' | 'audio' = 'text';
	let textMessagesPerDay = config.text.default.messagesPerDay;
	let textBucket = config.text.default.bucket;
	let textReplyMultiplier = config.text.default.replyMultiplier;

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
		} catch (error) {
			return `${amount.toFixed(2)} ${currency}`.trim();
		}
	};

	const applyUncertainty = (total: number): { min: number; max: number } => {
		const min = Math.floor(total * config.uncertainty.min);
		const max = Math.ceil(total * config.uncertainty.max);
		return { min, max };
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

	$: textModel = resolveModel(recommendedModelIdByType.text, hasTextRates);
	$: imageModel = resolveModel(recommendedModelIdByType.image, hasImageRates);
	$: audioModel = resolveModel(recommendedModelIdByType.audio, hasAudioRates);

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

	const computeTextEstimate = (
		messagesPerDay: number,
		bucketId: string,
		replyMultiplier: number
	): { min: number; max: number } | null => {
		if (!textModel || !textRatesAvailable) return null;
		const bucket = config.text.buckets[bucketId];
		if (!bucket) return null;
		const rateIn = textModel.rates.text_in_1000_tokens ?? 0;
		const rateOut = textModel.rates.text_out_1000_tokens ?? 0;
		const tokensIn = bucket.tokens;
		const tokensOut = Math.round(bucket.tokens * replyMultiplier);
		const costIn = Math.ceil((tokensIn / 1000) * rateIn);
		const costOut = Math.ceil((tokensOut / 1000) * rateOut);
		const perMessage = costIn + costOut;
		const total = perMessage * (Number(messagesPerDay) || 0) * 30;
		return applyUncertainty(total);
	};

	const computeImageEstimate = (count: number): { min: number; max: number } | null => {
		if (!imageModel || !imageRatesAvailable) return null;
		const rate = imageModel.rates.image_1024 ?? 0;
		const total = Math.ceil(rate * (Number(count) || 0));
		return applyUncertainty(total);
	};

	const computeAudioEstimate = (): { min: number; max: number } | null => {
		if (!audioModel || !audioRatesAvailable) return null;
		if (audioMode === 'tts') {
			const rate = audioModel.rates.tts_1000_chars;
			if (rate === null) return null;
			const total = Math.ceil(((Number(audioChars) || 0) / 1000) * rate);
			return applyUncertainty(total);
		}
		const rate = audioModel.rates.stt_minute;
		if (rate === null) return null;
		const total = Math.ceil((Number(audioMinutes) || 0) * rate);
		return applyUncertainty(total);
	};

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

	const handlePresetClick = (presetId: string, handler: () => void): void => {
		handler();
		trackEvent('pricing_estimator_preset_click', { preset: presetId });
	};

	const scrollToCalculation = (): void => {
		if (onScrollToCalculation) {
			onScrollToCalculation();
			return;
		}
		const target = document.getElementById('calculation');
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const handlePrimaryAction = (): void => {
		if (onPrimaryAction) {
			onPrimaryAction();
		}
	};

	$: exampleTextPresets = config.text.presets.map((preset) => ({
		...preset,
		estimate: computeTextEstimate(preset.messagesPerDay, preset.bucket, preset.replyMultiplier)
	}));

	$: exampleImagePresets = config.image.presets.map((preset) => ({
		...preset,
		estimate: computeImageEstimate(preset.count)
	}));

	$: textEstimate = computeTextEstimate(textMessagesPerDay, textBucket, textReplyMultiplier);
	$: imageEstimate = computeImageEstimate(imageCount);
	$: audioEstimate = computeAudioEstimate();
</script>

<div class="space-y-8">
	{#if loading}
		<div class="grid gap-6 md:grid-cols-3">
			{#each Array.from({ length: 3 }) as _}
				<div class="h-24 rounded-2xl bg-gray-200/70 animate-pulse" aria-hidden="true"></div>
			{/each}
		</div>
	{:else}
		<div class="grid gap-6 md:grid-cols-3">
			{#if config.text.enabled}
				{#each exampleTextPresets as preset}
					<button
						type="button"
						class="text-left rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-gray-300"
						on:click={() =>
							handlePresetClick(preset.id, () => {
								activeTab = 'text';
								textMessagesPerDay = preset.messagesPerDay;
								textBucket = preset.bucket;
								textReplyMultiplier = preset.replyMultiplier;
								scheduleEstimatorChange();
							})}
					>
						<div class="text-sm font-semibold text-gray-900">{preset.label}</div>
						<div class="mt-1 text-xs text-gray-500">{preset.description}</div>
						<div class="mt-3 text-lg font-semibold text-gray-900 tabular-nums">
							≈ {formatRange(preset.estimate)} / месяц
						</div>
					</button>
				{/each}
			{/if}

			{#if config.image.enabled}
				{#each exampleImagePresets as preset}
					<button
						type="button"
						class="text-left rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-gray-300"
						on:click={() =>
							handlePresetClick(preset.id, () => {
								activeTab = 'image';
								imageCount = preset.count;
								scheduleEstimatorChange();
							})}
					>
						<div class="text-sm font-semibold text-gray-900">{preset.label}</div>
						<div class="mt-1 text-xs text-gray-500">{preset.description}</div>
						<div class="mt-3 text-lg font-semibold text-gray-900 tabular-nums">
							≈ {formatRange(preset.estimate)}
						</div>
					</button>
				{/each}
			{/if}
		</div>
	{/if}

	<p class="text-xs text-gray-500">
		Оценка. Реальная сумма зависит от содержания запросов и выбранной модели. Итоговые списания
		видны в истории.
	</p>

	<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
		{#if loading}
			<div class="h-24 rounded-xl bg-gray-200/70 animate-pulse" aria-hidden="true"></div>
		{:else}
			{#if error}
				<p class="text-sm text-gray-500">{error}</p>
			{/if}

			<div role="tablist" class="flex flex-wrap gap-2">
				{#each availableTabs as tab}
					<button
						type="button"
						role="tab"
						id={`estimator-tab-${tab.id}`}
						aria-selected={activeTab === tab.id}
						aria-controls={`estimator-panel-${tab.id}`}
						on:click={() => handleTabChange(tab.id as 'text' | 'image' | 'audio')}
						class={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 ${
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
						role="tabpanel"
						aria-labelledby="estimator-tab-text"
						class="space-y-4"
					>
						<div class="grid gap-4 md:grid-cols-3">
							<label class="text-sm text-gray-600">
								Сообщений в день
								<input
									type="number"
									min="1"
									bind:value={textMessagesPerDay}
									on:input={scheduleEstimatorChange}
									class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
								/>
							</label>
							<label class="text-sm text-gray-600">
								Объём запроса
								<select
									bind:value={textBucket}
									on:change={scheduleEstimatorChange}
									class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
								>
									{#each Object.entries(config.text.buckets) as [key, bucket]}
										<option value={key}>{bucket.label}</option>
									{/each}
								</select>
							</label>
							<label class="text-sm text-gray-600">
								Объём ответа
								<select
									value={textReplyMultiplier}
									on:change={(event) => {
										textReplyMultiplier = Number((event.currentTarget as HTMLSelectElement).value);
										scheduleEstimatorChange();
									}}
									class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
								>
									{#each config.text.replyMultipliers as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</label>
						</div>
						<div class="text-lg font-semibold text-gray-900 tabular-nums">
							≈ {formatRange(textEstimate)} / месяц
						</div>
					</div>
				{:else if activeTab === 'image'}
					<div
						id="estimator-panel-image"
						role="tabpanel"
						aria-labelledby="estimator-tab-image"
						class="space-y-4"
					>
						<label class="text-sm text-gray-600">
							Количество изображений
							<input
								type="number"
								min="1"
								bind:value={imageCount}
								on:input={scheduleEstimatorChange}
								class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
							/>
						</label>
						<div class="text-lg font-semibold text-gray-900 tabular-nums">
							≈ {formatRange(imageEstimate)}
						</div>
					</div>
				{:else if activeTab === 'audio'}
					<div
						id="estimator-panel-audio"
						role="tabpanel"
						aria-labelledby="estimator-tab-audio"
						class="space-y-4"
					>
						<div class="flex flex-wrap gap-2">
							{#each audioModesAvailable as mode}
								<button
									type="button"
									on:click={() => {
										audioMode = mode.id;
										scheduleEstimatorChange();
									}}
									class={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 ${
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
									bind:value={audioChars}
									on:input={scheduleEstimatorChange}
									class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
								/>
							</label>
						{:else}
							<label class="text-sm text-gray-600">
								Минут распознавания
								<input
									type="number"
									min="1"
									bind:value={audioMinutes}
									on:input={scheduleEstimatorChange}
									class="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
								/>
							</label>
						{/if}
						<div class="text-lg font-semibold text-gray-900 tabular-nums">
							≈ {formatRange(audioEstimate)}
						</div>
					</div>
				{/if}
			</div>

			<div class="mt-6 flex flex-wrap items-center gap-4">
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-full bg-black px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900"
					on:click={handlePrimaryAction}
				>
					{primaryLabel}
				</button>
				<button
					type="button"
					class="text-sm font-semibold text-gray-600 hover:text-gray-900"
					on:click={scrollToCalculation}
				>
					Как считается стоимость
				</button>
			</div>
		{/if}
	</div>
</div>
