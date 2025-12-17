<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import { WEBUI_NAME, user } from '$lib/stores';
	import { getPlan, getPlanSubscribers } from '$lib/apis/admin/billing';
	import type { Plan, PlanSubscriber, PaginatedSubscribers } from '$lib/apis/admin/billing';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Badge from '$lib/components/common/Badge.svelte';
	import ChevronLeft from '$lib/components/icons/ChevronLeft.svelte';
	import ChartBar from '$lib/components/icons/ChartBar.svelte';

	const i18n = getContext('i18n');

	let planId = '';
	let loading = true;
	let plan: Plan | null = null;
	let subscribers: PlanSubscriber[] = [];
	let totalSubscribers = 0;
	let currentPage = 1;
	let totalPages = 1;
	const pageSize = 20;

	// Computed stats
	$: activeSubscribers = subscribers.filter(s => s.subscription_status === 'active').length;
	$: canceledSubscribers = subscribers.filter(s => s.subscription_status === 'canceled').length;
	$: trialSubscribers = subscribers.filter(s => s.subscription_status === 'trialing').length;
	$: pastDueSubscribers = subscribers.filter(s => s.subscription_status === 'past_due').length;

	// MRR calculation
	$: mrr = plan ? calculateMRR(plan, activeSubscribers) : 0;
	$: arr = mrr * 12;

	// Churn rate
	$: churnRate = subscribers.length > 0 ? (canceledSubscribers / subscribers.length) * 100 : 0;

	// Revenue by month (demo data)
	$: revenueData = generateRevenueData();

	onMount(async () => {
		if ($user?.role !== 'admin') {
			goto('/');
			return;
		}

		planId = $page.params.id;
		await loadData();
	});

	const loadData = async () => {
		loading = true;
		try {
			const [planData, subscribersData] = await Promise.all([
				getPlan(localStorage.token, planId),
				getPlanSubscribers(localStorage.token, planId, currentPage, pageSize)
			]);

			if (!planData) {
				toast.error($i18n.t('Plan not found'));
				goto('/admin/billing/plans');
				return;
			}

			plan = planData;
			if (subscribersData) {
				subscribers = subscribersData.items;
				totalSubscribers = subscribersData.total;
				totalPages = subscribersData.total_pages;
			} else {
				subscribers = [];
				totalSubscribers = 0;
				totalPages = 1;
			}
		} catch (error) {
			console.error('Failed to load analytics:', error);
			toast.error($i18n.t('Failed to load analytics'));
		} finally {
			loading = false;
		}
	};

	const loadSubscribersPage = async (newPage: number) => {
		if (newPage < 1 || newPage > totalPages) return;
		currentPage = newPage;
		try {
			const subscribersData = await getPlanSubscribers(localStorage.token, planId, currentPage, pageSize);
			if (subscribersData) {
				subscribers = subscribersData.items;
				totalSubscribers = subscribersData.total;
				totalPages = subscribersData.total_pages;
			}
		} catch (error) {
			console.error('Failed to load subscribers:', error);
			toast.error($i18n.t('Failed to load subscribers'));
		}
	};

	const calculateMRR = (plan: Plan, activeCount: number): number => {
		if (!plan || activeCount === 0) return 0;

		const price = plan.price;
		const interval = plan.interval;

		let monthlyPrice = price;
		if (interval === 'year') monthlyPrice = price / 12;
		else if (interval === 'week') monthlyPrice = price * 4.33;
		else if (interval === 'day') monthlyPrice = price * 30;

		return monthlyPrice * activeCount;
	};

	const generateRevenueData = () => {
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		const currentMonth = new Date().getMonth();

		return months.slice(Math.max(0, currentMonth - 5), currentMonth + 1).map((month, i) => ({
			month,
			revenue: mrr * (0.7 + (i * 0.05)),
			subscribers: Math.floor(activeSubscribers * (0.7 + (i * 0.05)))
		}));
	};

	const formatPrice = (price: number, currency: string = 'RUB'): string => {
		if (price === 0) return $i18n.t('Free');
		return new Intl.NumberFormat($i18n.locale, {
			style: 'currency',
			currency: currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(price);
	};

	const formatDate = (timestamp: number): string => {
		return new Date(timestamp * 1000).toLocaleDateString($i18n.locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	const getStatusColor = (status: string): string => {
		switch (status) {
			case 'active':
				return 'bg-green-500/20 text-green-700 dark:text-green-200';
			case 'canceled':
				return 'bg-red-500/20 text-red-700 dark:text-red-200';
			case 'trialing':
				return 'bg-blue-500/20 text-blue-700 dark:text-blue-200';
			case 'past_due':
				return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-200';
			default:
				return 'bg-gray-500/20 text-gray-700 dark:text-gray-200';
		}
	};

	const getStatusLabel = (status: string): string => {
		const labels: Record<string, string> = {
			active: $i18n.t('Active'),
			canceled: $i18n.t('Canceled'),
			trialing: $i18n.t('Trial'),
			past_due: $i18n.t('Past Due'),
			incomplete: $i18n.t('Incomplete'),
			incomplete_expired: $i18n.t('Expired')
		};
		return labels[status] || status;
	};
</script>

<svelte:head>
	<title>
		{$i18n.t('Analytics')} • {plan?.name || planId} • {$WEBUI_NAME}
	</title>
</svelte:head>

{#if loading}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{:else if !plan}
	<div class="w-full h-full flex justify-center items-center">
		<div class="text-gray-500 dark:text-gray-400">
			{$i18n.t('Plan not found')}
		</div>
	</div>
{:else}
	<div class="px-4.5 w-full">
		<!-- Header -->
		<div class="flex flex-col gap-1 px-1 mt-2.5 mb-2">
			<div class="flex justify-between items-center mb-1 w-full">
				<div class="flex items-center gap-2">
					<Tooltip content={$i18n.t('Back')}>
						<button
							class="text-left text-sm py-1.5 px-1 rounded-lg dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-gray-850"
							on:click={() => goto('/admin/billing/plans')}
							type="button"
						>
							<ChevronLeft strokeWidth="2.5" />
						</button>
					</Tooltip>
					<div class="flex items-center gap-2">
						<ChartBar className="size-5" />
						<div class="text-xl font-medium">{plan.name_ru || plan.name}</div>
					</div>
					<Badge type="muted" content={planId} />
				</div>

				<button
					type="button"
					on:click={() => goto(`/admin/billing/plans/${planId}/edit`)}
					class="px-2 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm"
				>
					{$i18n.t('Edit Plan')}
				</button>
			</div>
		</div>

		<!-- Key Metrics -->
		<div class="grid grid-cols-4 gap-2 mb-4">
			<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-3">
				<div class="text-xs text-gray-500">{$i18n.t('MRR')}</div>
				<div class="text-lg font-medium">{formatPrice(mrr, plan.currency)}</div>
				<div class="text-xs text-gray-400">{$i18n.t('ARR')}: {formatPrice(arr, plan.currency)}</div>
			</div>
			<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-3">
				<div class="text-xs text-gray-500">{$i18n.t('Active')}</div>
				<div class="text-lg font-medium text-green-600 dark:text-green-400">{activeSubscribers}</div>
				<div class="text-xs text-gray-400">{trialSubscribers} {$i18n.t('on trial')}</div>
			</div>
			<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-3">
				<div class="text-xs text-gray-500">{$i18n.t('Churn')}</div>
				<div class="text-lg font-medium">{churnRate.toFixed(1)}%</div>
				<div class="text-xs text-gray-400">{canceledSubscribers} {$i18n.t('canceled')}</div>
			</div>
			<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-3">
				<div class="text-xs text-gray-500">{$i18n.t('Total')}</div>
				<div class="text-lg font-medium">{totalSubscribers}</div>
				<div class="text-xs text-gray-400">{pastDueSubscribers} {$i18n.t('past due')}</div>
			</div>
		</div>

		<!-- Plan Details & Revenue -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
			<!-- Plan Details -->
			<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
				<div class="text-sm font-medium mb-3">{$i18n.t('Plan Details')}</div>
				<div class="grid grid-cols-2 gap-3 text-sm">
					<div>
						<div class="text-xs text-gray-500">{$i18n.t('Price')}</div>
						<div class="font-medium">{formatPrice(plan.price, plan.currency)} / {$i18n.t(plan.interval)}</div>
					</div>
					<div>
						<div class="text-xs text-gray-500">{$i18n.t('Status')}</div>
						<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium
							{plan.is_active
								? 'bg-green-500/20 text-green-700 dark:text-green-200'
								: 'bg-gray-500/20 text-gray-700 dark:text-gray-200'}">
							{plan.is_active ? $i18n.t('Active') : $i18n.t('Inactive')}
						</span>
					</div>
					{#if plan.quotas}
						<div>
							<div class="text-xs text-gray-500">{$i18n.t('Input Tokens')}</div>
							<div class="font-medium">{plan.quotas.tokens_input !== null ? plan.quotas.tokens_input.toLocaleString($i18n.locale) : '∞'}</div>
						</div>
						<div>
							<div class="text-xs text-gray-500">{$i18n.t('Output Tokens')}</div>
							<div class="font-medium">{plan.quotas.tokens_output !== null ? plan.quotas.tokens_output.toLocaleString($i18n.locale) : '∞'}</div>
						</div>
						<div>
							<div class="text-xs text-gray-500">{$i18n.t('Requests')}</div>
							<div class="font-medium">{plan.quotas.requests !== null ? plan.quotas.requests.toLocaleString($i18n.locale) : '∞'}</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Revenue Trend -->
			{#if revenueData.length > 0}
				<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
					<div class="flex items-center justify-between mb-3">
						<div class="text-sm font-medium">{$i18n.t('Revenue Trend')}</div>
						<span class="px-1.5 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-700 dark:text-yellow-200 rounded">
							{$i18n.t('Demo')}
						</span>
					</div>
					<div class="space-y-2">
						{#each revenueData as data}
							<div>
								<div class="flex items-center justify-between text-xs mb-0.5">
									<span class="font-medium">{data.month}</span>
									<span class="text-gray-500">
										{formatPrice(data.revenue, plan.currency)}
									</span>
								</div>
								<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
									<div
										class="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all"
										style="width: {Math.min((data.revenue / mrr) * 100, 100)}%"
									></div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Subscribers List -->
		<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30">
			<div class="px-4 py-3 border-b border-gray-100/30 dark:border-gray-850/30">
				<div class="text-sm font-medium">{$i18n.t('Subscribers')} ({totalSubscribers})</div>
			</div>

			{#if subscribers.length === 0}
				<div class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
					{$i18n.t('No subscribers yet')}
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-gray-100/30 dark:border-gray-850/30 text-left">
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase">{$i18n.t('User')}</th>
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase">{$i18n.t('Email')}</th>
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase">{$i18n.t('Status')}</th>
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase">{$i18n.t('Subscribed')}</th>
								<th class="px-4 py-2 text-xs font-medium text-gray-500 uppercase">{$i18n.t('Next Billing')}</th>
							</tr>
						</thead>
						<tbody>
							{#each subscribers as subscriber}
								<tr class="border-b border-gray-100/30 dark:border-gray-850/30 hover:bg-black/5 dark:hover:bg-white/5">
									<td class="px-4 py-2">
										<div class="font-medium text-sm">{subscriber.name || 'Unknown'}</div>
										<div class="text-xs text-gray-500">{subscriber.user_id.slice(0, 8)}...</div>
									</td>
									<td class="px-4 py-2 text-sm">{subscriber.email}</td>
									<td class="px-4 py-2">
										<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium {getStatusColor(subscriber.subscription_status)}">
											{getStatusLabel(subscriber.subscription_status)}
										</span>
									</td>
									<td class="px-4 py-2 text-sm text-gray-500">{formatDate(subscriber.subscribed_at)}</td>
									<td class="px-4 py-2 text-sm text-gray-500">{formatDate(subscriber.current_period_end)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div class="flex items-center justify-between px-4 py-3 border-t border-gray-100/30 dark:border-gray-850/30">
						<div class="text-xs text-gray-500">
							{$i18n.t('Page')} {currentPage} {$i18n.t('of')} {totalPages}
						</div>
						<div class="flex items-center gap-1">
							<button
								type="button"
								on:click={() => loadSubscribersPage(currentPage - 1)}
								disabled={currentPage === 1}
								class="px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{$i18n.t('Previous')}
							</button>
							<button
								type="button"
								on:click={() => loadSubscribersPage(currentPage + 1)}
								disabled={currentPage === totalPages}
								class="px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{$i18n.t('Next')}
							</button>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
