<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { user } from '$lib/stores';
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
		return new Date(timestamp * 1000).toLocaleDateString('ru-RU', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const formatDateTime = (timestamp: number): string => {
		return new Date(timestamp * 1000).toLocaleString('ru-RU', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const formatPrice = (amount: number, currency: string): string => {
		return new Intl.NumberFormat('ru-RU', {
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
		const classes = {
			active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
			canceled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
			pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
			succeeded: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
			failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
		};
		return classes[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
	};

	const getQuotaLabel = (key: string): string => {
		const labels = {
			tokens_input: $i18n.t('Input tokens'),
			tokens_output: $i18n.t('Output tokens'),
			requests: $i18n.t('Requests')
		};
		return labels[key] || key;
	};
</script>

<div class="flex flex-col w-full h-full">
	<!-- Header -->
	<div class="flex items-center justify-between px-5 py-4 border-b dark:border-gray-800">
		<div class="flex items-center gap-2">
			<div class="text-2xl font-semibold">
				{$i18n.t('Billing Dashboard')}
			</div>
		</div>
		<div>
			<button
				type="button"
				on:click={() => goto('/billing/plans')}
				class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
			>
				{$i18n.t('View Plans')}
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto px-5 py-8">
		{#if loading}
			<div class="flex items-center justify-center h-64">
				<Spinner className="size-8" />
			</div>
		{:else if !billingInfo}
			<div class="flex flex-col items-center justify-center h-64 text-center">
				<div class="text-gray-500 dark:text-gray-400 text-lg">
					{$i18n.t('No billing information available')}
				</div>
			</div>
		{:else}
			<div class="max-w-7xl mx-auto space-y-6">
				<!-- Subscription Card -->
				<div class="border dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-850">
					<div class="flex items-start justify-between mb-4">
						<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-50">
							{$i18n.t('Current Subscription')}
						</h3>
						{#if billingInfo.subscription}
							<span
								class="px-3 py-1 text-xs font-medium rounded-full {getStatusBadgeClass(
									billingInfo.subscription.status
								)}"
							>
								{billingInfo.subscription.status.toUpperCase()}
							</span>
						{/if}
					</div>

					{#if billingInfo.subscription && billingInfo.plan}
						<div class="space-y-4">
							<div>
								<div class="text-2xl font-bold text-gray-900 dark:text-gray-50">
									{billingInfo.plan.name_ru || billingInfo.plan.name}
								</div>
								{#if billingInfo.plan.description || billingInfo.plan.description_ru}
									<div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
										{billingInfo.plan.description_ru || billingInfo.plan.description}
									</div>
								{/if}
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
								<div>
									<span class="text-gray-600 dark:text-gray-400"
										>{$i18n.t('Current period start')}:</span
									>
									<span class="ml-2 font-medium text-gray-900 dark:text-gray-50">
										{formatDate(billingInfo.subscription.current_period_start)}
									</span>
								</div>
								<div>
									<span class="text-gray-600 dark:text-gray-400"
										>{$i18n.t('Current period end')}:</span
									>
									<span class="ml-2 font-medium text-gray-900 dark:text-gray-50">
										{formatDate(billingInfo.subscription.current_period_end)}
									</span>
								</div>
							</div>

							{#if billingInfo.subscription.cancel_at_period_end}
								<div
									class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3"
								>
									<div class="text-sm text-yellow-800 dark:text-yellow-200">
										{$i18n.t('Your subscription will be canceled at the end of the current period')}
									</div>
								</div>
							{:else if billingInfo.subscription.status === 'active'}
								<div class="pt-2">
									<button
										type="button"
										on:click={() => (showCancelConfirm = true)}
										disabled={canceling}
										class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors text-sm font-medium disabled:cursor-not-allowed"
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
						<div class="text-gray-600 dark:text-gray-400">
							{$i18n.t('No active subscription')}
						</div>
						<div class="pt-4">
							<button
								type="button"
								on:click={() => goto('/billing/plans')}
								class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
							>
								{$i18n.t('Browse Plans')}
							</button>
						</div>
					{/if}
				</div>

				<!-- Usage Card -->
				{#if billingInfo.usage && Object.keys(billingInfo.usage).length > 0}
					<div class="border dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-850">
						<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
							{$i18n.t('Usage Statistics')}
						</h3>

						<div class="space-y-6">
							{#each Object.entries(billingInfo.usage) as [metric, usage]}
								<div>
									<div class="flex items-center justify-between mb-2">
										<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
											{getQuotaLabel(metric)}
										</span>
										<span class="text-sm text-gray-600 dark:text-gray-400">
											{formatQuota(usage.current_usage)}
											{#if usage.quota_limit}
												/ {formatQuota(usage.quota_limit)}
											{/if}
										</span>
									</div>
									{#if usage.quota_limit}
										<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
											<div
												class="{getUsageColor(
													getUsagePercentage(usage)
												)} h-2 rounded-full transition-all"
												style="width: {getUsagePercentage(usage)}%"
											/>
										</div>
										<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
					<div class="border dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-850">
						<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
							{$i18n.t('Transaction History')}
						</h3>

						<div class="overflow-x-auto">
							<table class="w-full">
								<thead>
									<tr class="border-b dark:border-gray-700 text-left">
										<th class="pb-3 text-sm font-medium text-gray-700 dark:text-gray-300"
											>{$i18n.t('Date')}</th
										>
										<th class="pb-3 text-sm font-medium text-gray-700 dark:text-gray-300"
											>{$i18n.t('Description')}</th
										>
										<th class="pb-3 text-sm font-medium text-gray-700 dark:text-gray-300"
											>{$i18n.t('Amount')}</th
										>
										<th class="pb-3 text-sm font-medium text-gray-700 dark:text-gray-300"
											>{$i18n.t('Status')}</th
										>
									</tr>
								</thead>
								<tbody>
									{#each billingInfo.transactions as transaction}
										<tr class="border-b dark:border-gray-800">
											<td class="py-3 text-sm text-gray-900 dark:text-gray-100">
												{formatDateTime(transaction.created_at)}
											</td>
											<td class="py-3 text-sm text-gray-900 dark:text-gray-100">
												{transaction.description_ru || transaction.description || '-'}
											</td>
											<td class="py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">
												{formatPrice(transaction.amount, transaction.currency)}
											</td>
											<td class="py-3">
												<span
													class="px-2 py-1 text-xs font-medium rounded-full {getStatusBadgeClass(
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
	</div>
</div>

<!-- Cancel Confirmation Dialog -->
<ConfirmDialog
	bind:show={showCancelConfirm}
	on:confirm={handleCancelSubscription}
	title={$i18n.t('Cancel Subscription')}
	message={$i18n.t(
		'Are you sure you want to cancel your subscription? You will retain access until the end of the current billing period.'
	)}
/>

<style>
	/* Additional styling if needed */
</style>
