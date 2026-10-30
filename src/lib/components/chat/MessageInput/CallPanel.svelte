<script lang="ts">
	import { getContext, onMount, type ComponentProps } from 'svelte';
	import { config, showCallOverlay, showControls } from '$lib/stores';
	import type { RealtimeCall } from '$lib/utils/realtime';
	import CallOverlay from './CallOverlay.svelte';
	import BridgeCallOverlay from './CallOverlay/BridgeCallOverlay.svelte';
	import { toast } from 'svelte-sonner';

	const i18n = getContext<typeof import('$lib/i18n').default>('i18n');
	export let bridge: RealtimeCall;
	export let callMode = 'current';
	export let files: import('$lib/utils/airis/chat_history').ChatAttachment[];
	export let submitPrompt: NonNullable<ComponentProps<typeof CallOverlay>['submitPrompt']>;
	export let stopResponse: () => void | Promise<void>;
	export let modelId: string;
	export let chatId: string;
	export let eventTarget: EventTarget;
	let started = false;

	const close = () => {
		showCallOverlay.set(false);
		showControls.set(false);
	};

	onMount(() => {
		callMode =
			bridge?.connected || bridge?.connecting || $config?.audio?.realtime?.enabled
				? 'bridge'
				: 'current';
		if (callMode === 'bridge') {
			void bridge.connect(localStorage.token);
		} else if ($config?.audio?.stt?.engine === 'web') {
			toast.error($i18n.t('Call feature is not supported when using Web STT engine'));
			close();
			return;
		}
		started = true;
	});

	$: if (
		started &&
		callMode === 'bridge' &&
		!bridge?.connected &&
		!bridge?.connecting &&
		!bridge?.error
	)
		close();
</script>

{#if started}
	{#if callMode === 'bridge'}
		<BridgeCallOverlay {bridge} {modelId} on:close />
	{:else}
		<CallOverlay
			bind:files
			{submitPrompt}
			{stopResponse}
			{modelId}
			{chatId}
			{eventTarget}
			on:close
		/>
	{/if}
{/if}
