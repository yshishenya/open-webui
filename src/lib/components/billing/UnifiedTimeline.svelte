<script lang="ts">
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	import { onMount, onDestroy, getContext } from 'svelte';
	import { derived } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { models } from '$lib/stores';
	import { getLedger, getUsageEvents, getBillingRefunds } from '$lib/apis/billing';
	import type { LedgerEntry, UsageEvent, BillingRefund } from '$lib/apis/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import { isTechnicalBillingEntry } from '$lib/utils/airis/billing_ui';

	const i18n = getContext('i18n');

	type FilterKey = 'all' | 'paid' | 'free' | 'topups' | 'refunds';
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
		chatId?: string | null;
		requestId?: string;
		reason?: string;
	};

	export let pageSize = 20;
	export let maxItems: number | null = null;
	export let showFilters = false;
	export let showLoadMore = true;
	export let currency: string | null = null;
	export let syncFilterWithUrl = false;
	export let onFilterChange: (filter: FilterKey) => void = () => {};
	export let emptyActionLabel: string | null = null;
	export let onEmptyAction: () => void = () => {};
	export let periodFrom: number | null = null;
	export let periodTo: number | null = null;

	let refundEntries: BillingRefund[] = [];
	let refundSkip = 0;
	let refundHasMore = true;
	let refundError: string | null = null;
	let destroyed = false;
	onDestroy(() => {
		destroyed = true;
	});
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
	let lastSyncedUrlFilter: FilterKey = 'all';
	let pendingUrlFilter: FilterKey | null = null;
	let urlUpdateVersion = 0;
	const filterKeys: FilterKey[] = ['all', 'paid', 'free', 'topups', 'refunds'];
	const urlFilter = derived(page, ($page): FilterKey => {
		const value = $page.url.searchParams.get('filter');
		if (value && filterKeys.includes(value as FilterKey)) {
			return value as FilterKey;
		}
		return 'all';
	});

	const updateUrlFilter = async (filter: FilterKey): Promise<void> => {
		if (!syncFilterWithUrl) return;
		const requestVersion = ++urlUpdateVersion;
		pendingUrlFilter = filter;
		const params = new URLSearchParams($page.url.searchParams);
		if (filter === 'all') {
			params.delete('filter');
		} else {
			params.set('filter', filter);
		}
		const query = params.toString();
		const target = query ? `${$page.url.pathname}?${query}` : $page.url.pathname;
		try {
			await goto(target, { replaceState: true, keepFocus: true, noScroll: true });
		} catch (error) {
			console.error('Failed to sync filter with URL:', error);
			if (requestVersion === urlUpdateVersion) {
				pendingUrlFilter = null;
				lastSyncedUrlFilter = $urlFilter;
			}
		}
	};

	const fetchLedger = async (): Promise<void> => {
		if (destroyed || !ledgerHasMore) return;
		try {
			const result = await getLedger(localStorage.token, pageSize, ledgerSkip);
			if (destroyed) return;
			const newEntries = result ?? [];
			ledgerEntries = [
				...new Map([...ledgerEntries, ...newEntries].map((entry) => [entry.id, entry])).values()
			];
			ledgerSkip += newEntries.length;
			ledgerHasMore =
				newEntries.length === pageSize &&
				(periodFrom === null || newEntries.at(-1)!.created_at >= periodFrom);
		} catch (error) {
			console.error('Failed to load ledger:', error);
			ledgerError = $i18n.t('Failed to load ledger');
			ledgerHasMore = false;
		}
	};

	const fetchUsage = async (): Promise<void> => {
		if (destroyed || !usageHasMore) return;
		try {
			const result = await getUsageEvents(localStorage.token, pageSize, usageSkip);
			if (destroyed) return;
			const newEntries = result ?? [];
			usageEntries = [
				...new Map([...usageEntries, ...newEntries].map((entry) => [entry.id, entry])).values()
			];
			usageSkip += newEntries.length;
			usageHasMore =
				newEntries.length === pageSize &&
				(periodFrom === null || newEntries.at(-1)!.created_at >= periodFrom);
		} catch (error) {
			console.error('Failed to load usage events:', error);
			usageError = $i18n.t('Failed to load usage events');
			usageHasMore = false;
		}
	};

	const fetchRefunds = async (): Promise<void> => {
		if (destroyed || !refundHasMore) return;
		try {
			const result = await getBillingRefunds(
				localStorage.token,
				pageSize,
				refundSkip,
				periodFrom,
				periodTo
			);
			if (destroyed) return;
			refundEntries = [
				...new Map([...refundEntries, ...result.items].map((entry) => [entry.id, entry])).values()
			];
			refundSkip += result.items.length;
			refundHasMore = result.items.length > 0 && refundSkip < result.total;
		} catch {
			refundError = $i18n.t('Payment refunds could not be loaded');
			refundHasMore = false;
		}
	};
	const loadInitial = async (): Promise<void> => {
		loading = true;
		refundEntries = [];
		refundSkip = 0;
		refundHasMore = true;
		refundError = null;
		ledgerError = null;
		usageError = null;
		ledgerEntries = [];
		usageEntries = [];
		ledgerSkip = 0;
		usageSkip = 0;
		ledgerHasMore = true;
		usageHasMore = true;
		displayCount = maxItems ?? pageSize;

		await Promise.all([fetchLedger(), fetchUsage(), fetchRefunds()]);
		// With date filters, finish the bounded period before displaying a sorted history.
		if (periodFrom !== null) {
			while (!destroyed && (ledgerHasMore || usageHasMore || refundHasMore))
				await Promise.all([fetchLedger(), fetchUsage(), fetchRefunds()]);
		}
		loading = false;
	};

	onMount(async () => {
		activeFilter = syncFilterWithUrl ? $urlFilter : 'all';
		lastSyncedUrlFilter = syncFilterWithUrl ? $urlFilter : 'all';
		await loadInitial();
	});

	const handleLoadMore = async (): Promise<void> => {
		if (loadingMore) return;
		loadingMore = true;
		displayCount += pageSize;
		await Promise.all([fetchLedger(), fetchUsage(), fetchRefunds()]);
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
			return new Intl.NumberFormat(getI18nLocale($i18n), {
				style: 'currency',
				currency: currencyCode
			}).format(amount);
		} catch (error) {
			console.warn('Invalid currency code:', currencyCode, error);
			return `${amount.toFixed(2)} ${currencyCode}`.trim();
		}
	};

	const formatDateTime = (timestamp: number): string => {
		return new Date(timestamp * 1000).toLocaleString(getI18nLocale($i18n), {
			timeZone: 'UTC',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const formatDay = (timestamp: number): string => {
		return new Date(timestamp * 1000).toLocaleDateString(getI18nLocale($i18n), {
			timeZone: 'UTC',
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
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

	const mapUsageEvent = (
		entry: UsageEvent,
		currencyCode: string,
		ledger: LedgerEntry[]
	): TimelineItem => {
		const isFree = entry.billing_source === 'lead_magnet';
		const modelName = getModelName(entry.model_id);
		const modality =
			{
				text: $i18n.t('Text'),
				image: $i18n.t('Images'),
				tts: $i18n.t('Text to speech'),
				stt: $i18n.t('Speech recognition')
			}[entry.modality] ?? entry.modality;
		const subtitle = `${modelName} · ${modality}`;
		const metrics = getUsageMetrics(entry);
		// Saved references identify the price used; today's catalog cannot prove an old rate.
		metrics.push($i18n.t('Historical rate is unavailable in these details'));
		for (const [label, value] of [
			['Saved pricing version', entry.pricing_version],
			['Saved rate reference', entry.pricing_rate_card_id],
			['Saved input rate reference', entry.pricing_rate_card_input_id],
			['Saved output rate reference', entry.pricing_rate_card_output_id]
		] as const) {
			if (value) metrics.push(`${$i18n.t(label)}: ${value}`);
		}
		if (!isFree) {
			const holds = ledger.filter(
				(item) =>
					item.type === 'hold' &&
					Boolean(entry.request_id) &&
					item.reference_id === entry.request_id &&
					item.wallet_id === entry.wallet_id &&
					item.user_id === entry.user_id &&
					item.currency === currencyCode &&
					item.created_at <= entry.created_at &&
					Number.isSafeInteger(item.amount_kopeks) &&
					item.amount_kopeks < 0
			);
			metrics.push(
				holds.length === 1
					? `${$i18n.t('Reserved before this reply')}: ${formatMoney(-holds[0].amount_kopeks, currencyCode)}`
					: $i18n.t('Reserve for this reply could not be confirmed')
			);
		}
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
			isEstimated,
			chatId: entry.chat_id,
			requestId: entry.request_id
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
		if (isTechnicalBillingEntry(entry)) {
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
			refund: $i18n.t('Wallet credit adjustment'),
			adjustment: $i18n.t('Adjustment'),
			subscription_credit: $i18n.t('Subscription credit')
		};
		const title = titleMap[entry.type] ?? entry.type;
		const subtitle = entry.reference_id ? `#${entry.reference_id.slice(0, 8)}` : '';

		return {
			id: entry.id,
			kind: entry.type === 'refund' ? 'adjustment' : (entry.type as TimelineKind),
			createdAt: entry.created_at,
			title,
			subtitle,
			metrics: [],
			amountKopeks,
			currency: entry.currency,
			isEstimated: false,
			requestId: entry.reference_id ?? entry.id,
			reason:
				typeof entry.metadata_json?.reason === 'string' ? entry.metadata_json.reason : undefined
		};
	};

	const mergeItems = (
		ledger: LedgerEntry[],
		usage: UsageEvent[],
		refunds: BillingRefund[]
	): TimelineItem[] => {
		const currencyCode = resolveCurrency();
		const usageRequestIds = new Set(usage.map((entry) => entry.request_id).filter(Boolean));
		const mappedLedger = ledger
			.map((entry) => mapLedgerEntry(entry, usageRequestIds))
			.filter(Boolean) as TimelineItem[];
		const mappedUsage = usage.map((entry) => mapUsageEvent(entry, currencyCode, ledger));
		const mappedRefunds: TimelineItem[] = refunds.map((entry) => ({
			id: entry.id,
			kind: 'refund',
			createdAt: entry.occurred_at,
			title: $i18n.t('Payment refund'),
			subtitle: $i18n.t('Returned through the payment service'),
			metrics: [
				$i18n.t('Refund confirmation and its reflection in the wallet are checked separately')
			],
			amountKopeks: entry.amount_kopeks,
			currency: entry.currency,
			isEstimated: false,
			requestId: entry.payment_id
		}));
		return [...mappedLedger, ...mappedUsage, ...mappedRefunds].sort(
			(a, b) => b.createdAt - a.createdAt
		);
	};

	const filterItems = (items: TimelineItem[], filter: FilterKey): TimelineItem[] => {
		if (filter === 'refunds') return items.filter((item) => item.kind === 'refund');
		if (filter === 'paid') {
			return items.filter((item) => item.kind === 'usage' || item.kind === 'charge');
		}
		if (filter === 'free') {
			return items.filter((item) => item.kind === 'free');
		}
		if (filter === 'topups') {
			return items.filter((item) => ['topup', 'subscription_credit'].includes(item.kind));
		}
		return items;
	};

	const getAmountClass = (value: number): string => {
		if (value > 0) return 'text-green-600 dark:text-green-400';
		if (value < 0) return 'text-red-600 dark:text-red-400';
		return 'text-gray-600 dark:text-gray-400';
	};

	$: if (syncFilterWithUrl) {
		if (pendingUrlFilter !== null) {
			// Ignore stale URL updates while waiting for the latest requested filter.
			if ($urlFilter === pendingUrlFilter) {
				lastSyncedUrlFilter = $urlFilter;
				activeFilter = $urlFilter;
				pendingUrlFilter = null;
			}
		} else if ($urlFilter !== lastSyncedUrlFilter) {
			lastSyncedUrlFilter = $urlFilter;
			activeFilter = $urlFilter;
		}
	}
	// Translation-dependent titles and day labels also need a fresh view on language change.
	$: mergedItems = $i18n ? mergeItems(ledgerEntries, usageEntries, refundEntries) : [];
	// Keep filter key explicit so Svelte tracks activeFilter as a reactive dependency.
	$: filteredItems = filterItems(
		mergedItems.filter(
			(item) =>
				(periodFrom === null || item.createdAt >= periodFrom) &&
				(periodTo === null || item.createdAt < periodTo)
		),
		activeFilter
	);
	$: visibleItems = (() => {
		const sliceCount = maxItems ?? displayCount;
		return filteredItems.slice(0, sliceCount);
	})();
	$: groupedItems = (() => {
		const groups: { key: string; label: string; items: TimelineItem[] }[] = [];
		for (const item of visibleItems) {
			const date = new Date(item.createdAt * 1000);
			const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
			const lastGroup = groups.at(-1);
			if (lastGroup?.key === key) {
				lastGroup.items.push(item);
			} else {
				groups.push({ key, label: formatDay(item.createdAt), items: [item] });
			}
		}
		return groups;
	})();
	$: canLoadMore =
		showLoadMore &&
		(filteredItems.length > visibleItems.length || ledgerHasMore || usageHasMore || refundHasMore);
</script>

{#if showFilters}
	<div class="flex flex-wrap gap-2 mb-4" role="group" aria-label={$i18n.t('History filters')}>
		<button
			type="button"
			aria-pressed={activeFilter === 'all'}
			on:click={() => handleFilterChange('all')}
			class="min-h-11 px-3 py-2 rounded-full text-sm font-medium transition {activeFilter === 'all'
				? 'bg-black text-white dark:bg-white dark:text-black'
				: 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
		>
			{$i18n.t('All activity')}
		</button>
		<button
			type="button"
			aria-pressed={activeFilter === 'paid'}
			on:click={() => handleFilterChange('paid')}
			class="min-h-11 px-3 py-2 rounded-full text-sm font-medium transition {activeFilter === 'paid'
				? 'bg-black text-white dark:bg-white dark:text-black'
				: 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
		>
			{$i18n.t('Usage')}
		</button>
		<button
			type="button"
			aria-pressed={activeFilter === 'free'}
			on:click={() => handleFilterChange('free')}
			class="min-h-11 px-3 py-2 rounded-full text-sm font-medium transition {activeFilter === 'free'
				? 'bg-black text-white dark:bg-white dark:text-black'
				: 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
		>
			{$i18n.t('Free usage')}
		</button>
		<button
			type="button"
			aria-pressed={activeFilter === 'topups'}
			on:click={() => handleFilterChange('topups')}
			class="min-h-11 px-3 py-2 rounded-full text-sm font-medium transition {activeFilter ===
			'topups'
				? 'bg-black text-white dark:bg-white dark:text-black'
				: 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
		>
			{$i18n.t('Top-ups')}
		</button>
		<button
			type="button"
			aria-pressed={activeFilter === 'refunds'}
			on:click={() => handleFilterChange('refunds')}
			class="min-h-11 rounded-full border border-gray-200 px-3 py-2 text-sm dark:border-gray-800"
			>{$i18n.t('Refunds')}</button
		>
	</div>
{/if}

{#if ledgerError || usageError || refundError}<div
		class="mb-3 rounded-xl border border-amber-300 p-3 text-sm"
		role="alert"
	>
		<p>
			{$i18n.t('Some operations could not be loaded')}. {ledgerError ?? ''}
			{usageError ?? ''}
			{refundError ?? ''}
		</p>
		<button type="button" class="min-h-11 underline" on:click={loadInitial}
			>{$i18n.t('Retry')}</button
		>
	</div>{/if}

{#if loading}
	<div class="w-full flex justify-center items-center py-8">
		<Spinner className="size-5" />
	</div>
{:else if !visibleItems.length && (ledgerError || usageError)}
	<div class="flex flex-col items-center justify-center py-8 text-center">
		<div class="text-gray-500 dark:text-gray-400 text-sm">
			{ledgerError || usageError || refundError}
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
	<div class="flex flex-col items-center justify-center py-8 text-center">
		<div class="text-sm text-gray-500 dark:text-gray-400">
			{ledgerHasMore || usageHasMore
				? showLoadMore
					? $i18n.t(
							'No matching operations in the loaded portion. Load older operations to continue.'
						)
					: $i18n.t(
							'No matching operations in the latest activity. Open the full history to see older operations.'
						)
				: $i18n.t('No operations for these filters')}
		</div>
		{#if emptyActionLabel}
			<button
				type="button"
				on:click={onEmptyAction}
				class="mt-3 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
			>
				{emptyActionLabel}
			</button>
		{/if}
	</div>
{:else}
	<div class="rounded-2xl border border-gray-100/30 dark:border-gray-850/30 overflow-hidden">
		{#each groupedItems as group}
			<section aria-labelledby={`timeline-${group.key}`}>
				<h2
					id={`timeline-${group.key}`}
					class="px-4 pt-3 pb-2 text-xs font-medium text-gray-500 capitalize"
				>
					{group.label}
				</h2>
				<div class="divide-y divide-gray-100/30 dark:divide-gray-850/30">
					{#each group.items as item (`${item.kind}:${item.id}`)}
						{@const amountValue =
							item.kind === 'usage' ? -Math.abs(item.amountKopeks ?? 0) : (item.amountKopeks ?? 0)}
						<div
							data-testid="timeline-item"
							role="article"
							aria-label={`${item.title}${item.subtitle ? `, ${item.subtitle}` : ''}, ${formatDateTime(item.createdAt)}`}
							class="flex items-start justify-between gap-4 px-4 py-3.5 min-h-[68px]"
						>
							<div class="min-w-0">
								<div class="text-sm font-medium break-words">{item.title}</div>
								<div class="text-sm text-gray-500 mt-0.5 break-words">
									{item.subtitle || $i18n.t('Billing activity')}
									<span class="mx-1">•</span>{formatDateTime(item.createdAt)}
								</div>
								<details class="mt-2 text-sm">
									<summary
										class="min-h-11 cursor-pointer py-3 text-gray-600 dark:text-gray-300 focus-visible:outline focus-visible:outline-2"
										>{$i18n.t('Details')}</summary
									>
									<div class="space-y-2 pb-3">
										{#if item.isEstimated}<p>
												{item.kind === 'free'
													? $i18n.t('Free usage volume was estimated')
													: (item.amountKopeks ?? 0) > 0
														? $i18n.t('Charged using an estimate')
														: $i18n.t('No charge; usage volume was estimated')}
											</p>{/if}
										{#each item.metrics as metric}<p class="break-words">{metric}</p>{/each}
										{#if item.chatId}<a
												href={`/c/${encodeURIComponent(item.chatId)}`}
												class="inline-flex min-h-11 items-center underline"
												>{$i18n.t('Open chat')}</a
											>{/if}
										{#if item.reason}<p>{$i18n.t('Adjustment reason')}: {item.reason}</p>{/if}
										<p class="break-all text-xs text-gray-500">
											{$i18n.t('Operation reference')}: {item.requestId ?? item.id}
										</p>
									</div>
								</details>
							</div>
							{#if item.kind === 'free'}
								<div class="shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
									{$i18n.t('Free')}
								</div>
							{:else}
								<div class={`shrink-0 text-sm font-semibold ${getAmountClass(amountValue)}`}>
									{amountValue > 0 ? '+' : ''}{formatMoney(amountValue, item.currency)}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}

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
