<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import { trackEvent } from '$lib/utils/analytics';
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	import type { PublicRateCardModel } from '$lib/apis/billing';

	const i18n = getContext<Readable<I18n>>('i18n');
	$: locale = getI18nLocale($i18n);

	export let models: PublicRateCardModel[] = [];
	export let currency: string = 'RUB';
	export let updatedAt: string | null = null;
	export let popularModelIds: string[] = [];
	export let defaultView: 'popular' | 'all' = 'popular';
	export let loading: boolean = false;
	export let error: string | null = null;

	let searchQuery = '';
	let filter: 'all' | 'text' | 'image' | 'audio' = 'all';
	let showAll = defaultView === 'all';
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	const fallbackPopularCount = 8;

	const formatMoney = (kopeks: number, locale: string): string => {
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat(locale, {
				style: 'currency',
				currency
			}).format(amount);
		} catch {
			return `${amount.toFixed(2)} ${currency}`.trim();
		}
	};

	const formatRate = (rate: number | null, locale: string): string => {
		if (rate === null || rate === undefined) return '—';
		return formatMoney(rate, locale);
	};

	const formatUpdatedAt = (value: string | null, locale: string): string | null => {
		if (!value) return null;
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		try {
			return new Intl.DateTimeFormat(locale, {
				dateStyle: 'medium',
				timeStyle: 'short'
			}).format(parsed);
		} catch {
			return value;
		}
	};

	$: popularSet = new Set(
		popularModelIds.length
			? popularModelIds
			: models.slice(0, fallbackPopularCount).map((model) => model.id)
	);

	$: normalizedQuery = searchQuery.trim().toLowerCase();

	$: filteredModels = models.filter((model) => {
		const name = `${model.display_name} ${model.provider ?? ''}`.toLowerCase();
		const matchesQuery = normalizedQuery ? name.includes(normalizedQuery) : true;
		const matchesFilter =
			filter === 'all'
				? true
				: filter === 'text'
					? model.rates.text_in_1000_tokens !== null && model.rates.text_out_1000_tokens !== null
					: filter === 'image'
						? model.rates.image_1024 !== null
						: model.rates.tts_1000_chars !== null || model.rates.stt_minute !== null;
		return matchesQuery && matchesFilter;
	});

	$: visibleModels = filteredModels.filter((model) => {
		if (showAll || normalizedQuery) {
			return true;
		}
		return popularSet.has(model.id);
	});

	$: updatedAtLabel = formatUpdatedAt(updatedAt, locale);
	$: showUpdatedAt = Boolean(updatedAtLabel) && models.length > 0 && !loading && !error;

	const handleSearch = (value: string): void => {
		searchQuery = value;
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		searchTimeout = setTimeout(() => {
			if (searchQuery.trim()) {
				trackEvent('pricing_rates_search', { query: searchQuery.trim() });
			}
		}, 350);
	};

	const handleFilterChange = (value: 'all' | 'text' | 'image' | 'audio'): void => {
		filter = value;
		trackEvent('pricing_rates_filter_change', { filter: value });
	};

	const handleShowAll = (): void => {
		showAll = true;
		trackEvent('pricing_rates_expand_all_click');
	};
	onDestroy(() => {
		if (searchTimeout) clearTimeout(searchTimeout);
	});
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div class="flex flex-col gap-2">
			<label class="text-sm font-medium text-gray-700 dark:text-gray-200" for="rates-search"
				>{$i18n.t('Search models')}</label
			>
			<input
				id="rates-search"
				type="search"
				value={searchQuery}
				on:input={(event) => handleSearch((event.target as HTMLInputElement).value)}
				placeholder={$i18n.t('Search models')}
				class="min-h-11 w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
			/>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each [{ id: 'all', label: 'All' }, { id: 'text', label: 'Text' }, { id: 'image', label: 'Images' }, { id: 'audio', label: 'Audio' }] as option}
				<button
					type="button"
					aria-pressed={filter === option.id}
					on:click={() => handleFilterChange(option.id as 'all' | 'text' | 'image' | 'audio')}
					class={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 ${
						filter === option.id
							? 'border-gray-900 bg-gray-900 text-white'
							: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
					}`}
				>
					{$i18n.t(option.label)}
				</button>
			{/each}
		</div>
	</div>

	{#if showUpdatedAt}
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{$i18n.t('Rates updated {{date}}', { date: updatedAtLabel })}
		</p>
	{/if}

	{#if loading}
		<div class="space-y-3">
			{#each [0, 1, 2, 3, 4, 5] as index}
				<div
					class="h-12 rounded-xl bg-gray-200/70 animate-pulse motion-reduce:animate-none"
					data-skeleton-index={index}
					aria-hidden="true"
				></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
			{error}
		</div>
	{:else if visibleModels.length === 0}
		<div class="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
			{$i18n.t('No models match these filters.')}
		</div>
	{:else}
		<div class="grid gap-3 md:hidden">
			{#each visibleModels as model (model.id)}<article
					class="rounded-xl border border-gray-200 bg-white p-4"
				>
					<h3 class="font-semibold text-gray-900 break-words">{model.display_name}</h3>
					<dl class="mt-3 space-y-2 text-sm text-gray-700">
						{#each [{ label: 'Input: 1,000 tokens', rate: model.rates.text_in_1000_tokens }, { label: 'Reply: 1,000 tokens', rate: model.rates.text_out_1000_tokens }, { label: 'Image: 1024px', rate: model.rates.image_1024 }, { label: 'Speech: 1,000 characters', rate: model.rates.tts_1000_chars }, { label: 'Transcription: 1 minute', rate: model.rates.stt_minute }] as item}{#if item.rate !== null}<div
									class="flex justify-between gap-3"
								>
									<dt>{$i18n.t(item.label)}</dt>
									<dd class="shrink-0 tabular-nums">{formatRate(item.rate, locale)}</dd>
								</div>{/if}{/each}
					</dl>
				</article>{/each}
		</div>
		<div class="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 bg-white">
			<table class="min-w-[840px] w-full text-sm text-gray-700 tabular-nums">
				<thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
					<tr>
						<th class="sticky left-0 bg-gray-50 z-10 text-left px-4 py-3">{$i18n.t('Model')}</th>
						<th class="text-left px-4 py-3">
							<span title={$i18n.t('Input is your request. Price per 1,000 tokens.')}
								>{$i18n.t('Input: 1,000 tokens')}</span
							>
						</th>
						<th class="text-left px-4 py-3">
							<span title={$i18n.t('Reply is the model response. Price per 1,000 tokens.')}
								>{$i18n.t('Reply: 1,000 tokens')}</span
							>
						</th>
						<th class="text-left px-4 py-3">
							<span title={$i18n.t('Image at a fixed rate.')}>{$i18n.t('Image: 1024px')}</span>
						</th>
						<th class="text-left px-4 py-3">
							<span title={$i18n.t('Speech price per 1,000 characters.')}
								>{$i18n.t('Speech: 1,000 characters')}</span
							>
						</th>
						<th class="text-left px-4 py-3">
							<span title={$i18n.t('Transcription price per minute.')}
								>{$i18n.t('Transcription: 1 minute')}</span
							>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each visibleModels as model (model.id)}
						<tr class="border-t border-gray-100">
							<td class="sticky left-0 bg-white z-10 px-4 py-3 font-semibold text-gray-900">
								<div class="flex flex-col">
									<span>{model.display_name}</span>
								</div>
							</td>
							<td class="px-4 py-3">{formatRate(model.rates.text_in_1000_tokens, locale)}</td>
							<td class="px-4 py-3">{formatRate(model.rates.text_out_1000_tokens, locale)}</td>
							<td class="px-4 py-3">{formatRate(model.rates.image_1024, locale)}</td>
							<td class="px-4 py-3">{formatRate(model.rates.tts_1000_chars, locale)}</td>
							<td class="px-4 py-3">{formatRate(model.rates.stt_minute, locale)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if !showAll && !normalizedQuery && filteredModels.length > visibleModels.length}
			<button
				type="button"
				on:click={handleShowAll}
				class="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
			>
				{$i18n.t('Show all models ({{count}})', { count: filteredModels.length })}
			</button>
		{/if}
	{/if}
</div>
