<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';
	import type { PublicRateCardModel } from '$lib/apis/billing';

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

	const formatMoney = (kopeks: number): string => {
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

	const formatRate = (rate: number | null): string => {
		if (rate === null || rate === undefined) return '—';
		return formatMoney(rate);
	};

	const formatUpdatedAt = (value: string | null): string | null => {
		if (!value) return null;
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		try {
			return new Intl.DateTimeFormat('ru-RU', {
				dateStyle: 'medium',
				timeStyle: 'short'
			}).format(parsed);
		} catch (error) {
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
		const matchesFilter = filter === 'all' ? true : model.capabilities.includes(filter);
		return matchesQuery && matchesFilter;
	});

	$: visibleModels = filteredModels.filter((model) => {
		if (showAll || normalizedQuery) {
			return true;
		}
		return popularSet.has(model.id);
	});

	$: updatedAtLabel = formatUpdatedAt(updatedAt);
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
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div class="flex flex-col gap-2">
			<label class="text-sm font-medium text-gray-700" for="rates-search">Поиск модели</label>
			<input
				id="rates-search"
				type="search"
				value={searchQuery}
				on:input={(event) => handleSearch((event.target as HTMLInputElement).value)}
				placeholder="Поиск модели..."
				class="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
			/>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each [{ id: 'all', label: 'Все' }, { id: 'text', label: 'Текст' }, { id: 'image', label: 'Изображения' }, { id: 'audio', label: 'Аудио' }] as option}
				<button
					type="button"
					on:click={() => handleFilterChange(option.id as 'all' | 'text' | 'image' | 'audio')}
					class={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 ${
						filter === option.id
							? 'border-gray-900 bg-gray-900 text-white'
							: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
					}`}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	{#if showUpdatedAt}
		<p class="text-xs text-gray-500">Ставки обновлены {updatedAtLabel}</p>
	{/if}

	{#if loading}
		<div class="space-y-3">
			{#each Array.from({ length: 6 }) as _, index}
				<div class="h-12 rounded-xl bg-gray-200/70 animate-pulse" aria-hidden="true"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
			{error}
		</div>
	{:else if visibleModels.length === 0}
		<div class="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
			Нет моделей по выбранным условиям.
		</div>
	{:else}
		<div class="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
			<table class="min-w-[840px] w-full text-sm text-gray-700 tabular-nums">
				<thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
					<tr>
						<th class="sticky left-0 bg-gray-50 z-10 text-left px-4 py-3">Модель</th>
						<th class="text-left px-4 py-3">
							<span title="Ввод = ваш запрос. Цена за 1 000 токенов.">Текст (ввод) — за 1 000</span>
						</th>
						<th class="text-left px-4 py-3">
							<span title="Ответ = ответ модели. Цена за 1 000 токенов."
								>Текст (ответ) — за 1 000</span
							>
						</th>
						<th class="text-left px-4 py-3">
							<span title="Изображение по фиксированной ставке.">Изображение (1024px)</span>
						</th>
						<th class="text-left px-4 py-3">
							<span title="Озвучка: цена за 1 000 символов.">Озвучка (1 000 символов)</span>
						</th>
						<th class="text-left px-4 py-3">
							<span title="Распознавание: цена за 1 минуту.">Распознавание (1 мин)</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each visibleModels as model (model.id)}
						<tr class="border-t border-gray-100">
							<td class="sticky left-0 bg-white z-10 px-4 py-3 font-semibold text-gray-900">
								<div class="flex flex-col">
									<span>{model.display_name}</span>
									{#if model.provider}
										<span class="text-xs text-gray-500">{model.provider}</span>
									{/if}
								</div>
							</td>
							<td class="px-4 py-3">{formatRate(model.rates.text_in_1000_tokens)}</td>
							<td class="px-4 py-3">{formatRate(model.rates.text_out_1000_tokens)}</td>
							<td class="px-4 py-3">{formatRate(model.rates.image_1024)}</td>
							<td class="px-4 py-3">{formatRate(model.rates.tts_1000_chars)}</td>
							<td class="px-4 py-3">{formatRate(model.rates.stt_minute)}</td>
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
				Показать все модели ({filteredModels.length})
			</button>
		{/if}
	{/if}
</div>
