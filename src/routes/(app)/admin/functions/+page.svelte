<script lang="ts">
	import { onMount } from 'svelte';
	import { config } from '$lib/stores';
	import { goto } from '$app/navigation';

	import Functions from '$lib/components/admin/Functions.svelte';
	let enabled = false;

	onMount(() => {
		if (!$config?.features?.enable_plugins) {
			void goto('/admin', { replaceState: true });
			return;
		}
		enabled = true;
	});
</script>

{#if enabled}
	<Functions />
{/if}
