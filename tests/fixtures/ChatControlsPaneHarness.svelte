<script lang="ts">
	import ChatControls from '../../src/lib/components/chat/ChatControls.svelte';
	import { showControls } from '../../src/lib/stores';

	let container: HTMLDivElement;
	export const getSize = (): number => Number(container?.querySelector('#controls-resizer')?.getAttribute('aria-valuenow') ?? 0);
	export const openPane = (): void => showControls.set(true);
</script>

<div id="test-chat-container" class="flex" bind:this={container}>
	<input value="unfinished draft" />
	<ChatControls
		chatId="saved-chat"
		history={{ messages: {}, currentId: null }}
		files={[]}
		modelId="free-model"
		eventTarget={new EventTarget()}
		bridge={undefined as unknown as import('$lib/utils/realtime').RealtimeCall}
		submitPrompt={async () => {}}
		stopResponse={async () => {}}
		showMessage={async () => {}}
	/>
</div>
