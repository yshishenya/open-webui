<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Pane, PaneGroup, type PaneAPI } from 'paneforge';
	import ChatControls from '../../src/lib/components/chat/ChatControls.svelte';
	import { showControls } from '../../src/lib/stores';

	let pane: PaneAPI | undefined;
	let controls: ChatControls;
	export const getSize = (): number => pane?.getSize() ?? 0;
	export const openPane = (): void => controls.openPane();
	onMount(() =>
		showControls.subscribe(async (open) => {
			await tick();
			if (pane) {
				if (open) controls.openPane();
				else pane.collapse();
			}
		})
	);
</script>

<div id="test-chat-container">
	<PaneGroup direction="horizontal">
		<Pane><input value="unfinished draft" /></Pane>
		<ChatControls
			bind:this={controls}
			bind:pane
			containerId="test-chat-container"
			chatId="saved-chat"
			history={{ messages: {} }}
			files={[]}
			modelId="free-model"
			eventTarget={new EventTarget()}
			submitPrompt={async () => {}}
			stopResponse={async () => {}}
			showMessage={async () => {}}
		/>
	</PaneGroup>
</div>
