<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';

	import { flyAndScale } from '$lib/utils/transitions';
	import * as FocusTrap from 'focus-trap';
	export let show = true;
	export let size = 'md';
	export let containerClassName = 'p-3';
	export let className = 'bg-white dark:bg-gray-900 rounded-4xl';
	export let ariaLabel: string | undefined = undefined;

	let modalElement: HTMLElement | null = null;
	let portalElement: HTMLElement | null = null;
	// Create focus trap to trap user tabs inside modal
	// https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html
	// https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html
	let focusTrap: FocusTrap.FocusTrap | null = null;

	const sizeToWidth = (size: string) => {
		if (size === 'full') {
			return 'w-full';
		}
		if (size === 'xs') {
			return 'w-[16rem]';
		} else if (size === 'sm') {
			return 'w-[30rem]';
		} else if (size === 'md') {
			return 'w-[42rem]';
		} else if (size === 'lg') {
			return 'w-[56rem]';
		} else if (size === 'xl') {
			return 'w-[70rem]';
		} else if (size === '2xl') {
			return 'w-[84rem]';
		} else if (size === '3xl') {
			return 'w-[100rem]';
		} else {
			return 'w-[56rem]';
		}
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && isTopModal()) {
			show = false;
		}
	};

	const getEventTargetElement = (event: Event): Element | null => {
		const target = event.target;
		if (target instanceof Element) return target;
		return null;
	};

	const isTopModal = () => {
		const modals = document.getElementsByClassName('modal');
		return modals.length && modals[modals.length - 1] === modalElement;
	};

	let handleOutsidePointerDown: ((event: PointerEvent) => void) | null = null;
	let handleModalFocusIn: (() => void) | null = null;
	const cleanupModal = (): void => {
		const element = portalElement;
		if (!element) return;
		focusTrap?.deactivate();
		focusTrap = null;
		if (handleOutsidePointerDown)
			document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
		if (handleModalFocusIn) element.removeEventListener('focusin', handleModalFocusIn);
		window.removeEventListener('keydown', handleKeyDown);
		handleOutsidePointerDown = null;
		handleModalFocusIn = null;
		if (element.parentNode === document.body) document.body.removeChild(element);
		portalElement = null;
		if (!document.getElementsByClassName('modal').length) document.body.style.overflow = 'unset';
	};

	$: if (show && modalElement) {
		if (!portalElement) {
			portalElement = modalElement;
			document.body.appendChild(modalElement);
			focusTrap = FocusTrap.createFocusTrap(modalElement, {
				allowOutsideClick: (event: MouseEvent | TouchEvent) => {
					const target = getEventTargetElement(event);
					return (
						target !== null &&
						(target.closest('[data-sonner-toast]') !== null ||
							target.closest('.modal-content') === null)
					);
				}
			});
			focusTrap.activate();
			// Portaled dropdowns temporarily release the trap; returning focus restores it.
			handleOutsidePointerDown = (event: PointerEvent): void => {
				if (event.target instanceof Node && !portalElement?.contains(event.target))
					focusTrap?.pause();
			};
			handleModalFocusIn = (): void => {
				focusTrap?.unpause();
			};
			document.addEventListener('pointerdown', handleOutsidePointerDown, true);
			modalElement.addEventListener('focusin', handleModalFocusIn);
			window.addEventListener('keydown', handleKeyDown);
			document.body.style.overflow = 'hidden';
		}
	} else {
		cleanupModal();
	}

	onDestroy(cleanupModal);
</script>

{#if show}
	<div
		bind:this={modalElement}
		tabindex="-1"
		aria-modal="true"
		aria-label={ariaLabel}
		role="dialog"
		class="modal fixed top-0 right-0 left-0 bottom-0 bg-black/45 dark:bg-black/60 w-full h-screen max-h-[100dvh] {containerClassName}  flex justify-center z-9999 overflow-y-auto overscroll-contain"
		style="scrollbar-gutter: stable;"
		in:fade={{ duration: 10 }}
		on:mousedown={(event) => {
			if (event.target === event.currentTarget) show = false;
		}}
	>
		<div
			class="m-auto max-w-full {sizeToWidth(size)} {size !== 'full'
				? 'mx-2'
				: ''} shadow-3xl min-h-fit scrollbar-hidden {className} border border-white dark:border-gray-850"
			in:flyAndScale
		>
			<slot />
		</div>
	</div>
{/if}

<style>
	.modal-content {
		animation: scaleUp 0.1s ease-out forwards;
	}

	@keyframes scaleUp {
		from {
			transform: scale(0.985);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
