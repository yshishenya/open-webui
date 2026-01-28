<script lang="ts">
	import DOMPurify from 'dompurify';

	import { onDestroy } from 'svelte';

	import tippy from 'tippy.js';
	import type { Instance, Placement, Props } from 'tippy.js';

	export let elementId = '';

	export let as = 'div';
	export let className = 'flex';

	export let placement: Placement = 'top';
	export let content = `I'm a tooltip!`;
	export let touch: Props['touch'] = true;
	export let theme = '';
	export let offset: [number, number] = [0, 4];
	export let allowHTML: Props['allowHTML'] = true;
	export let tippyOptions: Partial<Props> = {};
	export let interactive = false;

	export let onClick = () => {};

	let tooltipElement: HTMLElement | null = null;
	let tooltipInstance: Instance | null = null;

	$: if (tooltipElement && (content || elementId)) {
		let tooltipContent: string | Element | null = null;

		if (elementId) {
			tooltipContent = document.getElementById(`${elementId}`);
		} else {
			tooltipContent = DOMPurify.sanitize(content);
		}

		if (tooltipInstance) {
			tooltipInstance.setContent(tooltipContent ?? '');
		} else {
			if (content) {
				tooltipInstance = tippy(tooltipElement, {
					content: tooltipContent ?? '',
					placement,
					allowHTML,
					touch,
					...(theme !== '' ? { theme } : { theme: 'dark' }),
					arrow: false,
					offset,
					...(interactive ? { interactive: true } : {}),
					...tippyOptions
				});
			}
		}
	} else if (tooltipInstance && content === '') {
		if (tooltipInstance) {
			tooltipInstance.destroy();
		}
	}

	onDestroy(() => {
		if (tooltipInstance) {
			tooltipInstance.destroy();
		}
	});
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<svelte:element this={as} bind:this={tooltipElement} class={className} on:click={onClick}>
	<slot />
</svelte:element>

<slot name="tooltip"></slot>
