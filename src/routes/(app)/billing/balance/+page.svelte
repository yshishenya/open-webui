<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { WEBUI_NAME } from '$lib/stores';
	import { createTopup, getBalance, getLeadMagnetInfo, updateAutoTopup } from '$lib/apis/billing';
	import type { Balance, LeadMagnetInfo } from '$lib/apis/billing';
	import { formatCompactNumber, getUsagePercentage, getUsageColor, getQuotaLabel } from '$lib/utils/billing-formatters';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Switch from '$lib/components/common/Switch.svelte';

	const i18n = getContext('i18n');

	const DEFAULT_TOPUP_PACKAGES_KOPEKS = [19900, 49900, 99900, 199900, 499900];

	let loading = true;
	let balance: Balance | null = null;
	let errorMessage: string | null = null;
	let creatingTopupAmount: number | null = null;
	let savingAutoTopup = false;
	let leadMagnetInfo: LeadMagnetInfo | null = null;

	let autoTopupEnabled = false;
	let autoTopupThreshold = '';
	let autoTopupAmount = '';

	type LeadMagnetMetric = {
		key: string;
		used: number;
		limit: number;
		remaining: number;
		percentage: number;
	};

	onMount(async () => {
		await loadBalance();
	});

	const loadBalance = async (): Promise<void> => {
		loading = true;
		errorMessage = null;
		try {
			const [balanceResult, leadMagnetResult] = await Promise.all([
				getBalance(localStorage.token),
				getLeadMagnetInfo(localStorage.token)
			]);
			balance = balanceResult;
			leadMagnetInfo = leadMagnetResult;
			autoTopupEnabled = balance?.auto_topup_enabled ?? false;
			autoTopupThreshold = formatMoneyInput(balance?.auto_topup_threshold_kopeks ?? null);
			autoTopupAmount = formatMoneyInput(balance?.auto_topup_amount_kopeks ?? null);
		} catch (error) {
			console.error('Failed to load balance:', error);
			errorMessage = $i18n.t('Failed to load balance');
			balance = null;
			leadMagnetInfo = null;
		} finally {
			loading = false;
		}
	};

	const handleTopup = async (amountKopeks: number): Promise<void> => {
		if (creatingTopupAmount !== null) return;
		creatingTopupAmount = amountKopeks;

		try {
			const returnUrl = `${window.location.origin}/billing/balance`;
			const result = await createTopup(localStorage.token, amountKopeks, returnUrl);
			if (result?.confirmation_url) {
				window.location.href = result.confirmation_url;
				return;
			}
			toast.error($i18n.t('Failed to create topup'));
		} catch (error) {
			console.error('Failed to create topup:', error);
			toast.error($i18n.t('Failed to create topup'));
		} finally {
			creatingTopupAmount = null;
		}
	};

	const handleSaveAutoTopup = async (): Promise<void> => {
		if (!balance) return;
		savingAutoTopup = true;
		try {
			const threshold = parseMoneyInput(autoTopupThreshold);
			const amount = parseMoneyInput(autoTopupAmount);

			if (autoTopupEnabled && (threshold === null || amount === null)) {
				toast.error($i18n.t('Enter threshold and amount for auto-topup'));
				return;
			}

			await updateAutoTopup(localStorage.token, {
				enabled: autoTopupEnabled,
				threshold_kopeks: autoTopupEnabled ? threshold ?? undefined : undefined,
				amount_kopeks: autoTopupEnabled ? amount ?? undefined : undefined
			});

			toast.success($i18n.t('Auto-topup settings saved'));
			await loadBalance();
		} catch (error) {
			console.error('Failed to update auto-topup:', error);
			toast.error($i18n.t('Failed to update auto-topup'));
		} finally {
			savingAutoTopup = false;
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

	const formatMoneyInput = (kopeks: number | null): string => {
		if (kopeks === null || kopeks === undefined) return '';
		return (kopeks / 100).toFixed(2);
	};

	const parseMoneyInput = (value: string): number | null => {
		if (!value) return null;
		const normalized = value.replace(',', '.');
		const parsed = Number.parseFloat(normalized);
		if (Number.isNaN(parsed) || parsed < 0) {
			return null;
		}
		return Math.round(parsed * 100);
	};

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
				const used = leadMagnet.usage?.[key] ?? 0;
				const remaining = leadMagnet.remaining?.[key] ?? Math.max(0, limit - used);
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
</script>

<svelte:head>
	<title>
		{$i18n.t('Balance')} • {$WEBUI_NAME}
	</title>
</svelte:head>

{#if loading}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{:else if errorMessage}
	<div class="w-full">
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="text-gray-500 dark:text-gray-400 text-lg">{errorMessage}</div>
			<button
				type="button"
				on:click={loadBalance}
				class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
			>
				{$i18n.t('Retry')}
			</button>
		</div>
	</div>
{:else if !balance}
	<div class="w-full">
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="text-gray-500 dark:text-gray-400 text-lg">
				{$i18n.t('No balance information available')}
			</div>
		</div>
	</div>
{:else}
	<div class="w-full">
		<div class="flex flex-col gap-1 px-1 mt-1.5 mb-2">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex items-center gap-2">
					<div class="text-xl font-medium">{$i18n.t('Wallet Balance')}</div>
				</div>
			</div>
		</div>

		{#if leadMagnetInfo?.enabled}
			<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4 mb-4">
				<div class="flex items-start justify-between mb-3">
					<h3 class="text-sm font-medium">
						{$i18n.t('Lead magnet')}
					</h3>
					<span
						class="px-1.5 py-0.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
					>
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
						{$i18n.t('No lead magnet limits configured')}
					</div>
				{/if}
			</div>
		{/if}

		<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
			<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4">
				<div class="text-sm text-gray-500">{$i18n.t('Top-up balance')}</div>
				<div class="text-xl font-semibold mt-1">
					{formatMoney(balance.balance_topup_kopeks, balance.currency)}
				</div>
			</div>
			<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4">
				<div class="text-sm text-gray-500">{$i18n.t('Included balance')}</div>
				<div class="text-xl font-semibold mt-1">
					{formatMoney(balance.balance_included_kopeks, balance.currency)}
				</div>
				<div class="text-xs text-gray-500 mt-1">
					{$i18n.t('Included expires')}: {formatDateTime(balance.included_expires_at)}
				</div>
			</div>
			<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4">
				<div class="text-sm text-gray-500">{$i18n.t('Total balance')}</div>
				<div class="text-xl font-semibold mt-1">
					{formatMoney(
						balance.balance_topup_kopeks + balance.balance_included_kopeks,
						balance.currency
					)}
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
				<div class="flex items-center justify-between mb-3">
					<div class="text-sm font-medium">{$i18n.t('Top up')}</div>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each DEFAULT_TOPUP_PACKAGES_KOPEKS as amount}
						<button
							type="button"
							on:click={() => handleTopup(amount)}
							class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
							disabled={creatingTopupAmount !== null}
						>
							{creatingTopupAmount === amount
								? $i18n.t('Processing')
								: formatMoney(amount, balance.currency)}
						</button>
					{/each}
				</div>
				<div class="text-xs text-gray-500 mt-2">
					{$i18n.t('Top-up packages are charged in')}: {balance.currency}
				</div>
			</div>

			<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
				<div class="flex items-center justify-between mb-3">
					<div class="text-sm font-medium">{$i18n.t('Auto-topup')}</div>
					<Switch state={autoTopupEnabled} on:change={(e) => (autoTopupEnabled = e.detail)} />
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<label class="flex flex-col gap-1 text-sm">
						<span class="text-gray-500">{$i18n.t('Threshold')}</span>
						<input
							type="text"
							inputmode="decimal"
							placeholder="0.00"
							bind:value={autoTopupThreshold}
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
							disabled={!autoTopupEnabled}
						/>
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span class="text-gray-500">{$i18n.t('Amount')}</span>
						<input
							type="text"
							inputmode="decimal"
							placeholder="0.00"
							bind:value={autoTopupAmount}
							class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
							disabled={!autoTopupEnabled}
						/>
					</label>
				</div>
				<div class="flex items-center justify-between mt-3">
					<div class="text-xs text-gray-500">
						{$i18n.t('Failed attempts')}: {balance.auto_topup_fail_count ?? 0}
					</div>
					<button
						type="button"
						on:click={handleSaveAutoTopup}
						disabled={savingAutoTopup}
						class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{savingAutoTopup ? $i18n.t('Saving') : $i18n.t('Save')}
					</button>
				</div>
				<div class="text-xs text-gray-500 mt-2">
					{$i18n.t('Last failed')}: {formatDateTime(balance.auto_topup_last_failed_at)}
				</div>
			</div>
		</div>
	</div>
{/if}
