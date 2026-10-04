<script lang="ts">
	import { onMount, type ComponentProps } from 'svelte';
	import InputVariablesModal from '$lib/components/chat/MessageInput/InputVariablesModal.svelte';
	export let props: ComponentProps<typeof InputVariablesModal> = {};
	let show = true;
	let onCancel: () => void = () => {};
	// Match the caller: the resolver is assigned after the child first mounts.
	onMount(() => {
		onCancel = props.onCancel ?? (() => {});
	});
</script>

<button type="button" on:click={() => (show = true)}>Reopen</button>
<InputVariablesModal {...props} {onCancel} bind:show />
<output data-testid="variables-open">{show}</output>
