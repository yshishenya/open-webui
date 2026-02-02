<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { page } from '$app/stores';

	import { WEBUI_NAME } from '$lib/stores';
	import UnifiedTimeline from '$lib/components/billing/UnifiedTimeline.svelte';
	import { trackEvent } from '$lib/utils/analytics';

	const i18n = getContext('i18n');
	type HistoryFilter = 'all' | 'paid' | 'free' | 'topups';

	const resolveFilter = (): HistoryFilter => {
		const value = $page.url.searchParams.get('filter');
		return value && ['all', 'paid', 'free', 'topups'].includes(value)
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
		{$i18n.t('History')} • {$WEBUI_NAME}
	</title>
</svelte:head>

<div class="w-full">
	<div class="flex flex-col gap-1 px-1 mt-1.5 mb-3">
		<div class="flex justify-between items-center mb-1 w-full">
			<div class="flex items-center gap-2">
				<h1 class="text-xl font-medium">{$i18n.t('History')}</h1>
			</div>
		</div>
		<div class="text-sm text-gray-500">
			{$i18n.t('All activity in one place')}
		</div>
	</div>

	<UnifiedTimeline
		pageSize={20}
		showFilters={true}
		showLoadMore={true}
		syncFilterWithUrl={true}
		onFilterChange={handleFilterChange}
	/>
</div>
