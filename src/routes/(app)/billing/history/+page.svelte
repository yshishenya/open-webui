<script lang="ts">
	import { getContext } from 'svelte';

	import { WEBUI_NAME } from '$lib/stores';
	import UnifiedTimeline from '$lib/components/billing/UnifiedTimeline.svelte';

	const i18n = getContext('i18n');
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
				<div class="text-xl font-medium">{$i18n.t('History')}</div>
			</div>
		</div>
	</div>

	<UnifiedTimeline pageSize={20} showFilters={true} showLoadMore={true} />
</div>
