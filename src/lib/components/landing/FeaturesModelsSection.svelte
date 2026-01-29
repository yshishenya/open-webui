<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';

	export type ModelItem = {
		id: string;
		displayName: string;
		provider?: string | null;
		capabilities: string[];
	};

	export let models: ModelItem[] = [];
	export let maxVisible: number = 12;
	export let loading: boolean = false;
	export let error: string | null = null;

	let showAll = false;

	$: visibleModels = showAll ? models : models.slice(0, maxVisible);

	const handleShowAll = () => {
		showAll = true;
		trackEvent('features_models_show_all_click');
	};
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
		<span>
			Доступно моделей: <span class="font-semibold text-gray-900">{models.length}</span>
		</span>
	</div>

	{#if loading}
		<div class="flex flex-wrap gap-2">
			{#each Array.from({ length: 10 }) as _}
				<div class="h-9 w-28 rounded-full bg-gray-200/70 animate-pulse" aria-hidden="true"></div>
			{/each}
		</div>
	{:else if error}
		<div class="features-card features-card--soft p-6 text-sm text-gray-600">
			{error}
		</div>
	{:else if models.length === 0}
		<div class="features-card features-card--soft p-6 text-sm text-gray-600">
			Не удалось загрузить список моделей.
		</div>
	{:else}
		<div class="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
			{#each visibleModels as model}
				<div
					class="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap"
				>
					<span>{model.displayName}</span>
					{#if model.provider}
						<span class="ml-2 text-[0.65rem] font-medium text-gray-500">{model.provider}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if !loading && !error && models.length > maxVisible && !showAll}
		<button
			type="button"
			class="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors"
			on:click={handleShowAll}
		>
			Показать все
		</button>
	{/if}

	<p class="text-xs text-gray-500">Список моделей может меняться. Актуально — в приложении.</p>
</div>
