<script lang="ts">
	import { onMount } from 'svelte';
	import { trackEvent } from '$lib/utils/analytics';
	import type { FeatureCategory, FeaturePreset } from '$lib/data/features';

	export let presets: FeaturePreset[] = [];
	export let categories: FeatureCategory[] = [];
	export let initialCategory: string = 'all';
	export let maxVisibleMobile: number = 6;
	export let loading: boolean = false;
	export let emptyLabel: string = 'Шаблоны временно недоступны';
	export let source: string = 'features_examples';
	export let onTryPreset: (presetId: string, src: string) => void = () => {};

	let activeCategory = initialCategory;
	let showAll = false;
	let isMobile = false;

	const updateIsMobile = () => {
		if (typeof window === 'undefined') return;
		isMobile = window.innerWidth < 768;
	};

	const handleCategoryChange = (categoryId: string) => {
		activeCategory = categoryId;
		showAll = false;
	};

	const handleCardKeydown = (event: KeyboardEvent, action: () => void) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			action();
		}
	};

	const handleTryPreset = (preset: FeaturePreset) => {
		trackEvent('features_preset_try_click', {
			preset_id: preset.id,
			category: preset.category,
			src: source
		});
		onTryPreset(preset.id, source);
	};

	onMount(() => {
		updateIsMobile();
		if (typeof window === 'undefined') return;
		window.addEventListener('resize', updateIsMobile);
		return () => window.removeEventListener('resize', updateIsMobile);
	});

	$: labelByCategory = categories.reduce<Record<string, string>>((acc, category) => {
		acc[category.id] = category.label;
		return acc;
	}, {});

	$: filteredPresets =
		activeCategory === 'all'
			? presets
			: presets.filter((preset) => preset.category === activeCategory);

	$: visiblePresets =
		showAll || !isMobile ? filteredPresets : filteredPresets.slice(0, maxVisibleMobile);

	$: canShowMore = isMobile && filteredPresets.length > maxVisibleMobile;
</script>

<div class="space-y-8">
	<div class="flex flex-wrap gap-2">
		{#each categories as category}
			<button
				type="button"
				class={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 ${
					activeCategory === category.id
						? 'border-gray-900 bg-gray-900 text-white'
						: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
				}`}
				aria-pressed={activeCategory === category.id}
				on:click={() => handleCategoryChange(category.id)}
			>
				{category.label}
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array.from({ length: 6 }) as _, index}
				<div class="h-40 rounded-2xl bg-gray-200/70 animate-pulse" aria-hidden="true"></div>
			{/each}
		</div>
	{:else if filteredPresets.length === 0}
		<div class="features-card features-card--soft p-6 text-sm text-gray-600">
			{emptyLabel}
		</div>
	{:else}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each visiblePresets as preset, index}
				<div
					class="features-card features-card--soft features-card--clickable flex h-full flex-col gap-4 p-6"
					role="button"
					tabindex="0"
					data-index={index}
					on:click={() => handleTryPreset(preset)}
					on:keydown={(event) => handleCardKeydown(event, () => handleTryPreset(preset))}
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<h3 class="text-base font-semibold text-gray-900">{preset.title}</h3>
							<p class="mt-1 text-sm text-gray-600 break-words">{preset.result}</p>
						</div>
						<span
							class="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 shrink-0 whitespace-nowrap"
						>
							{labelByCategory[preset.category] ?? preset.category}
						</span>
					</div>
					<button
						type="button"
						class="mt-auto inline-flex w-fit items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
						on:click={(event) => {
							event.stopPropagation();
							handleTryPreset(preset);
						}}
					>
						Попробовать
					</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if canShowMore}
		<button
			type="button"
			class="inline-flex items-center gap-2 text-sm font-semibold text-gray-700"
			on:click={() => (showAll = !showAll)}
		>
			{showAll ? 'Скрыть' : 'Показать ещё'}
			<span aria-hidden="true">→</span>
		</button>
	{/if}
</div>
