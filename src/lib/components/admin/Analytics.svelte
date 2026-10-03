<script>
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores';

	import Dashboard from './Analytics/Dashboard.svelte';
	import ProductFunnel from './Analytics/ProductFunnel.svelte';
	import EmailObservations from './Analytics/EmailObservations.svelte';
	let activeTab = 'models';

	const i18n = getContext('i18n');

	let loaded = false;

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
		}
		loaded = true;
	});
</script>

{#if loaded}
	<div class="w-full h-full pb-2">
		<div class="flex gap-2 p-2">
			<button
				class="rounded border px-3 py-2"
				aria-pressed={activeTab === 'models'}
				on:click={() => (activeTab = 'models')}>{$i18n.t('Model usage')}</button
			><button
				class="rounded border px-3 py-2"
				aria-pressed={activeTab === 'funnel'}
				on:click={() => (activeTab = 'funnel')}>{$i18n.t('Product funnel')}</button
			>
			<button class="rounded border px-3 py-2" aria-pressed={activeTab === 'mail'}
				on:click={() => (activeTab = 'mail')}>{$i18n.language?.startsWith('ru') ? 'Диагностика писем' : 'Email diagnostics'}</button>
		</div>
		{#if activeTab === 'funnel'}<ProductFunnel />{:else if activeTab === 'mail'}<EmailObservations />{:else}<Dashboard />{/if}
	</div>
{/if}
