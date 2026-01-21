<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';
	import SectionHeader from './SectionHeader.svelte';
	import { openPreset } from './welcomeNavigation';
	import { exampleTabs } from './welcomeData';
	import type { ExampleCard } from './welcomeData';

	export let audioEnabled = true;

	let activeTabId = '';
	let activeExamplesTab = exampleTabs[0]!;
	let fallbackTab = exampleTabs[0]!;
	let visibleExampleTabs = exampleTabs;
	let showAllExamples = false;

	$: visibleExampleTabs = audioEnabled
		? exampleTabs
		: exampleTabs.filter((tab) => tab.id !== 'audio');

	$: fallbackTab = visibleExampleTabs[0] ?? exampleTabs[0]!;

	$: if (!activeTabId || !visibleExampleTabs.some((tab) => tab.id === activeTabId)) {
		activeTabId = fallbackTab.id;
	}

	$: activeExamplesTab =
		visibleExampleTabs.find((tab) => tab.id === activeTabId) ?? fallbackTab;

	const handleCardKeydown = (event: KeyboardEvent, action: () => void) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			action();
		}
	};

	const handleExampleTabChange = (tabId: string) => {
		activeTabId = tabId;
		showAllExamples = false;
	};

	const handleExampleCardClick = (card: ExampleCard) => {
		trackEvent('welcome_examples_card_click', { preset: card.preset, tab: activeExamplesTab.id });
		openPreset('welcome_examples', card.preset, card.prompt);
	};

	const handleExampleTryClick = (event: MouseEvent, card: ExampleCard) => {
		event.stopPropagation();
		trackEvent('welcome_examples_try_click', { preset: card.preset, tab: activeExamplesTab.id });
		openPreset('welcome_examples', card.preset, card.prompt);
	};
</script>

<section id="examples" class="welcome-section welcome-section--soft">
	<div class="mx-auto max-w-[1200px] px-4">
		<SectionHeader
			eyebrow="ПРИМЕРЫ"
			title="Примеры задач — попробуйте в 1 клик"
			subtitle="Выберите задачу, и мы подставим готовый запрос в чат."
		/>

		<div class="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Категории примеров">
			{#each visibleExampleTabs as tab}
				<button
					type="button"
					role="tab"
					id={`examples-tab-${tab.id}`}
					aria-selected={activeTabId === tab.id}
					aria-controls={`examples-panel-${tab.id}`}
					tabindex={activeTabId === tab.id ? 0 : -1}
					class={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
						activeTabId === tab.id
							? 'border-gray-900 bg-gray-900 text-white'
							: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
					}`}
					on:click={() => handleExampleTabChange(tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<div
			class="example-grid mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
			data-show-all={showAllExamples}
			role="tabpanel"
			id={`examples-panel-${activeExamplesTab.id}`}
			aria-labelledby={`examples-tab-${activeExamplesTab.id}`}
			tabindex="0"
		>
			{#each activeExamplesTab.cards as card, index}
				<div
					class="welcome-card welcome-card--soft welcome-card--clickable example-card flex h-full flex-col gap-4 p-6"
					data-index={index}
					role="button"
					tabindex="0"
					on:click={() => handleExampleCardClick(card)}
					on:keydown={(event) => handleCardKeydown(event, () => handleExampleCardClick(card))}
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<h3 class="text-base font-semibold text-gray-900">{card.title}</h3>
							<p class="mt-1 text-sm text-gray-600 break-words">{card.result}</p>
						</div>
						<span class="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 shrink-0 whitespace-nowrap">
							{card.badge}
						</span>
					</div>
					<button
						type="button"
						class="mt-auto inline-flex w-fit items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
						on:click={(event) => handleExampleTryClick(event, card)}
					>
						Попробовать
					</button>
				</div>
			{/each}
		</div>

		{#if activeExamplesTab.cards.length > 3}
			<div class="mt-6 flex md:hidden">
				<button
					type="button"
					class="inline-flex items-center gap-2 text-sm font-semibold text-gray-700"
					on:click={() => (showAllExamples = !showAllExamples)}
				>
					{showAllExamples ? 'Скрыть' : 'Показать ещё'}
					<span class="text-lg">→</span>
				</button>
			</div>
		{/if}

		<p class="mt-6 text-xs font-medium text-gray-500">
			Без VPN • Оплата в ₽ • Старт бесплатно без карты
		</p>
	</div>
</section>

<style>
	@media (max-width: 767px) {
		.example-grid[data-show-all='false'] .example-card[data-index]:nth-child(n + 4) {
			display: none;
		}
	}
</style>
