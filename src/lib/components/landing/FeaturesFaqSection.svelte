<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';

	export type FeatureFaqItem = {
		id: string;
		question: string;
		answer: string;
		open?: boolean;
	};

	export let items: FeatureFaqItem[] = [];

	const handleToggle = (event: Event, questionId: string) => {
		const target = event.currentTarget;
		if (target instanceof HTMLDetailsElement && target.open) {
			trackEvent('features_faq_open', { question_id: questionId });
		}
	};
</script>

<div class="space-y-4">
	{#each items as item}
		<details
			class="features-card features-card--soft p-6 group"
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
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
					></path>
				</svg>
			</summary>
			<p class="mt-4 text-sm text-gray-600 whitespace-pre-line">{item.answer}</p>
		</details>
	{/each}
</div>
