<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';
	import SectionHeader from './SectionHeader.svelte';
	import { openCta } from './welcomeNavigation';
	import { steps } from './welcomeData';

	const handleHowCtaClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('welcome_how_cta_click');
		openCta('welcome_how_cta');
	};
</script>

<section id="how" class="welcome-section">
	<div class="mx-auto max-w-[1200px] px-4">
		<SectionHeader
			eyebrow="КАК ЭТО РАБОТАЕТ"
			title="Три шага до результата"
			subtitle="Как в обычном диалоге — без лишних настроек."
		/>

		<div class="mt-8 grid gap-6 md:grid-cols-3">
			{#each steps as step, index}
				<div class="welcome-card welcome-card--flat p-6">
					<div class="text-3xl font-semibold text-gray-900 mb-3">
						0{index + 1}
					</div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
					<p class="text-sm text-gray-600 leading-relaxed">{step.description}</p>
				</div>
			{/each}
		</div>

		<div class="mt-8 welcome-card welcome-card--flat flex flex-col gap-4 p-6">
			<p class="text-sm text-gray-700">
				Начните бесплатно без карты. Если понадобится больше — пополняете баланс, и списания идут
				только за использование. Без подписки и ежемесячных платежей.
			</p>
			<a
				href="/signup?src=welcome_how_cta"
				class="inline-flex items-center justify-center rounded-full bg-black px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900 self-start"
				on:click={handleHowCtaClick}
			>
				Начать бесплатно
			</a>
		</div>
	</div>
</section>
