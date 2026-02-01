<script lang="ts">
	import { getContext } from 'svelte';
	import {
		formatCompactNumber,
		getUsagePercentage,
		getUsageColor,
		getQuotaLabel
	} from '$lib/utils/billing-formatters';
	import type { LeadMagnetInfo } from '$lib/apis/billing';

	const i18n = getContext('i18n');

	type LeadMagnetModel = {
		id: string;
		name: string;
	};

	type LeadMagnetMetric = {
		key: string;
		used: number;
		limit: number;
		remaining: number;
		percentage: number;
	};

	export let leadMagnetInfo: LeadMagnetInfo;
	export let models: LeadMagnetModel[] = [];
	export let modelsReady = false;

	let showModels = false;
	let showAllModels = false;

	const formatDateTime = (timestamp: number | null | undefined): string => {
		if (!timestamp) return $i18n.t('Never');
		return new Date(timestamp * 1000).toLocaleString($i18n.locale, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const getLocalizedQuotaLabel = (key: string): string => {
		return getQuotaLabel(key, (k) => $i18n.t(k));
	};

	const getLeadMagnetMetrics = (leadMagnet?: LeadMagnetInfo | null): LeadMagnetMetric[] => {
		if (!leadMagnet) return [];
		return Object.entries(leadMagnet.quotas ?? {})
			.filter(([, limit]) => typeof limit === 'number' && limit > 0)
			.map(([key, limit]) => {
				const used = leadMagnet.usage?.[key as keyof LeadMagnetInfo['usage']] ?? 0;
				const remaining =
					leadMagnet.remaining?.[key as keyof LeadMagnetInfo['remaining']] ??
					Math.max(0, limit - used);
				return {
					key,
					used,
					limit,
					remaining,
					percentage: getUsagePercentage(used, limit)
				};
			});
	};

	$: leadMagnetMetrics = getLeadMagnetMetrics(leadMagnetInfo);
	$: visibleModels = showAllModels ? models : models.slice(0, 5);
	$: hasHiddenModels = models.length > 5;
</script>

<div
	class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
	data-testid="lead-magnet-section"
>
	<div class="flex items-start justify-between mb-3">
		<h3 class="text-sm font-medium">
			{$i18n.t('Free limit')}
		</h3>
		<span class="px-1.5 py-0.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
			{$i18n.t('Free')}
		</span>
	</div>

	<div class="text-xs text-gray-500 mb-3">
		{$i18n.t('Next reset')}: {formatDateTime(leadMagnetInfo.cycle_end)}
	</div>

	{#if leadMagnetMetrics.length > 0}
		<div class="space-y-4">
			{#each leadMagnetMetrics as metric}
				<div>
					<div class="flex items-center justify-between mb-1.5">
						<span class="text-sm font-medium">
							{getLocalizedQuotaLabel(metric.key)}
						</span>
						<span class="text-sm text-gray-500">
							{formatCompactNumber(metric.remaining)} / {formatCompactNumber(metric.limit)}
						</span>
					</div>
					<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
						<div
							class="{getUsageColor(metric.percentage)} h-1.5 rounded-full transition-all"
							style="width: {metric.percentage}%"
						></div>
					</div>
					<div class="text-xs text-gray-500 mt-1">
						{metric.percentage.toFixed(1)}% {$i18n.t('used')}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-sm text-gray-500">
			{$i18n.t('No free limits configured')}
		</div>
	{/if}

	{#if !modelsReady || models.length > 0}
		<div class="mt-4">
			<button
				type="button"
				class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
				on:click={() => (showModels = !showModels)}
			>
				{showModels ? $i18n.t('Hide models') : $i18n.t('Models included')}
			</button>
			{#if showModels}
				{#if !modelsReady}
					<div class="text-xs text-gray-500 mt-2">{$i18n.t('List unavailable')}</div>
				{:else}
					<div class="mt-2 flex flex-wrap gap-2">
						{#each visibleModels as model}
							<span class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
								{model.name}
							</span>
						{/each}
					</div>
					{#if hasHiddenModels}
						<button
							type="button"
							class="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
							on:click={() => (showAllModels = !showAllModels)}
						>
							{showAllModels ? $i18n.t('Show less') : $i18n.t('Show all')}
						</button>
					{/if}
				{/if}
			{/if}
		</div>
	{:else}
		<div class="text-xs text-gray-500 mt-3">{$i18n.t('No free models available')}</div>
	{/if}
</div>
