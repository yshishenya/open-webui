<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import EditGroupModal from '$lib/components/admin/Users/Groups/EditGroupModal.svelte';

	export let props: ComponentProps<typeof EditGroupModal> = {};
	let show = true;
</script>

<EditGroupModal {...props} bind:show />
<output data-testid="group-open">{show}</output>
