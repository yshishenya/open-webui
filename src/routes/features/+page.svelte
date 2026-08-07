<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores';
	import { getPublicRateCards } from '$lib/apis/billing';
	import type { PublicRateCardResponse } from '$lib/apis/billing';
	import { PublicPageLayout } from '$lib/components/landing';
	import { featurePresets } from '$lib/data/features';
	import type { FeaturePreset } from '$lib/data/features';
	import { openCta, openPreset } from '$lib/components/landing/welcomeNavigation';
	import { trackEvent } from '$lib/utils/analytics';

	const heroImage = '/landing/airis-hero.webp';

	type TaskFilter = 'all' | 'work' | 'study' | 'text';

	const filterOptions: Array<{ id: TaskFilter; label: string }> = [
		{ id: 'all', label: 'Все задачи' },
		{ id: 'work', label: 'Работа' },
		{ id: 'study', label: 'Учёба' },
		{ id: 'text', label: 'Тексты' }
	];

	const preferredTaskIds = [
		'social_post',
		'email_reply',
		'resume',
		'product_desc',
		'summarize_notes',
		'study_explain'
	];

	let rateCard: PublicRateCardResponse | null = null;
	let loadingModels = true;
	let modelsError = false;
	let selectedFilter: TaskFilter = 'all';

	onMount(async () => {
		try {
			rateCard = await getPublicRateCards();
			modelsError = !rateCard;
		} catch (error) {
			console.error('Failed to load public feature capabilities:', error);
			modelsError = true;
		} finally {
			loadingModels = false;
		}
	});

	$: capabilities = new Set(rateCard?.models.flatMap((model) => model.capabilities) ?? ['text']);
	$: hasImage = capabilities.has('image');
	$: hasAudio = capabilities.has('audio');
	$: liveModels = rateCard?.models.slice(0, 5) ?? [];
	$: baseTasks = preferredTaskIds
		.map((id) => featurePresets.find((preset) => preset.id === id))
		.filter(Boolean) as FeaturePreset[];
	$: visibleTasks = baseTasks
		.filter((preset) => selectedFilter === 'all' || preset.category === selectedFilter)
		.slice(0, 4);

	const handleCta = (source: string): void => {
		trackEvent(source);
		openCta(source);
	};

	const handlePreset = (preset: FeaturePreset): void => {
		trackEvent('features_task_open', { preset: preset.id });
		openPreset('features_task', preset.id, preset.prompt);
	};

	const shortPrompt = (prompt: string): string => {
		const normalized = prompt.replace(/\s+/g, ' ').trim();
		return normalized.length > 120 ? `${normalized.slice(0, 117)}…` : normalized;
	};
</script>

<svelte:head>
	<title>Возможности — Airis</title>
	<meta
		name="description"
		content="Популярные AI-модели в одном чате: готовые задачи, тексты и работа без VPN."
	/>
</svelte:head>

<PublicPageLayout title="Возможности" breadcrumbLabel="Возможности">
	<section class="airis-public-simple-hero">
		<div
			class="container mx-auto grid items-center gap-10 px-4 py-14 md:py-20 lg:grid-cols-[1fr_0.9fr]"
		>
			<div class="max-w-2xl">
				<p class="airis-public-eyebrow">Возможности Airis</p>
				<h1 class="airis-public-display mt-5">AI-модели — в одном понятном чате</h1>
				<p class="airis-public-lead mt-6">
					Выберите готовую задачу или напишите свою. Airis работает в России без VPN, а доступные
					модели можно менять прямо в диалоге.
				</p>
				<div class="mt-8 flex flex-col gap-3 sm:flex-row">
					<button
						type="button"
						class="airis-public-btn-primary min-h-11 rounded-xl px-6"
						on:click={() => handleCta('features_hero_primary')}
					>
						{$user ? 'Открыть Airis' : 'Начать бесплатно'}
					</button>
					<a
						class="airis-public-btn-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-6"
						href="/pricing"
					>
						Посмотреть оплату
					</a>
				</div>
				<p class="mt-4 text-sm text-[var(--airis-muted)]">
					Без карты для старта · Оплата в ₽ · Без обязательной подписки
				</p>
			</div>

			<figure class="airis-public-product-shot">
				<img
					src={heroImage}
					alt="Реальный интерфейс чата Airis"
					width="1200"
					height="697"
					loading="eager"
				/>
				<figcaption>Реальный интерфейс Airis</figcaption>
			</figure>
		</div>
	</section>

	<section id="tasks" class="airis-public-section">
		<div class="container mx-auto px-4">
			<div class="max-w-2xl">
				<p class="airis-public-eyebrow">Старт без пустого поля</p>
				<h2 class="airis-public-section-title">Начните с готовой задачи</h2>
				<p class="airis-public-section-lead">
					Откройте пример, измените запрос под себя и продолжите в настоящем чате.
				</p>
			</div>

			<div class="mt-8 flex flex-wrap gap-2" role="group" aria-label="Фильтр задач">
				{#each filterOptions as option}
					<button
						type="button"
						class:airis-public-filter-active={selectedFilter === option.id}
						class="airis-public-filter min-h-11 rounded-xl px-4"
						aria-pressed={selectedFilter === option.id}
						on:click={() => (selectedFilter = option.id)}
					>
						{option.label}
					</button>
				{/each}
			</div>

			<div class="mt-6 grid gap-4 md:grid-cols-2">
				{#each visibleTasks as task}
					<article class="airis-public-card flex flex-col p-6">
						<div class="flex items-start justify-between gap-4">
							<div>
								<h3 class="text-xl font-semibold text-[var(--airis-ink)]">{task.title}</h3>
								<p class="mt-2 text-sm text-[var(--airis-muted)]">{task.result}</p>
							</div>
							<span class="airis-public-card-tag">Готовый запрос</span>
						</div>
						<p
							class="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-[var(--airis-muted-strong)]"
						>
							{shortPrompt(task.prompt)}
						</p>
						<button
							type="button"
							class="airis-public-text-button mt-5 min-h-11 self-start"
							on:click={() => handlePreset(task)}
						>
							Открыть в Airis <span aria-hidden="true">→</span>
						</button>
					</article>
				{:else}
					<p class="airis-public-empty md:col-span-2">
						Для этого фильтра пока нет готовых запросов.
					</p>
				{/each}
			</div>
		</div>
	</section>

	<section class="airis-public-section airis-public-section-muted">
		<div class="container mx-auto px-4">
			<div class="grid gap-5 md:grid-cols-3">
				<div class="airis-public-step">
					<span>01</span>
					<h3>Выберите задачу</h3>
					<p>Или напишите запрос своими словами.</p>
				</div>
				<div class="airis-public-step">
					<span>02</span>
					<h3>Получите черновик</h3>
					<p>Попросите сократить, уточнить или сделать другой вариант.</p>
				</div>
				<div class="airis-public-step">
					<span>03</span>
					<h3>Доведите результат</h3>
					<p>Продолжайте диалог, пока ответ не подойдёт.</p>
				</div>
			</div>
		</div>
	</section>

	<section id="models" class="airis-public-section">
		<div class="container mx-auto px-4">
			<div class="max-w-2xl">
				<p class="airis-public-eyebrow">Что доступно сейчас</p>
				<h2 class="airis-public-section-title">Выбирайте модель, когда это важно</h2>
				<p class="airis-public-section-lead">
					Не нужно разбираться в настройках. Но если хотите — модели доступны в одном списке.
				</p>
			</div>
			<div class="mt-8 grid gap-4 md:grid-cols-3">
				<div class="airis-public-card p-6">
					<h3>Без VPN</h3>
					<p>Открывайте Airis напрямую из России.</p>
				</div>
				<div class="airis-public-card p-6">
					<h3>Один интерфейс</h3>
					<p>Не переносите контекст между разными сервисами.</p>
				</div>
				<div class="airis-public-card p-6">
					<h3>Фактическое использование</h3>
					<p>Пополняйте баланс и контролируйте расходы в кабинете.</p>
				</div>
			</div>
			{#if loadingModels}
				<p class="mt-6 text-sm text-[var(--airis-muted)]">Загружаем список доступных моделей…</p>
			{:else if modelsError}
				<p class="mt-6 text-sm text-[var(--airis-muted)]">
					Список моделей временно недоступен. Актуальный список откроется в приложении.
				</p>
			{:else if liveModels.length}
				<div class="mt-8 flex flex-wrap gap-2" aria-label="Популярные доступные модели">
					{#each liveModels as model}
						<span class="airis-public-model-pill">{model.display_name}</span>
					{/each}
				</div>
			{/if}
			<p class="mt-4 text-xs text-[var(--airis-muted)]">
				Список и возможности моделей могут меняться.
			</p>
		</div>
	</section>

	<section id="faq" class="airis-public-section airis-public-section-muted">
		<div class="container mx-auto px-4">
			<div class="max-w-3xl">
				<p class="airis-public-eyebrow">Коротко</p>
				<h2 class="airis-public-section-title">Частые вопросы</h2>
				<div class="mt-6 divide-y divide-white/10">
					<details class="airis-public-details" open>
						<summary>Нужен ли VPN?</summary>
						<p>Нет. Airis работает без VPN.</p>
					</details>
					<details class="airis-public-details">
						<summary>Можно ли начать бесплатно?</summary>
						<p>
							Да, стартовые лимиты доступны без карты. Условия зависят от доступных моделей и квот.
						</p>
					</details>
					<details class="airis-public-details">
						<summary>Это подписка?</summary>
						<p>
							Обязательной подписки нет: баланс пополняется по необходимости, списания зависят от
							использования.
						</p>
					</details>
					<details class="airis-public-details">
						<summary>Доступны ли изображения и аудио?</summary>
						<p>
							{hasImage || hasAudio
								? 'Доступность зависит от выбранной модели и текущего каталога.'
								: 'Сейчас в публичном каталоге доступны текстовые модели. Актуальные возможности показываются в приложении.'}
						</p>
					</details>
				</div>
			</div>
		</div>
	</section>

	<section class="airis-public-section airis-public-section-cta">
		<div class="container mx-auto px-4 text-center">
			<h2 class="airis-public-section-title">Попробуйте на своей задаче</h2>
			<p class="mx-auto mt-4 max-w-xl text-[var(--airis-muted-strong)]">
				Начните с готового запроса или откройте пустой чат.
			</p>
			<button
				type="button"
				class="airis-public-btn-primary mt-7 min-h-11 rounded-xl px-7"
				on:click={() => handleCta('features_final_cta')}
			>
				{$user ? 'Открыть Airis' : 'Начать бесплатно'}
			</button>
		</div>
	</section>
</PublicPageLayout>
