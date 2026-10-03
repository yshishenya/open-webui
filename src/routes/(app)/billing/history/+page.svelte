<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import { WEBUI_NAME } from '$lib/stores';
	import UnifiedTimeline from '$lib/components/billing/UnifiedTimeline.svelte';
	import WalletPeriodSummary from '$lib/components/billing/WalletPeriodSummary.svelte';
	import { trackEvent } from '$lib/utils/analytics';

	const i18n = getContext('i18n');
	type HistoryFilter = 'all' | 'paid' | 'free' | 'topups' | 'refunds';
	let periodFrom: number | null = null;
	let periodTo: number | null = null;

	const resolveFilter = (): HistoryFilter => {
		const value = $page.url.searchParams.get('filter');
		return value && ['all', 'paid', 'free', 'topups', 'refunds'].includes(value)
			? (value as HistoryFilter)
			: 'all';
	};

	const handleFilterChange = (filter: HistoryFilter): void => {
		trackEvent('billing_history_filter_change', { filter });
	};

	onMount(() => {
		trackEvent('billing_history_view', { filter: resolveFilter() });
	});
</script>

<svelte:head>
	<title>
		{$i18n.t('Operations')} • {$WEBUI_NAME}
	</title>
</svelte:head>

<div class="w-full max-w-5xl mx-auto">
	<div class="flex flex-col gap-1 px-1 mt-1.5 mb-4">
		<div class="flex justify-between items-center mb-1 w-full">
			<div class="flex items-center gap-2">
				<h1 class="text-xl font-medium">{$i18n.t('Operations')}</h1>
			</div>
		</div>
		<div class="text-sm text-gray-500">
			{$i18n.t('All activity in one place')}
		</div>
	</div>

	<WalletPeriodSummary
		initialFrom={$page.url.searchParams.get('from_date') ?? ''}
		initialTo={$page.url.searchParams.get('to_date') ?? ''}
		onPeriodChange={(from, to) => {
			periodFrom = from;
			periodTo = to;
			const params = new URLSearchParams($page.url.searchParams);
			params.set('from_date', new Date(from * 1000).toISOString().slice(0, 10));
			params.set('to_date', new Date((to - 86400) * 1000).toISOString().slice(0, 10));
			void goto(`${$page.url.pathname}?${params}`, {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		}}
	/>
	{#if periodFrom !== null && periodTo !== null}
		{#key `${periodFrom}:${periodTo}`}
			<UnifiedTimeline
				{periodFrom}
				{periodTo}
				pageSize={20}
				showFilters={true}
				showLoadMore={true}
				syncFilterWithUrl={true}
				onFilterChange={handleFilterChange}
			/>
		{/key}
	{/if}
</div>
