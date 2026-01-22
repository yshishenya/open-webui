<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';
	import TopUpAmountsInline from './TopUpAmountsInline.svelte';

	export type FaqItem = {
		id: string;
		question: string;
		answer: string;
		open?: boolean;
		includeTopups?: boolean;
	};

	export let items: FaqItem[] = [];
	export let topUpAmounts: number[] = [];

	const handleToggle = (event: Event, questionId: string): void => {
		const target = event.currentTarget;
		if (target instanceof HTMLDetailsElement && target.open) {
			trackEvent('pricing_faq_open', { question_id: questionId });
		}
	};
</script>

<div class="space-y-4">
	{#each items as item}
		<details
			class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm group"
			open={item.open}
			on:toggle={(event) => handleToggle(event, item.id)}
		>
			<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
				{item.question}
				<svg
					class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
				</svg>
			</summary>
			<div class="mt-4 space-y-3 text-gray-600 text-sm">
				<p>{item.answer}</p>
				{#if item.includeTopups}
					{#if topUpAmounts.length}
						<TopUpAmountsInline amountsRub={topUpAmounts} variant="block" />
					{:else}
						<p class="text-xs text-gray-500">Суммы пополнения временно недоступны.</p>
					{/if}
				{/if}
			</div>
		</details>
	{/each}
</div>
