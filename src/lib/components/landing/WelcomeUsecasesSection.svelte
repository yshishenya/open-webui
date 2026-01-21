<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';
	import SectionHeader from './SectionHeader.svelte';
	import { openPreset } from './welcomeNavigation';
	import { useCases } from './welcomeData';
	import type { UseCase, UseCaseItem } from './welcomeData';

	const handleUseCaseItemClick = (useCase: UseCase, item: UseCaseItem) => {
		trackEvent('welcome_usecases_item_click', { usecase: useCase.id, preset: item.preset });
		openPreset('welcome_usecases', item.preset, item.prompt);
	};

	const handleUseCaseCtaClick = (event: MouseEvent, useCase: UseCase) => {
		event.preventDefault();
		trackEvent('welcome_usecases_cta_click', { usecase: useCase.id });
		openPreset('welcome_usecases', useCase.ctaPreset, useCase.ctaPrompt);
	};
</script>

<section id="usecases" class="welcome-section">
	<div class="mx-auto max-w-[1200px] px-4">
		<SectionHeader
			eyebrow="СЦЕНАРИИ"
			title="Сценарии использования"
			subtitle="Выберите сценарий — и начните с готового запроса."
		/>

		<div class="mt-8 grid gap-6 md:grid-cols-3">
			{#each useCases as useCase}
				<div class="welcome-card welcome-card--flat flex h-full flex-col gap-4 p-6">
					<h3 class="text-lg font-semibold text-gray-900">{useCase.title}</h3>
					<div class="space-y-3">
						{#each useCase.items as item}
							<button
								type="button"
								class="usecase-item"
								on:click={() => handleUseCaseItemClick(useCase, item)}
							>
								<span>{item.label}</span>
								<span aria-hidden="true">›</span>
							</button>
						{/each}
					</div>
					<button
						type="button"
						class="mt-auto inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 hover:text-gray-900"
						on:click={(event) => handleUseCaseCtaClick(event, useCase)}
					>
						{useCase.ctaLabel}
						<span aria-hidden="true">→</span>
					</button>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.usecase-item {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid var(--border);
		color: #4b5563;
		font-size: 14px;
		font-weight: 500;
		transition: border-color 0.18s ease, color 0.18s ease;
	}

	.usecase-item:hover {
		border-color: #cfd2d8;
		color: #111827;
	}
</style>
