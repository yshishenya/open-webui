<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import TagItem from './TagItem.svelte';
	const dispatch = createEventDispatcher();

	export let tags: { name: string }[] = [];
	export let disabled = false;
</script>

{#each tags as tag}
	<TagItem
		{tag}
		{disabled}
		onDelete={() => {
			dispatch('delete', tag.name);
		}}
	/>
{/each}
