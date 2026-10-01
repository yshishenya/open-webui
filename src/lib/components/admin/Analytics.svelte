<script>
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores';

	import Dashboard from './Analytics/Dashboard.svelte';
	import ProductFunnel from './Analytics/ProductFunnel.svelte';
	let productFunnel = false;

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
				aria-pressed={!productFunnel}
				on:click={() => (productFunnel = false)}>{$i18n.t('Model usage')}</button
			><button
				class="rounded border px-3 py-2"
				aria-pressed={productFunnel}
				on:click={() => (productFunnel = true)}>{$i18n.t('Product funnel')}</button
			>
		</div>
		{#if productFunnel}<ProductFunnel />{:else}<Dashboard />{/if}
	</div>
{/if}
