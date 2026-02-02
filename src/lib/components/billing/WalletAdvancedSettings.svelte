<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	import ChevronDown from '$lib/components/icons/ChevronDown.svelte';
	import ChevronUp from '$lib/components/icons/ChevronUp.svelte';

	export let open = false;
	export let title = '';
	export let helper = '';
	export let onToggle: (open: boolean) => void = () => {};

	const dispatch = createEventDispatcher<{ toggle: { open: boolean } }>();
	let contentId = 'wallet-advanced-settings-content';

	onMount(() => {
		const uuid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 9);
		contentId = `wallet-advanced-settings-${uuid}`;
	});

	const handleToggle = (): void => {
		open = !open;
		onToggle(open);
		dispatch('toggle', { open });
	};
</script>

<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
	<button
		type="button"
		class="w-full text-left"
		aria-expanded={open}
		aria-controls={contentId}
		on:click={handleToggle}
	>
		<div class="flex items-start justify-between gap-3">
			<div>
				<div class="text-sm font-medium">{title}</div>
				{#if helper}
					<div class="text-xs text-gray-500 mt-1">{helper}</div>
				{/if}
			</div>
			<div class="flex self-start translate-y-0.5">
				{#if open}
					<ChevronUp strokeWidth="3.5" className="size-3.5" />
				{:else}
					<ChevronDown strokeWidth="3.5" className="size-3.5" />
				{/if}
			</div>
		</div>
	</button>

	{#if open}
		<div
			id={contentId}
			class="mt-4 space-y-4"
			transition:slide={{ duration: 300, easing: quintOut, axis: 'y' }}
		>
			<slot />
		</div>
	{/if}
</div>
