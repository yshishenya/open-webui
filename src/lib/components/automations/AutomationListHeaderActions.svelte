<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import SplitCreateButton from '$lib/components/common/SplitCreateButton.svelte';

	export let actions: ComponentProps<typeof SplitCreateButton>['actions'] = [];
</script>

<div class="ml-auto flex items-center gap-1">
	<SplitCreateButton {actions} />
</div>
