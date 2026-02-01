<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';

	import { WEBUI_NAME } from '$lib/stores';
	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');

	onMount(async () => {
		await goto('/billing/balance');
	});
</script>

<svelte:head>
	<title>
		{$i18n.t('Billing Settings')} • {$WEBUI_NAME}
	</title>
</svelte:head>

<div class="w-full h-full flex justify-center items-center">
	<Spinner className="size-5" />
</div>
