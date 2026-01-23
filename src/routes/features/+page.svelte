<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores';
	import { trackEvent } from '$lib/utils/analytics';
	import { getPublicLeadMagnetConfig, getPublicRateCards } from '$lib/apis/billing';
	import type { PublicLeadMagnetConfig, PublicRateCardResponse } from '$lib/apis/billing';
	import { CTASection, PublicPageLayout } from '$lib/components/landing';
	import SectionHeader from '$lib/components/landing/SectionHeader.svelte';
	import FeaturesPresetGrid from '$lib/components/landing/FeaturesPresetGrid.svelte';
	import FeaturesTabs from '$lib/components/landing/FeaturesTabs.svelte';
	import FeaturesModelsSection from '$lib/components/landing/FeaturesModelsSection.svelte';
	import FeaturesFaqSection from '$lib/components/landing/FeaturesFaqSection.svelte';
	import FeaturesStickyCta from '$lib/components/landing/FeaturesStickyCta.svelte';
	import { featurePageConfig, featurePresetsById } from '$lib/data/features';
	import type { FeaturePreset } from '$lib/data/features';
	import type { FeatureFaqItem } from '$lib/components/landing/FeaturesFaqSection.svelte';
	import { buildChatUrl, buildSignupUrl, openCta, openPreset } from '$lib/components/landing/welcomeNavigation';

	const heroImage = '/landing/airis-hero.webp';
	const heroImage2x = '/landing/airis-hero@2x.webp';
	const heroImageFallback = '/landing/airis-hero.png';
	const heroImageFallback2x = '/landing/airis-hero@2x.png';
	const heroImageWidth = 1200;
	const heroImageHeight = 697;

	let rateCard: PublicRateCardResponse | null = null;
	let leadMagnetConfig: PublicLeadMagnetConfig | null = null;
	let modelsLoading = true;
	let modelsError: string | null = null;

	const resolveAudioEnabled = (
		config: PublicLeadMagnetConfig | null,
		rateCardData: PublicRateCardResponse | null
	): boolean => {
		if (config) {
			const { tts_seconds, stt_seconds } = config.quotas;
			return tts_seconds > 0 || stt_seconds > 0;
		}
		return rateCardData?.models?.some((model) => model.capabilities.includes('audio')) ?? true;
	};

	onMount(async () => {
		modelsLoading = true;
		modelsError = null;
		try {
			const [rateCardResult, leadMagnetResult] = await Promise.all([
				getPublicRateCards(),
				getPublicLeadMagnetConfig()
			]);
			rateCard = rateCardResult;
			leadMagnetConfig = leadMagnetResult;
			if (!rateCardResult) {
				modelsError = 'Не удалось загрузить список моделей.';
			}
		} catch (error) {
			console.error('Failed to load models catalog:', error);
			modelsError = 'Не удалось загрузить список моделей.';
		} finally {
			modelsLoading = false;
		}
	});

	$: audioEnabled = resolveAudioEnabled(leadMagnetConfig, rateCard);

	$: examplePresets = featurePageConfig.examples.presetIds
		.map((presetId) => featurePresetsById[presetId])
		.filter(Boolean) as FeaturePreset[];

	$: visiblePresets = audioEnabled
		? examplePresets
		: examplePresets.filter((preset) => preset.category !== 'audio');

	$: visibleCategories = audioEnabled
		? featurePageConfig.examples.categories
		: featurePageConfig.examples.categories.filter((category) => category.id !== 'audio');

	$: visibleTabs = audioEnabled
		? featurePageConfig.featureTabs.tabs
		: featurePageConfig.featureTabs.tabs.filter((tab) => tab.id !== 'audio');

	$: modelBadges =
		rateCard?.models.map((model) => ({
			id: model.id,
			displayName: model.display_name,
			provider: model.provider,
			capabilities: model.capabilities
		})) ?? [];

	$: heroPrimaryLabel = $user
		? featurePageConfig.hero.primaryCtaLabelAuthed
		: featurePageConfig.hero.primaryCtaLabelGuest;

	$: heroPrimaryHref = $user
		? buildChatUrl('features_hero_primary')
		: buildSignupUrl('features_hero_primary');

	$: howCtaHref = $user
		? buildChatUrl('features_how_cta')
		: buildSignupUrl('features_how_cta');

	$: finalCtaLabel = $user
		? featurePageConfig.hero.primaryCtaLabelAuthed
		: featurePageConfig.hero.primaryCtaLabelGuest;

	const handleHeroPrimaryClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('features_hero_primary_click');
		openCta('features_hero_primary');
	};

	const handleHeroExamplesClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('features_hero_examples_click');
		document.getElementById('examples')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const handleTryPreset = (presetId: string, src: string) => {
		const preset = featurePresetsById[presetId];
		if (!preset) return;
		openPreset(src, presetId, preset.prompt);
	};

	const handleHowCtaClick = (event: MouseEvent) => {
		event.preventDefault();
		openCta('features_how_cta');
	};

	const handlePricingLinkClick = () => {
		trackEvent('features_pricing_link_click');
	};

	const handleFinalCtaClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('features_final_cta_click');
		openCta('features_final_cta');
	};

	const faqItems: FeatureFaqItem[] = [
		{
			id: 'overview',
			question: 'Что можно делать в Airis?',
			answer:
				'Тексты, изображения, аудио и помощь с задачами. Вы пишете запрос своими словами, а Airis помогает получить результат.'
		},
		{
			id: 'vpn',
			question: 'Нужен ли VPN?',
			answer: 'Нет, Airis работает без VPN.'
		},
		{
			id: 'free_start',
			question: 'Можно ли начать бесплатно?',
			answer: 'Да, можно начать бесплатно без карты и проверить основные сценарии.'
		},
		{
			id: 'subscription',
			question: 'Это подписка?',
			answer:
				'Нет. Без подписки и ежемесячных платежей. Пополняете баланс, списания только за использование. История списаний в кабинете.',
			open: true
		},
		{
			id: 'blank_prompt',
			question: 'Как начать, если я не знаю, что писать?',
			answer: 'Выберите готовую задачу — мы подставим запрос в чат. Можно сразу отправить или отредактировать.'
		},
		{
			id: 'images',
			question: 'Можно ли генерировать изображения?',
			answer: 'Да, по описанию можно генерировать изображения и получать несколько вариантов.'
		},
		{
			id: 'audio',
			question: 'Есть ли аудио (распознавание/озвучка)?',
			answer: 'Да, доступно распознавание речи и озвучка текста.'
		},
		{
			id: 'models',
			question: 'Как выбрать модель?',
			answer: 'Можно не выбирать: просто пишите задачу. Если хотите — выберите модель вручную.'
		}
	];

	$: visibleFaqItems = audioEnabled
		? faqItems
		: faqItems.filter((item) => item.id !== 'audio');
</script>

<PublicPageLayout
	title="Возможности"
	description="Возможности Airis: тексты, изображения, аудио и данные в одном чате, без VPN и без подписки."
	showHero={false}
>
	<section class="relative overflow-hidden bg-[radial-gradient(1200px_600px_at_15%_-10%,rgba(0,0,0,0.05),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(0,0,0,0.04),transparent),linear-gradient(180deg,#f7f7f8_0%,#ffffff_70%)]">
		<div class="mx-auto max-w-[1200px] px-4 pt-12 md:pt-16 pb-12 md:pb-16">
			<div class="relative isolate">
				<div aria-hidden="true" class="pointer-events-none -z-10 absolute inset-0">
					<div class="absolute -top-24 -right-32 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.12),transparent_70%)]"></div>
					<div class="absolute -left-16 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_70%)]"></div>
				</div>
				<div class="relative z-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center motion-safe:animate-[fade-up_0.7s_ease]">
					<div class="space-y-6">
						<span class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[12px] font-medium text-gray-600">
							{featurePageConfig.hero.eyebrow}
						</span>
						<h1 class="text-[32px] md:text-[40px] xl:text-[48px] font-bold tracking-tight text-gray-900 leading-[1.08]">
							{featurePageConfig.hero.title}
						</h1>
						<p class="text-[15px] md:text-[16px] font-medium leading-[1.5] text-gray-600 max-w-xl">
							{featurePageConfig.hero.lead}
						</p>
						<div class="flex flex-col sm:flex-row gap-3">
							<a
								href={heroPrimaryHref}
								class="inline-flex items-center justify-center h-11 md:h-10 px-6 rounded-full bg-black text-white text-sm font-semibold hover:bg-gray-900 transition-colors w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
								on:click={handleHeroPrimaryClick}
							>
								{heroPrimaryLabel}
							</a>
							<a
								href={featurePageConfig.hero.secondaryCtaAnchor}
								class="inline-flex items-center justify-center h-11 md:h-10 px-6 rounded-full border border-gray-300 text-gray-700 text-sm font-semibold hover:border-gray-400 hover:text-gray-900 transition-colors w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
								on:click={handleHeroExamplesClick}
							>
								{featurePageConfig.hero.secondaryCtaLabel}
							</a>
						</div>
						<div class="text-[12px] font-medium text-gray-500">
							{featurePageConfig.hero.microcopy}
						</div>
						<div class="flex flex-wrap gap-2">
							{#each featurePageConfig.hero.chips as chip}
								<div class="rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[12px] font-medium text-gray-700">
									{chip}
								</div>
							{/each}
						</div>
					</div>
					<div class="relative">
						<div class="relative rounded-[32px] border border-white/10 bg-[#0b0d12] px-4 pb-6 pt-5 shadow-[0_40px_80px_rgba(15,23,42,0.25)]">
							<div class="absolute inset-0 rounded-[32px] bg-[radial-gradient(70%_60%_at_50%_0%,rgba(255,255,255,0.08),rgba(0,0,0,0))]"></div>
							<div class="relative z-10 rounded-[26px] bg-[#0f1218] p-2 ring-1 ring-white/10">
								<picture>
									<source type="image/webp" srcset={`${heroImage} 1x, ${heroImage2x} 2x`} />
									<img
										src={heroImageFallback}
										srcset={`${heroImageFallback} 1x, ${heroImageFallback2x} 2x`}
										alt="Интерфейс Airis: пример чата"
										class="w-full rounded-[20px] border border-white/5 object-cover"
										loading="eager"
										decoding="async"
										fetchpriority="high"
										width={heroImageWidth}
										height={heroImageHeight}
									/>
								</picture>
							</div>
							<div class="absolute right-6 bottom-6 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs font-semibold text-white">
								Интерфейс Airis
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section id="examples" class="features-section features-section--soft">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader
				title={featurePageConfig.examples.title}
				subtitle={featurePageConfig.examples.subtitle}
			/>

			<div class="mt-8">
				<FeaturesPresetGrid
					presets={visiblePresets}
					categories={visibleCategories}
					source="features_examples"
					onTryPreset={handleTryPreset}
				/>
			</div>

			<p class="mt-6 text-xs font-medium text-gray-500">
				Можно начать бесплатно без карты.
			</p>
		</div>
	</section>

	<section id="capabilities" class="features-section">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader
				title={featurePageConfig.featureTabs.title}
				subtitle={featurePageConfig.featureTabs.subtitle}
			/>

			<div class="mt-8">
				<FeaturesTabs tabs={visibleTabs} presetsById={featurePresetsById} onTryPreset={handleTryPreset} />
			</div>
		</div>
	</section>

	<section id="how" class="features-section features-section--soft">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader
				title={featurePageConfig.how.title}
				subtitle={featurePageConfig.how.subtitle}
			/>

			<div class="mt-8 grid gap-6 md:grid-cols-3">
				{#each featurePageConfig.how.steps as step, index}
					<div class="features-card features-card--flat p-6">
						<div class="text-3xl font-semibold text-gray-900 mb-3">0{index + 1}</div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
						<p class="text-sm text-gray-600 leading-relaxed">{step.text}</p>
					</div>
				{/each}
			</div>

			<div class="mt-8 features-card features-card--flat flex flex-col gap-4 p-6">
				<p class="text-sm text-gray-700">{featurePageConfig.how.callout}</p>
				<a
					href={howCtaHref}
					class="inline-flex items-center justify-center rounded-full bg-black px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900 self-start"
					on:click={handleHowCtaClick}
				>
					Начать бесплатно
				</a>
			</div>
		</div>
	</section>

	<section id="models" class="features-section">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader title={featurePageConfig.models.title} subtitle={featurePageConfig.models.subtitle} />

			<div class="mt-8">
				<FeaturesModelsSection
					models={modelBadges}
					maxVisible={featurePageConfig.models.maxVisible}
					loading={modelsLoading}
					error={modelsError}
				/>
			</div>
		</div>
	</section>

	<section id="control" class="features-section features-section--soft">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader title={featurePageConfig.control.title} />

			<div class="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
				{#each featurePageConfig.control.cards as card}
					<div class="features-card features-card--soft p-6">
						<h3 class="text-base font-semibold text-gray-900">{card.title}</h3>
						<p class="mt-2 text-sm text-gray-600">{card.text}</p>
					</div>
				{/each}
			</div>

			<div class="mt-6">
				<a
					href={featurePageConfig.control.pricingLinkHref}
					class="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
					on:click={handlePricingLinkClick}
				>
					{featurePageConfig.control.pricingLinkLabel}
					<span aria-hidden="true">→</span>
				</a>
			</div>
		</div>
	</section>

	<section id="faq" class="features-section">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader title="Часто задаваемые вопросы" />

			<div class="mt-8 max-w-3xl">
				<FeaturesFaqSection items={visibleFaqItems} />
			</div>
		</div>
	</section>

	<section id="cta" class="features-section features-section--cta">
		<div class="mx-auto max-w-[1200px] px-4">
			<CTASection
				title="Готовы попробовать?"
				description="Начните бесплатно без карты. Без VPN. Без подписки — списания только за использование."
				buttonText={finalCtaLabel}
				onClick={handleFinalCtaClick}
				tone="dark"
			/>
		</div>
	</section>

	<FeaturesStickyCta labelGuest={featurePageConfig.hero.primaryCtaLabelGuest} labelAuthed={featurePageConfig.hero.primaryCtaLabelAuthed} />
</PublicPageLayout>

<style>
	:global(:root) {
		--features-section-y-desktop: 88px;
		--features-section-y-tablet: 72px;
		--features-section-y-mobile: 56px;
		--features-bg-soft: #f7f7f8;
		--features-border: #e7e7ea;
		--features-shadow-sm: 0 12px 24px rgba(15, 23, 42, 0.08);
		--features-shadow-md: 0 16px 32px rgba(15, 23, 42, 0.12);
	}

	:global(.features-section) {
		padding-block: var(--features-section-y-desktop);
	}

	:global(.features-section--soft) {
		background: var(--features-bg-soft);
	}

	:global(.features-section--cta) {
		padding-block: 64px;
		background: #0b0d12;
	}

	:global(.features-card) {
		background: #ffffff;
		border: 1px solid var(--features-border);
		border-radius: 16px;
		transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
	}

	:global(.features-card--soft) {
		box-shadow: var(--features-shadow-sm);
	}

	:global(.features-card--flat) {
		box-shadow: none;
	}

	:global(.features-card--clickable) {
		cursor: pointer;
	}

	@media (hover: hover) {
		:global(.features-card--clickable:hover) {
			transform: translateY(-2px);
			box-shadow: var(--features-shadow-md);
		}
	}

	:global(section[id]) {
		scroll-margin-top: 88px;
	}

	@media (max-width: 1023px) {
		:global(.features-section) {
			padding-block: var(--features-section-y-tablet);
		}
	}

	@media (max-width: 767px) {
		:global(.features-section) {
			padding-block: var(--features-section-y-mobile);
		}

		:global(section[id]) {
			scroll-margin-top: 72px;
		}
	}
</style>
