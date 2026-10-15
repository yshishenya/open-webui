<script lang="ts">
	import { WEBUI_BASE_URL } from '$lib/constants';
	import { settings, playingNotificationSound, isLastActiveTab } from '$lib/stores';
	import DOMPurify from 'dompurify';
	import { sanitizedHtml } from '$lib/utils/airis/sanitized_html';
	import { marked } from 'marked';

	import { createEventDispatcher, onMount } from 'svelte';
	import XMark from '$lib/components/icons/XMark.svelte';

	const dispatch = createEventDispatcher();

	export let onClick: () => unknown = () => {};
	export let title: string = 'HI';
	export let content: string;

	let startX = 0,
		startY = 0;
	let moved = false;
	let activePointerId: number | null = null;
	let closeButtonElement: HTMLButtonElement;
	const DRAG_THRESHOLD_PX = 6;

	const clickHandler = (): void => {
		onClick();
		dispatch('closeToast');
	};

	const closeHandler = (): void => {
		dispatch('closeToast');
	};

	function onPointerDown(e: PointerEvent): void {
		if (
			e.button !== 0 ||
			!e.isPrimary ||
			activePointerId !== null ||
			closeButtonElement?.contains(e.target as Node) ||
			(e.target instanceof Element && e.target.closest('a'))
		)
			return;
		activePointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		moved = false;
		// Keep the gesture when the toast moves under the pointer.
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onPointerMove(e: PointerEvent): void {
		if (e.pointerId !== activePointerId || moved) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
			moved = true;
		}
	}

	function onPointerUp(e: PointerEvent): void {
		if (e.pointerId !== activePointerId || e.button !== 0) return;
		activePointerId = null;
		const target = e.currentTarget as HTMLElement;
		if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
		if (!moved) clickHandler();
	}

	function onPointerCancel(e: PointerEvent): void {
		if (e.pointerId !== activePointerId) return;
		activePointerId = null;
		moved = true;
	}

	onMount(() => {
		if (!navigator.userActivation.hasBeenActive) {
			return;
		}

		if ($settings?.notificationSound ?? true) {
			if (!$playingNotificationSound && $isLastActiveTab) {
				playingNotificationSound.set(true);

				const audio = new Audio(`/audio/notification.mp3`);
				audio.play().finally(() => {
					// Ensure the global state is reset after the sound finishes
					playingNotificationSound.set(false);
				});
			}
		}
	});
</script>

<div
	role="status"
	aria-live="polite"
	class="group relative flex gap-2.5 text-left min-w-[var(--width)] w-full dark:bg-gray-850 dark:text-white bg-white text-black border border-gray-100 dark:border-gray-800 rounded-3xl px-4 py-3.5 cursor-pointer select-none"
	on:dragstart|preventDefault
	on:pointerdown={onPointerDown}
	on:pointermove={onPointerMove}
	on:pointerup={onPointerUp}
	on:pointercancel={onPointerCancel}
	on:lostpointercapture={(e: PointerEvent): void => {
		if (e.target === e.currentTarget) onPointerCancel(e);
	}}
>
	<!-- Close button (visible on hover) -->
	<button
		bind:this={closeButtonElement}
		type="button"
		class="absolute -top-0.5 -left-0.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-opacity z-10"
		on:click|stopPropagation={closeHandler}
		aria-label="Dismiss notification"
	>
		<XMark className="size-3" />
	</button>

	<button
		type="button"
		class="shrink-0 self-top -translate-y-0.5"
		on:click={(e: MouseEvent): void => {
			// Keyboard activation is native; pointer gestures use the root threshold.
			if (e.detail === 0) clickHandler();
		}}
		aria-label={title || 'Open notification'}
	>
		<img src="{WEBUI_BASE_URL}/static/favicon.svg" alt="favicon" class="size-6 rounded-full" />
	</button>

	<div>
		{#if title}
			<div class=" text-[13px] font-normal mb-0.5 line-clamp-1">{title}</div>
		{/if}

		<div
			class=" line-clamp-2 text-xs self-center dark:text-gray-300 font-normal"
			use:sanitizedHtml={marked.parse(DOMPurify.sanitize(content, { ALLOWED_TAGS: [] }), {
				async: false
			})}
		></div>
	</div>
</div>
