<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { WEBUI_NAME, user } from '$lib/stores';
	import { getBillingInfo, cancelSubscription } from '$lib/apis/billing';
	import type { BillingInfo, Subscription, Plan, Transaction, UsageInfo } from '$lib/apis/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';

	const i18n = getContext('i18n');

	let loading = true;
	let billingInfo: BillingInfo | null = null;
	let canceling = false;
	let showCancelConfirm = false;

	onMount(async () => {
		await loadBillingInfo();
	});

	const loadBillingInfo = async () => {
		loading = true;
		try {
			const result = await getBillingInfo(localStorage.token);
			if (result) {
				billingInfo = result;
			}
		} catch (error) {
			console.error('Failed to load billing info:', error);
			toast.error($i18n.t('Failed to load billing information'));
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

	const formatDate = (timestamp: number): string => {
		return new Date(timestamp * 1000).toLocaleDateString($i18n.locale, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
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
		return new Intl.NumberFormat($i18n.locale, {
			style: 'currency',
			currency: currency
		}).format(amount);
	};

	const formatQuota = (value: number): string => {
		if (value >= 1000000) {
			return `${(value / 1000000).toFixed(1)}M`;
		} else if (value >= 1000) {
			return `${(value / 1000).toFixed(0)}K`;
		}
		return value.toString();
	};

	const getUsagePercentage = (usage: UsageInfo): number => {
		if (!usage.quota_limit) return 0;
		return Math.min((usage.current_usage / usage.quota_limit) * 100, 100);
	};

	const getUsageColor = (percentage: number): string => {
		if (percentage >= 90) return 'bg-red-500';
		if (percentage >= 70) return 'bg-yellow-500';
		return 'bg-green-500';
	};

	const getStatusBadgeClass = (status: string): string => {
		const classes: Record<string, string> = {
			active: 'bg-green-500/20 text-green-700 dark:text-green-200',
			canceled: 'bg-red-500/20 text-red-700 dark:text-red-200',
			pending: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-200',
			succeeded: 'bg-green-500/20 text-green-700 dark:text-green-200',
			failed: 'bg-red-500/20 text-red-700 dark:text-red-200'
		};
		return classes[status] || 'bg-gray-500/20 text-gray-700 dark:text-gray-200';
	};

	const getQuotaLabel = (key: string): string => {
		const labels: Record<string, string> = {
			tokens_input: $i18n.t('Input tokens'),
			tokens_output: $i18n.t('Output tokens'),
			requests: $i18n.t('Requests')
		};
		return labels[key] || key;
	};
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
{:else if !billingInfo}
	<div class="w-full">
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<div class="text-gray-500 dark:text-gray-400 text-lg">
				{$i18n.t('No billing information available')}
			</div>
			<button
				type="button"
				on:click={() => goto('/billing/plans')}
				class="mt-4 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
			>
				{$i18n.t('View Plans')}
			</button>
		</div>
	</div>
{:else}
	<div class="w-full">
		<!-- Header -->
		<div class="flex flex-col gap-1 px-1 mt-1.5 mb-2">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex items-center gap-2">
					<div class="text-xl font-medium">{$i18n.t('Billing Dashboard')}</div>
				</div>

				<button
					type="button"
					on:click={() => goto('/billing/plans')}
					class="px-2 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm"
				>
					{$i18n.t('View Plans')}
				</button>
			</div>
		</div>

		<!-- Subscription Card -->
		<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4 mb-4">
			<div class="flex items-start justify-between mb-3">
				<h3 class="text-sm font-medium">
					{$i18n.t('Current Subscription')}
				</h3>
				{#if billingInfo.subscription}
					<span class="px-1.5 py-0.5 text-xs font-medium rounded {getStatusBadgeClass(billingInfo.subscription.status)}">
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
							<div class="font-medium">{formatDate(billingInfo.subscription.current_period_start)}</div>
						</div>
						<div>
							<span class="text-gray-500">{$i18n.t('Current period end')}:</span>
							<div class="font-medium">{formatDate(billingInfo.subscription.current_period_end)}</div>
						</div>
					</div>

					{#if billingInfo.subscription.cancel_at_period_end}
						<div class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
							<div class="text-sm text-yellow-700 dark:text-yellow-300">
								{$i18n.t('Your subscription will be canceled at the end of the current period')}
							</div>
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
				<div class="pt-3">
					<button
						type="button"
						on:click={() => goto('/billing/plans')}
						class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium"
					>
						{$i18n.t('Browse Plans')}
					</button>
				</div>
			{/if}
		</div>

		<!-- Usage Card -->
		{#if billingInfo.usage && Object.keys(billingInfo.usage).length > 0}
			<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4 mb-4">
				<h3 class="text-sm font-medium mb-3">
					{$i18n.t('Usage Statistics')}
				</h3>

				<div class="space-y-4">
					{#each Object.entries(billingInfo.usage) as [metric, usage]}
						<div>
							<div class="flex items-center justify-between mb-1.5">
								<span class="text-sm font-medium">
									{getQuotaLabel(metric)}
								</span>
								<span class="text-sm text-gray-500">
									{formatQuota(usage.current_usage)}
									{#if usage.quota_limit}
										/ {formatQuota(usage.quota_limit)}
									{/if}
								</span>
							</div>
							{#if usage.quota_limit}
								<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
									<div
										class="{getUsageColor(getUsagePercentage(usage))} h-1.5 rounded-full transition-all"
										style="width: {getUsagePercentage(usage)}%"
									/>
								</div>
								<div class="text-xs text-gray-500 mt-1">
									{getUsagePercentage(usage).toFixed(1)}% {$i18n.t('used')}
									{#if usage.remaining !== undefined}
										• {formatQuota(usage.remaining)} {$i18n.t('remaining')}
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
			<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30">
				<div class="px-4 py-3 border-b border-gray-100/30 dark:border-gray-850/30">
					<h3 class="text-sm font-medium">
						{$i18n.t('Transaction History')}
					</h3>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-gray-100/30 dark:border-gray-850/30 text-left">
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase">{$i18n.t('Date')}</th>
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase">{$i18n.t('Description')}</th>
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase">{$i18n.t('Amount')}</th>
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase">{$i18n.t('Status')}</th>
							</tr>
						</thead>
						<tbody>
							{#each billingInfo.transactions as transaction}
								<tr class="border-b border-gray-100/30 dark:border-gray-850/30 hover:bg-black/5 dark:hover:bg-white/5">
									<td class="px-4 py-2 text-sm">{formatDateTime(transaction.created_at)}</td>
									<td class="px-4 py-2 text-sm">{transaction.description_ru || transaction.description || '-'}</td>
									<td class="px-4 py-2 text-sm font-medium">{formatPrice(transaction.amount, transaction.currency)}</td>
									<td class="px-4 py-2">
										<span class="px-1.5 py-0.5 text-xs font-medium rounded {getStatusBadgeClass(transaction.status)}">
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
	message={$i18n.t('Are you sure you want to cancel your subscription? You will retain access until the end of the current billing period.')}
/>
