<script lang="ts">
	import { onMount } from 'svelte';
	import { trackEvent } from '$lib/utils/analytics';

	export let amountsRub: number[] = [];
	export let variant: 'inline' | 'block' = 'inline';
	export let trackId: string | null = null;
	export let label: string = 'Суммы пополнения';
	export let tone: 'light' | 'dark' = 'light';

	let container: HTMLDivElement | null = null;

	const labelSizeClass = (): string => 'text-xs';

	const chipSizeClass = (): string =>
		variant === 'inline' ? 'text-[15px] md:text-base' : 'text-[15px] md:text-sm';

	const formatAmount = (amount: number): string => {
		try {
			return new Intl.NumberFormat('ru-RU').format(amount);
		} catch (error) {
			return amount.toString();
		}
	};

	onMount(() => {
		if (!trackId) return;
		if (!container || typeof IntersectionObserver === 'undefined') {
			trackEvent('pricing_topup_amounts_visible', { location: trackId });
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting) {
					trackEvent('pricing_topup_amounts_visible', { location: trackId });
					observer.disconnect();
				}
			},
			{ threshold: 0.4 }
		);

		observer.observe(container);

		return () => observer.disconnect();
	});
</script>

<div
	bind:this={container}
	class={variant === 'inline'
		? 'flex flex-wrap items-center gap-2'
		: 'flex flex-col gap-2'}
>
	<span
		class={`${labelSizeClass()} font-semibold uppercase tracking-[0.2em] ${
			tone === 'dark' ? 'text-gray-300' : 'text-gray-500'
		}`}
	>
		{label}
	</span>
	<div class="flex flex-wrap gap-2">
		{#each amountsRub as amount (amount)}
			<span
				class={`rounded-full border px-3 py-1 font-semibold tabular-nums ${chipSizeClass()} ${
					tone === 'dark'
						? 'border-white/20 bg-white text-gray-900'
						: 'border-gray-200 bg-white/80 text-gray-900'
				}`}
			>
				{formatAmount(amount)} ₽
			</span>
		{/each}
	</div>
</div>
