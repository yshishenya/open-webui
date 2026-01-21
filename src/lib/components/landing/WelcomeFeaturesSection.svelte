<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';
	import SectionHeader from './SectionHeader.svelte';
	import { openPreset } from './welcomeNavigation';
	import { features } from './welcomeData';
	import type { FeatureCard } from './welcomeData';

	export let audioEnabled = true;

	let visibleFeatures = features;

	$: visibleFeatures = audioEnabled
		? features
		: features.filter((feature) => feature.id !== 'audio');

	const handleCardKeydown = (event: KeyboardEvent, action: () => void) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			action();
		}
	};

	const handleFeatureCardClick = (feature: FeatureCard) => {
		trackEvent('welcome_features_card_click', { feature_id: feature.id });
		openPreset('welcome_features', feature.preset, feature.prompt);
	};

	const handleFeatureTryClick = (event: MouseEvent, feature: FeatureCard) => {
		event.stopPropagation();
		trackEvent('welcome_features_try_click', { feature_id: feature.id });
		openPreset('welcome_features', feature.preset, feature.prompt);
	};
</script>

<section id="features" class="welcome-section welcome-section--soft">
	<div class="mx-auto max-w-[1200px] px-4">
		<SectionHeader
			eyebrow="ВОЗМОЖНОСТИ"
			title="Что можно делать в Airis"
			subtitle="Тексты, изображения, аудио и помощь с задачами — в одном месте."
		/>

		<div class="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
			{#each visibleFeatures as feature}
				<div
					class="welcome-card welcome-card--soft welcome-card--clickable flex h-full flex-col gap-4 p-6"
					role="button"
					tabindex="0"
					on:click={() => handleFeatureCardClick(feature)}
					on:keydown={(event) => handleCardKeydown(event, () => handleFeatureCardClick(feature))}
				>
					<div>
						<h3 class="text-lg font-semibold text-gray-900">{feature.title}</h3>
						<p class="mt-2 text-sm text-gray-600">{feature.description}</p>
					</div>
					<ul class="space-y-2 text-sm text-gray-600">
						{#each feature.examples as example}
							<li class="flex items-start gap-2">
								<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
								{example}
							</li>
						{/each}
					</ul>
					<button
						type="button"
						class="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900"
						on:click={(event) => handleFeatureTryClick(event, feature)}
					>
						Попробовать
						<span aria-hidden="true">→</span>
					</button>
				</div>
			{/each}
		</div>
	</div>
</section>
