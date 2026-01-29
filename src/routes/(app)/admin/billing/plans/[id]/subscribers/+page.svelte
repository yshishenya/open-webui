<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	import { WEBUI_NAME, user } from '$lib/stores';
	import { getPlan, getPlanSubscribers } from '$lib/apis/admin/billing';
	import type { Plan, PlanSubscriber } from '$lib/apis/admin/billing';
	import {
		formatCompactNumber,
		getUsagePercentage,
		getUsageColor,
		getStatusColor
	} from '$lib/utils/billing-formatters';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import ChevronLeft from '$lib/components/icons/ChevronLeft.svelte';
	import ChevronRight from '$lib/components/icons/ChevronRight.svelte';

	const i18n = getContext('i18n');

	let loaded = false;
	let plan: Plan | null = null;
	let subscribers: PlanSubscriber[] = [];
	let currentPage = 1;
	let totalPages = 1;
	let totalSubscribers = 0;
	let pageSize = 20;

	$: planId = $page.params.id;

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		await loadPlan();
		await loadSubscribers();
		loaded = true;
	});

	const loadPlan = async () => {
		try {
			plan = await getPlan(localStorage.token, planId);
		} catch (error) {
			console.error('Failed to load plan:', error);
			toast.error($i18n.t('Failed to load plan'));
		}
	};

	const loadSubscribers = async () => {
		try {
			const result = await getPlanSubscribers(localStorage.token, planId, currentPage, pageSize);
			if (result) {
				subscribers = result.items;
				totalPages = result.total_pages;
				totalSubscribers = result.total;
			}
		} catch (error) {
			console.error('Failed to load subscribers:', error);
			toast.error($i18n.t('Failed to load subscribers'));
		}
	};

	const goToPage = async (newPage: number) => {
		if (newPage < 1 || newPage > totalPages) return;
		currentPage = newPage;
		await loadSubscribers();
	};

	const formatDate = (timestamp: number): string => {
		return new Date(timestamp * 1000).toLocaleDateString($i18n.locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};
</script>

<svelte:head>
	<title>
		{plan?.name || $i18n.t('Plan')} - {$i18n.t('Subscribers')} • {$WEBUI_NAME}
	</title>
</svelte:head>

{#if !loaded}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{:else}
	<div class="px-4.5 w-full max-w-6xl mx-auto">
		<!-- Header -->
		<div class="flex flex-col gap-1 px-1 mt-2.5 mb-4">
			<div class="flex items-center gap-2 mb-2">
				<button
					class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
					on:click={() => goto('/admin/billing/plans')}
				>
					<ChevronLeft className="size-4" />
				</button>
				<div>
					<div class="text-xl font-medium">
						{plan?.name_ru || plan?.name || $i18n.t('Plan Subscribers')}
					</div>
					<div class="text-sm text-gray-500">
						{totalSubscribers}
						{$i18n.t('subscribers')}
					</div>
				</div>
			</div>
		</div>

		<!-- Subscribers Table -->
		<div
			class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 overflow-hidden"
		>
			{#if subscribers.length === 0}
				<div class="w-full h-full flex flex-col justify-center items-center my-16">
					<div class="max-w-md text-center">
						<div class="text-3xl mb-3">👥</div>
						<div class="text-lg font-medium mb-1">{$i18n.t('No subscribers')}</div>
						<div class="text-gray-500 text-center text-xs">
							{$i18n.t('This plan has no active subscribers yet.')}
						</div>
					</div>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead
							class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
						>
							<tr>
								<th class="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('User')}</th
								>
								<th class="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Status')}</th
								>
								<th class="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Tokens Input')}</th
								>
								<th class="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Tokens Output')}</th
								>
								<th class="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Requests')}</th
								>
								<th class="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Subscribed')}</th
								>
								<th class="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300"
									>{$i18n.t('Period Ends')}</th
								>
							</tr>
						</thead>
						<tbody>
							{#each subscribers as subscriber (subscriber.user_id)}
								<tr
									class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
								>
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											<img
												src={subscriber.profile_image_url || '/user.png'}
												alt={subscriber.name}
												class="size-8 rounded-full object-cover"
											/>
											<div>
												<div class="font-medium">{subscriber.name}</div>
												<div class="text-xs text-gray-500">{subscriber.email}</div>
											</div>
										</div>
									</td>
									<td class="px-4 py-3">
										<span
											class="px-2 py-0.5 rounded text-xs font-medium {getStatusColor(
												subscriber.subscription_status
											)}"
										>
											{subscriber.subscription_status}
										</span>
									</td>
									<td class="px-4 py-3">
										{#if subscriber.tokens_input_limit}
											{@const pct = getUsagePercentage(
												subscriber.tokens_input_used,
												subscriber.tokens_input_limit
											)}
											<div class="space-y-1">
												<div class="flex justify-between text-xs">
													<span>{formatCompactNumber(subscriber.tokens_input_used)}</span>
													<span class="text-gray-500"
														>/ {formatCompactNumber(subscriber.tokens_input_limit)}</span
													>
												</div>
												<div
													class="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
												>
													<div
														class="h-full {getUsageColor(pct)} transition-all"
														style="width: {pct}%"
													></div>
												</div>
											</div>
										{:else}
											<span class="text-gray-400"
												>{formatCompactNumber(subscriber.tokens_input_used)}</span
											>
										{/if}
									</td>
									<td class="px-4 py-3">
										{#if subscriber.tokens_output_limit}
											{@const pct = getUsagePercentage(
												subscriber.tokens_output_used,
												subscriber.tokens_output_limit
											)}
											<div class="space-y-1">
												<div class="flex justify-between text-xs">
													<span>{formatCompactNumber(subscriber.tokens_output_used)}</span>
													<span class="text-gray-500"
														>/ {formatCompactNumber(subscriber.tokens_output_limit)}</span
													>
												</div>
												<div
													class="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
												>
													<div
														class="h-full {getUsageColor(pct)} transition-all"
														style="width: {pct}%"
													></div>
												</div>
											</div>
										{:else}
											<span class="text-gray-400"
												>{formatCompactNumber(subscriber.tokens_output_used)}</span
											>
										{/if}
									</td>
									<td class="px-4 py-3">
										{#if subscriber.requests_limit}
											{@const pct = getUsagePercentage(
												subscriber.requests_used,
												subscriber.requests_limit
											)}
											<div class="space-y-1">
												<div class="flex justify-between text-xs">
													<span>{subscriber.requests_used}</span>
													<span class="text-gray-500">/ {subscriber.requests_limit}</span>
												</div>
												<div
													class="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
												>
													<div
														class="h-full {getUsageColor(pct)} transition-all"
														style="width: {pct}%"
													></div>
												</div>
											</div>
										{:else}
											<span class="text-gray-400">{subscriber.requests_used}</span>
										{/if}
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-400">
										{formatDate(subscriber.subscribed_at)}
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-400">
										{formatDate(subscriber.current_period_end)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div
						class="flex justify-between items-center px-4 py-3 border-t border-gray-200 dark:border-gray-700"
					>
						<div class="text-sm text-gray-500">
							{$i18n.t('Page')}
							{currentPage}
							{$i18n.t('of')}
							{totalPages}
						</div>
						<div class="flex gap-2">
							<button
								class="px-3 py-1.5 rounded-lg text-sm font-medium transition
									{currentPage === 1
									? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
									: 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}"
								disabled={currentPage === 1}
								on:click={() => goToPage(currentPage - 1)}
							>
								<ChevronLeft className="size-4" />
							</button>
							<button
								class="px-3 py-1.5 rounded-lg text-sm font-medium transition
									{currentPage === totalPages
									? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
									: 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}"
								disabled={currentPage === totalPages}
								on:click={() => goToPage(currentPage + 1)}
							>
								<ChevronRight className="size-4" />
							</button>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
