<script lang="ts">
	import { onMount, getContext } from 'svelte';

	import { WEBUI_NAME } from '$lib/stores';
	import { getLedger, getUsageEvents } from '$lib/apis/billing';
	import type { LedgerEntry, UsageEvent } from '$lib/apis/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');

	const PAGE_LIMIT = 50;

	let loading = true;
	let loadingMore = false;
	let entries: LedgerEntry[] = [];
	let errorMessage: string | null = null;
	let hasMore = true;
	let usageLoading = true;
	let usageLoadingMore = false;
	let usageEntries: UsageEvent[] = [];
	let usageErrorMessage: string | null = null;
	let usageHasMore = true;
	type HistoryTab = 'operations' | 'usage';
	let activeTab: HistoryTab = 'operations';

	onMount(async () => {
		await Promise.all([loadLedger(), loadUsageEvents()]);
	});

	const loadLedger = async (append: boolean = false): Promise<void> => {
		if (append) {
			loadingMore = true;
		} else {
			loading = true;
		}
		errorMessage = null;
		try {
			const result = await getLedger(localStorage.token, PAGE_LIMIT, append ? entries.length : 0);
			const newEntries = result ?? [];
			entries = append ? [...entries, ...newEntries] : newEntries;
			hasMore = newEntries.length === PAGE_LIMIT;
		} catch (error) {
			console.error('Failed to load ledger:', error);
			errorMessage = $i18n.t('Failed to load ledger');
		} finally {
			loading = false;
			loadingMore = false;
		}
	};

	const loadUsageEvents = async (append: boolean = false): Promise<void> => {
		if (append) {
			usageLoadingMore = true;
		} else {
			usageLoading = true;
		}
		usageErrorMessage = null;
		try {
			const result = await getUsageEvents(
				localStorage.token,
				PAGE_LIMIT,
				append ? usageEntries.length : 0,
				'lead_magnet'
			);
			const newEntries = result ?? [];
			usageEntries = append ? [...usageEntries, ...newEntries] : newEntries;
			usageHasMore = newEntries.length === PAGE_LIMIT;
		} catch (error) {
			console.error('Failed to load usage events:', error);
			usageErrorMessage = $i18n.t('Failed to load usage events');
		} finally {
			usageLoading = false;
			usageLoadingMore = false;
		}
	};

	const formatMoney = (kopeks: number, currency: string): string => {
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat($i18n.locale, {
				style: 'currency',
				currency
			}).format(amount);
		} catch (error) {
			console.warn('Invalid currency code:', currency, error);
			return `${amount.toFixed(2)} ${currency}`.trim();
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

	const getEntryAmount = (entry: LedgerEntry): number => {
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

	const getChargeBreakdown = (entry: LedgerEntry): { input?: number; output?: number } | null => {
		const input = entry.charged_input_kopeks ?? undefined;
		const output = entry.charged_output_kopeks ?? undefined;
		if (typeof input === 'number' || typeof output === 'number') {
			return { input, output };
		}
		return null;
	};

	const formatType = (type: string): string => {
		const labels: Record<string, string> = {
			hold: $i18n.t('Hold'),
			charge: $i18n.t('Charge'),
			refund: $i18n.t('Refund'),
			topup: $i18n.t('Top-up'),
			subscription_credit: $i18n.t('Subscription credit'),
			adjustment: $i18n.t('Adjustment'),
			release: $i18n.t('Release')
		};
		return labels[type] || type;
	};

	const getAmountClass = (amount: number): string => {
		if (amount > 0) return 'text-green-600 dark:text-green-400';
		if (amount < 0) return 'text-red-600 dark:text-red-400';
		return 'text-gray-600 dark:text-gray-400';
	};

	const formatUsageTitle = (entry: UsageEvent): string => {
		if (entry.billing_source === 'lead_magnet') {
			return $i18n.t('Free usage');
		}
		return $i18n.t('Usage');
	};

	const formatUsageAmount = (entry: UsageEvent): string => {
		if (entry.billing_source === 'lead_magnet') {
			return $i18n.t('Free');
		}
		return formatMoney(entry.cost_charged_kopeks, 'RUB');
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
</script>

<svelte:head>
	<title>
		{$i18n.t('History')} • {$WEBUI_NAME}
	</title>
</svelte:head>

{#if loading && usageLoading}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{:else}
	<div class="w-full">
		<div class="flex flex-col gap-1 px-1 mt-1.5 mb-3">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex items-center gap-2">
					<div class="text-xl font-medium">{$i18n.t('History')}</div>
				</div>
			</div>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					on:click={() => (activeTab = 'operations')}
					class="px-3 py-1.5 rounded-full text-sm font-medium transition {activeTab === 'operations'
						? 'bg-black text-white dark:bg-white dark:text-black'
						: 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
				>
					{$i18n.t('Operations')}
				</button>
				<button
					type="button"
					on:click={() => (activeTab = 'usage')}
					class="px-3 py-1.5 rounded-full text-sm font-medium transition {activeTab === 'usage'
						? 'bg-black text-white dark:bg-white dark:text-black'
						: 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
				>
					{$i18n.t('Free usage')}
				</button>
			</div>
		</div>

		{#if activeTab === 'operations'}
			{#if loading && entries.length === 0}
				<div class="w-full h-full flex justify-center items-center py-24">
					<Spinner className="size-5" />
				</div>
			{:else if errorMessage && entries.length === 0}
				<div class="flex flex-col items-center justify-center py-24 text-center">
					<div class="text-gray-500 dark:text-gray-400 text-lg">{errorMessage}</div>
					<button
						type="button"
						on:click={() => loadLedger()}
						class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
					>
						{$i18n.t('Retry')}
					</button>
				</div>
			{:else if entries.length === 0}
				<div class="flex flex-col items-center justify-center py-24 text-center">
					<div class="text-gray-500 dark:text-gray-400 text-lg">
						{$i18n.t('No operations yet')}
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					{#each entries as entry}
						{@const entryAmount = getEntryAmount(entry)}
						{@const breakdown = entry.type === 'charge' ? getChargeBreakdown(entry) : null}
						<div
							class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4"
						>
							<div class="flex flex-col gap-2">
								<div class="flex items-center justify-between">
									<div class="text-sm font-medium">{formatType(entry.type)}</div>
									<div class={`text-sm font-semibold ${getAmountClass(entryAmount)}`}>
										{entryAmount > 0 ? '+' : ''}
										{formatMoney(entryAmount, entry.currency)}
									</div>
								</div>
								<div class="flex flex-wrap gap-2 text-xs text-gray-500">
									<span>{formatDateTime(entry.created_at)}</span>
									{#if entry.reference_type}
										<span>•</span>
										<span>{entry.reference_type}</span>
									{/if}
									{#if entry.reference_id}
										<span>•</span>
										<span class="font-mono">{entry.reference_id.slice(0, 8)}</span>
									{/if}
								</div>
								<div class="flex flex-wrap gap-3 text-xs text-gray-500">
									<span>
										{$i18n.t('Included after')}: {formatMoney(
											entry.balance_included_after,
											entry.currency
										)}
									</span>
									<span>
										{$i18n.t('Top-up after')}: {formatMoney(
											entry.balance_topup_after,
											entry.currency
										)}
									</span>
									{#if breakdown}
										<span>
											{$i18n.t('Input tokens')}: {formatMoney(breakdown.input ?? 0, entry.currency)}
										</span>
										<span>
											{$i18n.t('Output tokens')}: {formatMoney(
												breakdown.output ?? 0,
												entry.currency
											)}
										</span>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>

				{#if hasMore}
					<div class="flex justify-center mt-4">
						<button
							type="button"
							on:click={() => loadLedger(true)}
							disabled={loadingMore}
							class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
						>
							{loadingMore ? $i18n.t('Loading') : $i18n.t('Load more')}
						</button>
					</div>
				{/if}
			{/if}
		{:else if usageLoading && usageEntries.length === 0}
			<div class="w-full h-full flex justify-center items-center py-24">
				<Spinner className="size-5" />
			</div>
		{:else if usageErrorMessage && usageEntries.length === 0}
			<div class="flex flex-col items-center justify-center py-24 text-center">
				<div class="text-gray-500 dark:text-gray-400 text-lg">{usageErrorMessage}</div>
				<button
					type="button"
					on:click={() => loadUsageEvents()}
					class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
				>
					{$i18n.t('Retry')}
				</button>
			</div>
		{:else if usageEntries.length === 0}
			<div class="flex flex-col items-center justify-center py-24 text-center">
				<div class="text-gray-500 dark:text-gray-400 text-lg">
					{$i18n.t('No free usage yet')}
				</div>
			</div>
		{:else}
			<div class="space-y-2">
				{#each usageEntries as entry}
					{@const metrics = getUsageMetrics(entry)}
					<div
						class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4"
					>
						<div class="flex flex-col gap-2">
							<div class="flex items-center justify-between">
								<div class="text-sm font-medium">{formatUsageTitle(entry)}</div>
								<div class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
									{formatUsageAmount(entry)}
								</div>
							</div>
							<div class="flex flex-wrap gap-2 text-xs text-gray-500">
								<span>{formatDateTime(entry.created_at)}</span>
								<span>•</span>
								<span class="font-mono">{entry.model_id}</span>
								<span>•</span>
								<span>{entry.modality}</span>
							</div>
							{#if metrics.length > 0}
								<div class="flex flex-wrap gap-3 text-xs text-gray-500">
									{#each metrics as metric}
										<span>{metric}</span>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			{#if usageHasMore}
				<div class="flex justify-center mt-4">
					<button
						type="button"
						on:click={() => loadUsageEvents(true)}
						disabled={usageLoadingMore}
						class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{usageLoadingMore ? $i18n.t('Loading') : $i18n.t('Load more')}
					</button>
				</div>
			{/if}
		{/if}
	</div>
{/if}
