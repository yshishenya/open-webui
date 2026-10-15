<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	const dispatch = createEventDispatcher();

	let loaderElement: HTMLElement;

	let observer: IntersectionObserver | undefined;
	let intervalId: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					// A repeated visibility notification must replace the previous timer.
					clearInterval(intervalId);
					if (entry.isIntersecting) {
						intervalId = setInterval(() => {
							dispatch('visible');
						}, 100);
					}
				});
			},
			{
				root: null, // viewport
				rootMargin: '0px',
				threshold: 0.1 // When 10% of the loader is visible
			}
		);

		observer.observe(loaderElement);
	});

	onDestroy(() => {
		if (observer) {
			observer.disconnect();
		}

		clearInterval(intervalId);
	});
</script>

<div bind:this={loaderElement}>
	<slot />
</div>
