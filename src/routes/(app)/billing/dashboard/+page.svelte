<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { WEBUI_NAME, config, user } from '$lib/stores';
	import { getBillingInfo, cancelSubscription, resumeSubscription } from '$lib/apis/billing';
	import type { BillingInfo, UsageData, LeadMagnetInfo } from '$lib/apis/billing';
	import {
		formatCompactNumber,
		getUsagePercentage,
		getUsageColor,
		getStatusColor,
		getQuotaLabel
	} from '$lib/utils/billing-formatters';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';

	const i18n = getContext('i18n');

	let loading = true;
	let billingInfo: BillingInfo | null = null;
	let errorMessage: string | null = null;
	let canceling = false;
	let resuming = false;
	let showCancelConfirm = false;
	let subscriptionsEnabled = true;

	$: subscriptionsEnabled = $config?.features?.enable_billing_subscriptions ?? true;
	$: isAdmin = $user?.role === 'admin';
	$: hasUnlimitedPlan = Boolean(billingInfo?.plan && billingInfo.plan.quotas === null && isAdmin);

	onMount(async () => {
		await loadBillingInfo();
	});

	const loadBillingInfo = async (): Promise<void> => {
		loading = true;
		errorMessage = null;
		try {
			const result = await getBillingInfo(localStorage.token);
			billingInfo = result;
		} catch (error) {
			console.error('Failed to load billing info:', error);
			errorMessage = $i18n.t('Failed to load billing information');
			billingInfo = null;
			toast.error(errorMessage);
		} finally {
			loading = false;
		}
	};

	const handleCancelSubscription = async () => {
		showCancelConfirm = false;
		canceling = true;

		try {
			const result = await cancelSubscription(localStorage.token, false);
			if (result) {
				toast.success($i18n.t('Subscription canceled successfully'));
				await loadBillingInfo();
			} else {
				toast.error($i18n.t('Failed to cancel subscription'));
			}
		} catch (error) {
			console.error('Failed to cancel subscription:', error);
			toast.error($i18n.t('Failed to cancel subscription'));
		} finally {
			canceling = false;
		}
	};

	const handleResumeSubscription = async (): Promise<void> => {
		resuming = true;

		try {
			const result = await resumeSubscription(localStorage.token);
			if (result) {
				toast.success($i18n.t('Subscription resumed successfully'));
				await loadBillingInfo();
			} else {
				toast.error($i18n.t('Failed to resume subscription'));
			}
		} catch (error) {
			console.error('Failed to resume subscription:', error);
			toast.error($i18n.t('Failed to resume subscription'));
		} finally {
			resuming = false;
		}
	};
	const formatDate = (timestamp: number): string => {
		return new Date(timestamp * 1000).toLocaleDateString($i18n.locale, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const formatOptionalDate = (timestamp?: number | null): string => {
		if (!timestamp) return $i18n.t('Not scheduled');
		return formatDate(timestamp);
	};

	const formatDateTime = (timestamp: number): string => {
		return new Date(timestamp * 1000).toLocaleString($i18n.locale, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const formatPrice = (amount: number, currency: string): string => {
		if (!currency) {
			return amount.toString();
		}
		try {
			return new Intl.NumberFormat($i18n.locale, {
				style: 'currency',
				currency: currency
			}).format(amount);
		} catch (error) {
			console.warn('Invalid currency code:', currency, error);
			return `${amount} ${currency}`.trim();
		}
	};

	// Helper to get usage percentage from UsageData object
	const getUsagePercent = (usage: UsageData): number => {
		return getUsagePercentage(usage.current, usage.limit);
	};

	// Get quota label with i18n
	const getLocalizedQuotaLabel = (key: string): string => {
		return getQuotaLabel(key, (k) => $i18n.t(k));
	};

	type LeadMagnetMetric = {
		key: string;
		used: number;
		limit: number;
		remaining: number;
		percentage: number;
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

	$: leadMagnetMetrics = getLeadMagnetMetrics(billingInfo?.lead_magnet ?? null);
</script>

<svelte:head>
	<title>
		{$i18n.t('Billing Dashboard')} • {$WEBUI_NAME}
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
				on:click={loadBillingInfo}
				class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
			>
				{$i18n.t('Retry')}
			</button>
		</div>
	</div>
{:else if !billingInfo}
	<div class="w-full">
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="text-gray-500 dark:text-gray-400 text-lg">
				{$i18n.t('No billing information available')}
			</div>
			{#if subscriptionsEnabled && isAdmin}
				<button
					type="button"
					on:click={() => goto('/billing/plans')}
					class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
				>
					{$i18n.t('View Plans')}
				</button>
			{/if}
		</div>
	</div>
{:else}
	<div class="w-full">
		<!-- Header -->
		<div class="flex flex-col gap-1 px-1 mt-1.5 mb-2">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex items-center gap-2">
					<div class="text-xl font-medium">{$i18n.t('Billing Dashboard')}</div>
					{#if hasUnlimitedPlan}
						<span
							class="px-1.5 py-0.5 text-xs font-medium rounded bg-sky-500/10 text-sky-700 dark:text-sky-300"
						>
							{$i18n.t('Безлимит')}
						</span>
					{/if}
				</div>

				{#if subscriptionsEnabled && isAdmin}
					<button
						type="button"
						on:click={() => goto('/billing/plans')}
						class="px-2 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm"
					>
						{$i18n.t('View Plans')}
					</button>
				{/if}
			</div>
		</div>

		{#if billingInfo.lead_magnet?.enabled}
			<div
				class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4 mb-4"
			>
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
					{$i18n.t('Next reset')}: {formatOptionalDate(billingInfo.lead_magnet.cycle_end)}
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
										{formatCompactNumber(metric.used)} / {formatCompactNumber(metric.limit)}
									</span>
								</div>
								<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
									<div
										class="{getUsageColor(metric.percentage)} h-1.5 rounded-full transition-all"
										style="width: {metric.percentage}%"
									/>
								</div>
								<div class="text-xs text-gray-500 mt-1">
									{metric.percentage.toFixed(1)}% {$i18n.t('used')} •
									{formatCompactNumber(metric.remaining)}
									{$i18n.t('remaining')}
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

		{#if subscriptionsEnabled}
			<!-- Subscription Card -->
			<div
				class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4 mb-4"
			>
				<div class="flex items-start justify-between mb-3">
					<h3 class="text-sm font-medium">
						{$i18n.t('Current Subscription')}
					</h3>
					{#if billingInfo.subscription}
						<span
							class="px-1.5 py-0.5 text-xs font-medium rounded {getStatusColor(
								billingInfo.subscription.status
							)}"
						>
							{billingInfo.subscription.status.toUpperCase()}
						</span>
					{/if}
				</div>

				{#if billingInfo.subscription && billingInfo.plan}
					<div class="space-y-3">
						<div>
							<div class="text-lg font-semibold">
								{billingInfo.plan.name_ru || billingInfo.plan.name}
							</div>
							{#if billingInfo.plan.description || billingInfo.plan.description_ru}
								<div class="text-sm text-gray-500 mt-0.5">
									{billingInfo.plan.description_ru || billingInfo.plan.description}
								</div>
							{/if}
						</div>

						<div class="grid grid-cols-2 gap-3 text-sm">
							<div>
								<span class="text-gray-500">{$i18n.t('Current period start')}:</span>
								<div class="font-medium">
									{formatDate(billingInfo.subscription.current_period_start)}
								</div>
							</div>
							<div>
								<span class="text-gray-500">{$i18n.t('Current period end')}:</span>
								<div class="font-medium">
									{formatDate(billingInfo.subscription.current_period_end)}
								</div>
							</div>
						</div>

						{#if billingInfo.subscription.cancel_at_period_end}
							<div class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
								<div class="text-sm text-yellow-700 dark:text-yellow-300">
									{$i18n.t('Your subscription will be canceled at the end of the current period')}
								</div>
							</div>
							<div class="pt-1">
								<button
									type="button"
									on:click={handleResumeSubscription}
									disabled={resuming}
									class="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl transition text-sm font-medium disabled:cursor-not-allowed"
								>
									{#if resuming}
										<div class="flex items-center gap-2">
											<Spinner className="size-4" />
											<span>{$i18n.t('Resuming')}...</span>
										</div>
									{:else}
										{$i18n.t('Resume Subscription')}
									{/if}
								</button>
							</div>
						{:else if billingInfo.subscription.status === 'active'}
							<div class="pt-1">
								<button
									type="button"
									on:click={() => (showCancelConfirm = true)}
									disabled={canceling}
									class="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl transition text-sm font-medium disabled:cursor-not-allowed"
								>
									{#if canceling}
										<div class="flex items-center gap-2">
											<Spinner className="size-4" />
											<span>{$i18n.t('Canceling')}...</span>
										</div>
									{:else}
										{$i18n.t('Cancel Subscription')}
									{/if}
								</button>
							</div>
						{/if}
					</div>
				{:else}
					<div class="text-gray-500">
						{$i18n.t('No active subscription')}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Usage Card -->
		{#if billingInfo.usage && Object.keys(billingInfo.usage).length > 0}
			<div
				class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4 mb-4"
			>
				<h3 class="text-sm font-medium mb-3">
					{$i18n.t('Usage Statistics')}
				</h3>

				<div class="space-y-4">
					{#each Object.entries(billingInfo.usage) as [metric, usage]}
						<div>
							<div class="flex items-center justify-between mb-1.5">
								<span class="text-sm font-medium">
									{getLocalizedQuotaLabel(metric)}
								</span>
								<span class="text-sm text-gray-500">
									{formatCompactNumber(usage.current)}
									{#if usage.limit}
										/ {formatCompactNumber(usage.limit)}
									{/if}
								</span>
							</div>
							{#if usage.limit}
								<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
									<div
										class="{getUsageColor(
											getUsagePercent(usage)
										)} h-1.5 rounded-full transition-all"
										style="width: {getUsagePercent(usage)}%"
									/>
								</div>
								<div class="text-xs text-gray-500 mt-1">
									{getUsagePercent(usage).toFixed(1)}% {$i18n.t('used')}
									{#if usage.limit}
										• {formatCompactNumber(Math.max(0, usage.limit - usage.current))}
										{$i18n.t('remaining')}
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Transactions Card -->
		{#if billingInfo.transactions && billingInfo.transactions.length > 0}
			<div
				class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30"
			>
				<div class="px-4 py-3 border-b border-gray-100/30 dark:border-gray-850/30">
					<h3 class="text-sm font-medium">
						{$i18n.t('Transaction History')}
					</h3>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-gray-100/30 dark:border-gray-850/30 text-left">
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase"
									>{$i18n.t('Date')}</th
								>
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase"
									>{$i18n.t('Description')}</th
								>
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase"
									>{$i18n.t('Amount')}</th
								>
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase"
									>{$i18n.t('Status')}</th
								>
							</tr>
						</thead>
						<tbody>
							{#each billingInfo.transactions as transaction}
								<tr
									class="border-b border-gray-100/30 dark:border-gray-850/30 hover:bg-black/5 dark:hover:bg-white/5"
								>
									<td class="px-4 py-2 text-sm">{formatDateTime(transaction.created_at)}</td>
									<td class="px-4 py-2 text-sm"
										>{transaction.description_ru || transaction.description || '-'}</td
									>
									<td class="px-4 py-2 text-sm font-medium"
										>{formatPrice(transaction.amount, transaction.currency)}</td
									>
									<td class="px-4 py-2">
										<span
											class="px-1.5 py-0.5 text-xs font-medium rounded {getStatusColor(
												transaction.status
											)}"
										>
											{transaction.status.toUpperCase()}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
{/if}

<!-- Cancel Confirmation Dialog -->
<ConfirmDialog
	bind:show={showCancelConfirm}
	on:confirm={handleCancelSubscription}
	title={$i18n.t('Cancel Subscription')}
	message={$i18n.t(
		'Are you sure you want to cancel your subscription? You will retain access until the end of the current billing period.'
	)}
/>
