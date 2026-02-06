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

	type LeadMagnetGroupId = 'text' | 'images' | 'voice' | 'other';

	type LeadMagnetGroup = {
		id: LeadMagnetGroupId;
		title: string;
		metrics: LeadMagnetMetric[];
	};

	const MAX_COLLAPSED_GROUPS = 2;
	const GROUP_ORDER: LeadMagnetGroupId[] = ['text', 'images', 'voice', 'other'];
	const KEY_TO_GROUP: Record<string, LeadMagnetGroupId> = {
		tokens_input: 'text',
		tokens_output: 'text',
		images: 'images',
		tts_seconds: 'voice',
		stt_seconds: 'voice'
	};

	const METRIC_ORDER: string[] = [
		'tokens_input',
		'tokens_output',
		'images',
		'tts_seconds',
		'stt_seconds',
		'requests',
		'audio_minutes'
	];

	let showModels = false;
	let showAllModels = false;
	let showAllLimits = false;

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

	const getGroupTitle = (group: LeadMagnetGroupId): string => {
		if (group === 'text') return $i18n.t('Text');
		if (group === 'images') return $i18n.t('Images');
		if (group === 'voice') return $i18n.t('Voice');
		return $i18n.t('Other');
	};

	const getGroupMetricLabel = (group: LeadMagnetGroupId, key: string): string => {
		if (group === 'text' && key === 'tokens_input') return $i18n.t('Input');
		if (group === 'text' && key === 'tokens_output') return $i18n.t('Output');
		if (group === 'voice' && key === 'tts_seconds') return $i18n.t('TTS');
		if (group === 'voice' && key === 'stt_seconds') return $i18n.t('STT');
		return getLocalizedQuotaLabel(key);
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
			})
			.sort((a, b) => {
				const aIndex = METRIC_ORDER.indexOf(a.key);
				const bIndex = METRIC_ORDER.indexOf(b.key);
				return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
			});
	};

	const groupMetrics = (metrics: LeadMagnetMetric[]): LeadMagnetGroup[] => {
		const buckets: Record<LeadMagnetGroupId, LeadMagnetMetric[]> = {
			text: [],
			images: [],
			voice: [],
			other: []
		};

		metrics.forEach((metric) => {
			const group = KEY_TO_GROUP[metric.key] ?? 'other';
			buckets[group].push(metric);
		});

		const sortByOrder = (a: LeadMagnetMetric, b: LeadMagnetMetric): number => {
			const aIndex = METRIC_ORDER.indexOf(a.key);
			const bIndex = METRIC_ORDER.indexOf(b.key);
			return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
		};

		return GROUP_ORDER.map((group) => ({
			id: group,
			title: getGroupTitle(group),
			metrics: buckets[group].sort(sortByOrder)
		})).filter((group) => group.metrics.length > 0);
	};

	$: leadMagnetMetrics = getLeadMagnetMetrics(leadMagnetInfo);
	$: leadMagnetGroups = groupMetrics(leadMagnetMetrics);
	$: visibleGroups = showAllLimits
		? leadMagnetGroups
		: leadMagnetGroups.slice(0, MAX_COLLAPSED_GROUPS);
	$: hasHiddenGroups = leadMagnetGroups.length > MAX_COLLAPSED_GROUPS;
	$: hasTokenMetrics = leadMagnetMetrics.some((metric) =>
		metric.key === 'tokens_input' || metric.key === 'tokens_output'
	);
	$: visibleModels = showAllModels ? models : models.slice(0, 5);
	$: hasHiddenModels = models.length > 5;
</script>

<div
	class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
	id="free-limit-section"
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
		<span class="mx-1">•</span>
		{$i18n.t('Free limit applies to select models')}
	</div>

	{#if leadMagnetGroups.length > 0}
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			{#each visibleGroups as group (group.id)}
				<div class="rounded-2xl border border-gray-100/40 dark:border-gray-850/40 p-3">
					<div class="text-xs font-semibold text-gray-700 dark:text-gray-200">{group.title}</div>
					<div class="mt-3 space-y-3">
						{#each group.metrics as metric (`${group.id}:${metric.key}`)}
							<div>
								<div class="flex items-center justify-between mb-1">
									<span class="text-xs font-medium text-gray-600 dark:text-gray-300">
										{getGroupMetricLabel(group.id, metric.key)}
									</span>
									<span class="text-xs text-gray-500">
										{formatCompactNumber(metric.used)} / {formatCompactNumber(metric.limit)}
									</span>
								</div>
								<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
									<div
										class="{getUsageColor(metric.percentage)} h-1.5 rounded-full transition-all"
										style="width: {metric.percentage}%"
									></div>
								</div>
								<div class="text-[11px] text-gray-500 mt-1">
									{metric.percentage}% {$i18n.t('used')}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
		{#if hasTokenMetrics}
			<div class="text-xs text-gray-500 mt-3">
				{$i18n.t('Tokens are counted automatically')}
			</div>
		{/if}
		{#if hasHiddenGroups}
			<button
				type="button"
				class="mt-3 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition"
				on:click={() => (showAllLimits = !showAllLimits)}
			>
				{showAllLimits ? $i18n.t('Hide limits') : $i18n.t('Show all limits')}
			</button>
		{/if}
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
				{showModels
					? $i18n.t('Hide models')
					: `${$i18n.t('Models included')} (${models.length})`}
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
		<div class="text-xs text-gray-500 mt-3">
			{$i18n.t('No free models available')}.
			<a
				href="/pricing"
				target="_blank"
				rel="noreferrer"
				class="ml-1 underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200 transition"
			>
				{$i18n.t('Pricing')}
			</a>
		</div>
	{/if}
</div>
