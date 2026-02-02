<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { derived } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { models } from '$lib/stores';
	import { getLedger, getUsageEvents } from '$lib/apis/billing';
	import type { LedgerEntry, UsageEvent } from '$lib/apis/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');

	type FilterKey = 'all' | 'paid' | 'free' | 'topups';
	type TimelineKind =
		| 'usage'
		| 'free'
		| 'topup'
		| 'refund'
		| 'adjustment'
		| 'subscription_credit'
		| 'charge';

	type TimelineItem = {
		id: string;
		kind: TimelineKind;
		createdAt: number;
		title: string;
		subtitle: string;
		metrics: string[];
		amountKopeks: number | null;
		currency: string;
		isEstimated: boolean;
	};

	export let pageSize = 20;
	export let maxItems: number | null = null;
	export let showFilters = false;
	export let showLoadMore = true;
	export let currency: string | null = null;
	export let syncFilterWithUrl = false;
	export let onFilterChange: (filter: FilterKey) => void = () => {};

	let loading = true;
	let loadingMore = false;
	let ledgerEntries: LedgerEntry[] = [];
	let usageEntries: UsageEvent[] = [];
	let ledgerSkip = 0;
	let usageSkip = 0;
	let ledgerHasMore = true;
	let usageHasMore = true;
	let ledgerError: string | null = null;
	let usageError: string | null = null;
	let displayCount = pageSize;
	let activeFilter: FilterKey = 'all';
	const filterKeys: FilterKey[] = ['all', 'paid', 'free', 'topups'];
	const urlFilter = derived(page, ($page): FilterKey => {
		const value = $page.url.searchParams.get('filter');
		if (value && filterKeys.includes(value as FilterKey)) {
			return value as FilterKey;
		}
		return 'all';
	});

	const updateUrlFilter = async (filter: FilterKey): Promise<void> => {
		if (!syncFilterWithUrl) return;
		const params = new URLSearchParams($page.url.searchParams);
		if (filter === 'all') {
			params.delete('filter');
		} else {
			params.set('filter', filter);
		}
		const query = params.toString();
		const target = query ? `${$page.url.pathname}?${query}` : $page.url.pathname;
		await goto(target, { replaceState: true, keepFocus: true, noScroll: true });
	};

	const fetchLedger = async (): Promise<void> => {
		if (!ledgerHasMore) return;
		try {
			const result = await getLedger(localStorage.token, pageSize, ledgerSkip);
			const newEntries = result ?? [];
			ledgerEntries = [...ledgerEntries, ...newEntries];
			ledgerSkip += newEntries.length;
			ledgerHasMore = newEntries.length === pageSize;
		} catch (error) {
			console.error('Failed to load ledger:', error);
			ledgerError = $i18n.t('Failed to load ledger');
			ledgerHasMore = false;
		}
	};

	const fetchUsage = async (): Promise<void> => {
		if (!usageHasMore) return;
		try {
			const result = await getUsageEvents(localStorage.token, pageSize, usageSkip);
			const newEntries = result ?? [];
			usageEntries = [...usageEntries, ...newEntries];
			usageSkip += newEntries.length;
			usageHasMore = newEntries.length === pageSize;
		} catch (error) {
			console.error('Failed to load usage events:', error);
			usageError = $i18n.t('Failed to load usage events');
			usageHasMore = false;
		}
	};

	const loadInitial = async (): Promise<void> => {
		loading = true;
		ledgerError = null;
		usageError = null;
		ledgerEntries = [];
		usageEntries = [];
		ledgerSkip = 0;
		usageSkip = 0;
		ledgerHasMore = true;
		usageHasMore = true;
		displayCount = maxItems ?? pageSize;

		await Promise.all([fetchLedger(), fetchUsage()]);
		loading = false;
	};

	onMount(async () => {
		activeFilter = syncFilterWithUrl ? $urlFilter : 'all';
		await loadInitial();
	});

	const handleLoadMore = async (): Promise<void> => {
		if (loadingMore) return;
		loadingMore = true;
		displayCount += pageSize;
		await Promise.all([fetchLedger(), fetchUsage()]);
		loadingMore = false;
	};

	const handleFilterChange = async (filter: FilterKey): Promise<void> => {
		if (activeFilter === filter) return;
		activeFilter = filter;
		onFilterChange(filter);
		await updateUrlFilter(filter);
	};

	const resolveCurrency = (): string => {
		if (currency) return currency;
		if (ledgerEntries.length > 0) return ledgerEntries[0].currency;
		return 'RUB';
	};

	const formatMoney = (kopeks: number, currencyCode: string): string => {
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat($i18n.locale, {
				style: 'currency',
				currency: currencyCode
			}).format(amount);
		} catch (error) {
			console.warn('Invalid currency code:', currencyCode, error);
			return `${amount.toFixed(2)} ${currencyCode}`.trim();
		}
	};

	const formatDateTime = (timestamp: number): string => {
		return new Date(timestamp * 1000).toLocaleString($i18n.locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const getModelName = (modelId: string): string => {
		const match = $models?.find((model) => model.id === modelId);
		return match?.name ?? modelId;
	};

	const getUsageMetrics = (entry: UsageEvent): string[] => {
		const metrics: string[] = [];
		if (typeof entry.prompt_tokens === 'number') {
			metrics.push(`${$i18n.t('Input tokens')}: ${entry.prompt_tokens}`);
		}
		if (typeof entry.completion_tokens === 'number') {
			metrics.push(`${$i18n.t('Output tokens')}: ${entry.completion_tokens}`);
		}
		if (metrics.length === 0 && entry.measured_units_json) {
			const measured = entry.measured_units_json as Record<string, unknown>;
			const units =
				measured.count ??
				measured.requested_count ??
				measured.units ??
				measured.tts_seconds ??
				measured.stt_seconds;
			if (typeof units === 'number') {
				metrics.push(`${$i18n.t('Units')}: ${units}`);
			}
		}
		return metrics;
	};

	const mapUsageEvent = (entry: UsageEvent, currencyCode: string): TimelineItem => {
		const isFree = entry.billing_source === 'lead_magnet';
		const modelName = getModelName(entry.model_id);
		const subtitle = `${modelName} · ${entry.modality}`;
		const metrics = getUsageMetrics(entry);
		const charged = entry.cost_charged_kopeks ?? 0;
		const isEstimated = Boolean(entry.is_estimated);

		return {
			id: entry.id,
			kind: isFree ? 'free' : 'usage',
			createdAt: entry.created_at,
			title: isFree ? $i18n.t('Free usage') : $i18n.t('Charge'),
			subtitle,
			metrics,
			amountKopeks: isFree ? 0 : charged,
			currency: currencyCode,
			isEstimated
		};
	};

	const getLedgerAmount = (entry: LedgerEntry): number => {
		if (entry.type === 'charge') {
			const chargedInput = entry.charged_input_kopeks ?? null;
			const chargedOutput = entry.charged_output_kopeks ?? null;
			if (chargedInput !== null || chargedOutput !== null) {
				const total = (chargedInput ?? 0) + (chargedOutput ?? 0);
				return total > 0 ? -total : total;
			}
			const metadataCharge = entry.metadata_json?.charged_kopeks;
			if (typeof metadataCharge === 'number') {
				return metadataCharge > 0 ? -metadataCharge : metadataCharge;
			}
		}
		return entry.amount_kopeks;
	};

	const mapLedgerEntry = (
		entry: LedgerEntry,
		usageRequestIds: Set<string>
	): TimelineItem | null => {
		if (['hold', 'release'].includes(entry.type)) {
			return null;
		}
		if (entry.type === 'charge') {
			const refId = entry.reference_id ?? '';
			if (refId && usageRequestIds.has(refId)) {
				return null;
			}
		}
		const amountKopeks = getLedgerAmount(entry);
		if (amountKopeks === 0 && entry.type === 'charge') {
			return null;
		}
		const titleMap: Record<string, string> = {
			charge: $i18n.t('Charge'),
			topup: $i18n.t('Top-up'),
			refund: $i18n.t('Refund'),
			adjustment: $i18n.t('Adjustment'),
			subscription_credit: $i18n.t('Subscription credit')
		};
		const title = titleMap[entry.type] ?? entry.type;
		const subtitle = entry.reference_id ? `#${entry.reference_id.slice(0, 8)}` : '';

		return {
			id: entry.id,
			kind: entry.type as TimelineKind,
			createdAt: entry.created_at,
			title,
			subtitle,
			metrics: [],
			amountKopeks,
			currency: entry.currency,
			isEstimated: false
		};
	};

	const mergeItems = (ledger: LedgerEntry[], usage: UsageEvent[]): TimelineItem[] => {
		const currencyCode = resolveCurrency();
		const usageRequestIds = new Set(usage.map((entry) => entry.request_id).filter(Boolean));
		const mappedLedger = ledger
			.map((entry) => mapLedgerEntry(entry, usageRequestIds))
			.filter(Boolean) as TimelineItem[];
		const mappedUsage = usage.map((entry) => mapUsageEvent(entry, currencyCode));
		return [...mappedLedger, ...mappedUsage].sort((a, b) => b.createdAt - a.createdAt);
	};

	const filterItems = (items: TimelineItem[]): TimelineItem[] => {
		if (activeFilter === 'paid') {
			return items.filter((item) => item.kind === 'usage' || item.kind === 'charge');
		}
		if (activeFilter === 'free') {
			return items.filter((item) => item.kind === 'free');
		}
		if (activeFilter === 'topups') {
			return items.filter((item) =>
				['topup', 'refund', 'adjustment', 'subscription_credit'].includes(item.kind)
			);
		}
		return items;
	};

	const getAmountClass = (value: number): string => {
		if (value > 0) return 'text-green-600 dark:text-green-400';
		if (value < 0) return 'text-red-600 dark:text-red-400';
		return 'text-gray-600 dark:text-gray-400';
	};

	$: if (syncFilterWithUrl && $urlFilter !== activeFilter) {
		activeFilter = $urlFilter;
	}
	$: mergedItems = mergeItems(ledgerEntries, usageEntries);
	$: filteredItems = filterItems(mergedItems);
	$: visibleItems = (() => {
		const sliceCount = maxItems ?? displayCount;
		return filteredItems.slice(0, sliceCount);
	})();
	$: canLoadMore =
		showLoadMore && (filteredItems.length > visibleItems.length || ledgerHasMore || usageHasMore);
</script>

{#if showFilters}
	<div class="flex flex-wrap gap-2 mb-3">
		<button
			type="button"
			on:click={() => handleFilterChange('all')}
			class="px-3 py-1.5 rounded-full text-sm font-medium transition {activeFilter === 'all'
				? 'bg-black text-white dark:bg-white dark:text-black'
				: 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
		>
			{$i18n.t('All activity')}
		</button>
		<button
			type="button"
			on:click={() => handleFilterChange('paid')}
			class="px-3 py-1.5 rounded-full text-sm font-medium transition {activeFilter === 'paid'
				? 'bg-black text-white dark:bg-white dark:text-black'
				: 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
		>
			{$i18n.t('Paid')}
		</button>
		<button
			type="button"
			on:click={() => handleFilterChange('free')}
			class="px-3 py-1.5 rounded-full text-sm font-medium transition {activeFilter === 'free'
				? 'bg-black text-white dark:bg-white dark:text-black'
				: 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
		>
			{$i18n.t('Free usage')}
		</button>
		<button
			type="button"
			on:click={() => handleFilterChange('topups')}
			class="px-3 py-1.5 rounded-full text-sm font-medium transition {activeFilter === 'topups'
				? 'bg-black text-white dark:bg-white dark:text-black'
				: 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
		>
			{$i18n.t('Top-ups')}
		</button>
	</div>
{/if}

{#if loading}
	<div class="w-full flex justify-center items-center py-8">
		<Spinner className="size-5" />
	</div>
{:else if !visibleItems.length && (ledgerError || usageError)}
	<div class="flex flex-col items-center justify-center py-8 text-center">
		<div class="text-gray-500 dark:text-gray-400 text-sm">
			{ledgerError || usageError}
		</div>
		<button
			type="button"
			on:click={loadInitial}
			class="mt-3 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
		>
			{$i18n.t('Retry')}
		</button>
	</div>
{:else if !visibleItems.length}
	<div class="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
		{$i18n.t('No recent activity')}
	</div>
{:else}
	<div class="space-y-2">
		{#each visibleItems as item (`${item.kind}:${item.id}`)}
			{@const amountValue = item.kind === 'usage' ? -Math.abs(item.amountKopeks ?? 0) : item.amountKopeks ?? 0}
			<div
				class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<div class="text-sm font-medium">{item.title}</div>
						<div class="text-xs text-gray-500 mt-0.5">
							{item.subtitle}
							{#if item.subtitle}
								<span class="mx-1">•</span>
							{/if}
							{formatDateTime(item.createdAt)}
						</div>
					</div>
					{#if item.kind === 'free'}
						<div class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
							{$i18n.t('Free')}
						</div>
					{:else}
						<div class={`text-sm font-semibold ${getAmountClass(amountValue)}`}>
							{amountValue > 0 ? '+' : ''}
							{formatMoney(amountValue, item.currency)}
						</div>
					{/if}
				</div>

				{#if item.metrics.length > 0}
					<div class="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
						{#each item.metrics as metric}
							<span>{metric}</span>
						{/each}
					</div>
				{/if}

				{#if item.isEstimated}
					<div class="text-xs text-gray-500 mt-2">
						{$i18n.t('Estimated')} • {$i18n.t('Not charged')}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if canLoadMore}
		<div class="flex justify-center mt-4">
			<button
				type="button"
				on:click={handleLoadMore}
				disabled={loadingMore}
				class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{loadingMore ? $i18n.t('Loading…') : $i18n.t('Load more')}
			</button>
		</div>
	{/if}
{/if}
