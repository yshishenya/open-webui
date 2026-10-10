<script lang="ts">
	import type { ChatHistory } from '$lib/utils/airis/chat_history';
	import type { ChatOverviewClick } from '$lib/utils/airis/frontend-contracts';
	import { SvelteFlowProvider } from '@xyflow/svelte';

	import View from './Overview/View.svelte';

	export let history: ChatHistory;
	export let onNodeClick: (event: ChatOverviewClick) => void;
</script>

<SvelteFlowProvider>
	<View {history} {onNodeClick} />
</SvelteFlowProvider>
