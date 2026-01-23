<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';
	import FeaturesExamplePanel from './FeaturesExamplePanel.svelte';
	import type { FeaturePreset, FeatureTabConfig } from '$lib/data/features';

	export let tabs: FeatureTabConfig[] = [];
	export let presetsById: Record<string, FeaturePreset> = {};
	export let onTryPreset: (presetId: string, src: string) => void = () => {};

	let activeTabId = '';

	$: if (!activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
		activeTabId = tabs[0]?.id ?? '';
	}

	$: activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

	const handleTabChange = (tabId: string) => {
		activeTabId = tabId;
		trackEvent('features_tabs_change', { tab_id: tabId });
	};

	const handleTryPreset = (tab: FeatureTabConfig, preset?: FeaturePreset) => {
		if (!preset) return;
		const src = `features_tabs_${tab.id}`;
		trackEvent('features_preset_try_click', {
			preset_id: preset.id,
			category: preset.category,
			src
		});
		onTryPreset(preset.id, src);
	};
</script>

<div class="space-y-8">
	<div class="flex flex-wrap gap-2" role="tablist" aria-label="Категории возможностей">
		{#each tabs as tab}
			<button
				type="button"
				role="tab"
				id={`features-tab-${tab.id}`}
				aria-selected={activeTabId === tab.id}
				aria-controls={`features-panel-${tab.id}`}
				tabindex={activeTabId === tab.id ? 0 : -1}
				class={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 ${
					activeTabId === tab.id
						? 'border-gray-900 bg-gray-900 text-white'
						: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
				}`}
				on:click={() => handleTabChange(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if activeTab}
		<div
			class="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]"
			role="tabpanel"
			id={`features-panel-${activeTab.id}`}
			aria-labelledby={`features-tab-${activeTab.id}`}
			abindex="0"
		>
			<div class="space-y-6">
				<div class="space-y-3">
					<h3 class="text-2xl font-semibold text-gray-900">{activeTab.title}</h3>
					<ul class="space-y-2 text-sm text-gray-600">
						{#each activeTab.bullets as bullet}
							<li class="flex items-start gap-2">
								<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
								<span>{bullet}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
			<div>
				{#if presetsById[activeTab.examplePresetId]}
					<FeaturesExamplePanel
						prompt={presetsById[activeTab.examplePresetId].promptPreview ?? presetsById[activeTab.examplePresetId].prompt}
						resultPreview={presetsById[activeTab.examplePresetId].resultPreview ?? presetsById[activeTab.examplePresetId].result}
						tryPresetId={activeTab.examplePresetId}
						variant={activeTab.id === 'image' ? 'image' : activeTab.id === 'audio' ? 'audio' : activeTab.id === 'data' ? 'data' : 'text'}
						onTry={(presetId) => handleTryPreset(activeTab, presetsById[presetId])}
					/>
				{:else}
					<div class="features-card features-card--soft p-6 text-sm text-gray-600">
						Пример скоро появится.
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
