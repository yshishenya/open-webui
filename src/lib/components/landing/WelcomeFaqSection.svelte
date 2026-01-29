<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';
	import SectionHeader from './SectionHeader.svelte';
	import { openCta } from './welcomeNavigation';
	import { faqItems } from './welcomeData';
	import type { FaqItem } from './welcomeData';

	const handleFaqToggle = (event: Event, questionId: string) => {
		const target = event.currentTarget;
		if (target instanceof HTMLDetailsElement && target.open) {
			trackEvent('welcome_faq_open', { question_id: questionId });
		}
	};

	const handleFaqCtaClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('welcome_faq_cta_click');
		openCta('welcome_faq_cta');
	};

	const isCostQuestion = (item: FaqItem): boolean => item.id === 'text_volume';
</script>

<section id="faq" class="welcome-section welcome-section--divider">
	<div class="mx-auto max-w-[1200px] px-4">
		<SectionHeader eyebrow="FAQ" title="FAQ" subtitle="Короткие ответы на частые вопросы." />

		<div class="mt-8 max-w-3xl space-y-4">
			{#each faqItems as item}
				<details
					class="welcome-card welcome-card--flat p-6 group"
					open={item.open}
					id={isCostQuestion(item) ? 'faq-cost' : undefined}
					on:toggle={(event) => handleFaqToggle(event, item.id)}
				>
					<summary
						class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center"
					>
						{item.question}
						<svg
							class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						{item.answer}
					</p>
				</details>
			{/each}
		</div>

		<div class="mt-8">
			<a
				href="/signup?src=welcome_faq_cta"
				class="inline-flex items-center justify-center rounded-full bg-black px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900"
				on:click={handleFaqCtaClick}
			>
				Начать бесплатно
			</a>
		</div>
	</div>
</section>
