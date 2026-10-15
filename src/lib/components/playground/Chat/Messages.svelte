<script lang="ts">
	import type { ChatHistoryMessage } from '$lib/utils/airis/chat_history';
	import Message from './Message.svelte';

	export let messages: Required<Pick<ChatHistoryMessage, 'role' | 'content'>>[] = [];
</script>

<div class="py-3 space-y-3">
	{#each messages as message, idx}
		<Message
			{message}
			{idx}
			onDelete={() => {
				messages = messages.filter((message, messageIdx) => messageIdx !== idx);
			}}
		/>
	{/each}
</div>
