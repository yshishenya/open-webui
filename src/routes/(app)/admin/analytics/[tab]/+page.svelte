<script lang="ts">
	import { page } from '$app/stores';
	import Workspace from '$lib/components/admin/Analytics/Workspace.svelte';
</script>

<Workspace view={$page.params.tab} />
