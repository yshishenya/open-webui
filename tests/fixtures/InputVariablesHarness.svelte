<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputVariablesModal from '$lib/components/chat/MessageInput/InputVariablesModal.svelte';
	export let props: ComponentProps<typeof InputVariablesModal> = {};
	let show = true;
</script>

<button type="button" on:click={() => (show = true)}>Reopen</button>
<InputVariablesModal {...props} bind:show />
<output data-testid="variables-open">{show}</output>
