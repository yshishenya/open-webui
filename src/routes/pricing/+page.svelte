<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { PublicPageLayout } from '$lib/components/landing';
	import SectionHeader from '$lib/components/landing/SectionHeader.svelte';
	import Estimator from '$lib/components/pricing/Estimator.svelte';
	import RatesTable from '$lib/components/pricing/RatesTable.svelte';
	import TopUpAmountsInline from '$lib/components/pricing/TopUpAmountsInline.svelte';
	import FaqAccordion from '$lib/components/pricing/FaqAccordion.svelte';
	import pricingEstimatorConfig from '$lib/data/pricing-estimator.json';
	import { trackEvent } from '$lib/utils/analytics';
	import { user } from '$lib/stores';
	import {
		getPublicLeadMagnetConfig,
		getPublicPricingConfig,
		getPublicRateCards
	} from '$lib/apis/billing';
	import type {
		PublicLeadMagnetConfig,
		PublicPricingConfig,
		PublicRateCardResponse
	} from '$lib/apis/billing';
	import type { PricingEstimatorConfig } from '$lib/components/pricing/Estimator.svelte';
	import type { FaqItem } from '$lib/components/pricing/FaqAccordion.svelte';

	const estimatorConfig = pricingEstimatorConfig as PricingEstimatorConfig;

	let rateCard: PublicRateCardResponse | null = null;
	let leadMagnetConfig: PublicLeadMagnetConfig | null = null;
	let pricingConfig: PublicPricingConfig | null = null;
	let loadingRates = true;
	let ratesError: string | null = null;

	const formatNumber = (value: number): string => {
		try {
			return new Intl.NumberFormat('ru-RU').format(value);
		} catch (error) {
			return value.toString();
		}
	};

	const buildChatTarget = (source: string): string => `/?src=${source}`;

	const buildBalanceTarget = (source: string): string => `/billing/balance?src=${source}`;

	const buildSignupTarget = (source: string, redirectTarget: string): string => {
		const params = new URLSearchParams({ redirect: redirectTarget, src: source });
		return `/signup?${params.toString()}`;
	};

	const buildAuthTarget = (source: string, redirectTarget: string): string => {
		const params = new URLSearchParams({ redirect: redirectTarget, src: source });
		return `/auth?${params.toString()}`;
	};

	const handleHeroPrimary = (event: MouseEvent): void => {
		event.preventDefault();
		trackEvent('pricing_hero_primary_click');
		if ($user) {
			goto(buildBalanceTarget('pricing_hero_primary'));
			return;
		}
		goto(buildSignupTarget('pricing_hero_primary', buildChatTarget('pricing_hero_primary')));
	};

	const handleHeroSecondary = (event: MouseEvent): void => {
		event.preventDefault();
		trackEvent('pricing_hero_secondary_click');
		if ($user) {
			goto(buildChatTarget('pricing_hero_secondary'));
			return;
		}
		goto(buildAuthTarget('pricing_hero_secondary', buildBalanceTarget('pricing_hero_secondary')));
	};

	const handleFinalCta = (event: MouseEvent): void => {
		event.preventDefault();
		trackEvent('pricing_final_cta_click');
		if ($user) {
			goto(buildBalanceTarget('pricing_final_cta'));
			return;
		}
		goto(buildSignupTarget('pricing_final_cta', buildChatTarget('pricing_final_cta')));
	};

	const handleEstimatorPrimary = (): void => {
		if ($user) {
			goto(buildBalanceTarget('pricing_estimator_primary'));
			return;
		}
		goto(
			buildSignupTarget('pricing_estimator_primary', buildChatTarget('pricing_estimator_primary'))
		);
	};

	const handleFreeStartCta = (event: MouseEvent): void => {
		event.preventDefault();
		if ($user) {
			goto(buildChatTarget('pricing_free_start'));
			return;
		}
		goto(buildSignupTarget('pricing_free_start', buildChatTarget('pricing_free_start')));
	};

	const scrollToCalculation = (): void => {
		const target = document.getElementById('calculation');
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const buildFreeLimits = (
		config: PublicPricingConfig | null,
		leadMagnet: PublicLeadMagnetConfig | null
	): {
		text_in: number;
		text_out: number;
		images: number;
		tts_minutes: number;
		stt_minutes: number;
	} | null => {
		if (config?.free_limits) return config.free_limits;
		if (!leadMagnet?.quotas) return null;
		return {
			text_in: leadMagnet.quotas.tokens_input,
			text_out: leadMagnet.quotas.tokens_output,
			images: leadMagnet.quotas.images,
			tts_minutes: Math.floor(leadMagnet.quotas.tts_seconds / 60),
			stt_minutes: Math.floor(leadMagnet.quotas.stt_seconds / 60)
		};
	};

	onMount(async () => {
		loadingRates = true;
		ratesError = null;
		try {
			const [rateCardResult, leadMagnetResult, pricingConfigResult] = await Promise.all([
				getPublicRateCards(),
				getPublicLeadMagnetConfig(),
				getPublicPricingConfig()
			]);
			rateCard = rateCardResult;
			leadMagnetConfig = leadMagnetResult;
			pricingConfig = pricingConfigResult;
			if (!rateCardResult) {
				ratesError = 'Ставки временно недоступны. Попробуйте обновить страницу.';
			}
		} catch (error) {
			console.error('Failed to load pricing data:', error);
			ratesError = 'Ставки временно недоступны. Попробуйте обновить страницу.';
		} finally {
			loadingRates = false;
		}
	});

	$: topupAmounts = pricingConfig?.topup_amounts_rub ?? [];
	$: hasTopupAmounts = topupAmounts.length > 0;

	$: popularModelIds = pricingConfig?.popular_model_ids ?? [];
	$: recommendedModelIdByType = pricingConfig?.recommended_model_ids ?? {};
	$: cycleDays = leadMagnetConfig?.cycle_days ?? 30;
	$: freeLimits = buildFreeLimits(pricingConfig, leadMagnetConfig);

	$: freeLimitItems = freeLimits
		? [
				{ label: 'Текст (ваши сообщения)', value: freeLimits.text_in, suffix: '' },
				{ label: 'Текст (ответы)', value: freeLimits.text_out, suffix: '' },
				{ label: 'Изображения', value: freeLimits.images, suffix: '' },
				{ label: 'Озвучка текста', value: freeLimits.tts_minutes, suffix: ' мин' },
				{ label: 'Распознавание речи', value: freeLimits.stt_minutes, suffix: ' мин' }
			].filter((item) => item.value > 0)
		: [];

	const faqItems: FaqItem[] = [
		{
			id: 'subscription',
			question: 'Это подписка?',
			answer:
				'Нет, подписки нет. Вы пополняете баланс, и списания происходят только за использование.',
			open: true
		},
		{
			id: 'usage',
			question: 'Как работает оплата по использованию?',
			answer:
				'Вы пополняете баланс, а списания идут только за использование текстов, изображений и аудио.'
		},
		{
			id: 'topup',
			question: 'Какие суммы пополнения доступны?',
			answer: 'Доступны фиксированные суммы пополнения.',
			includeTopups: true
		},
		{
			id: 'free',
			question: 'Есть ли бесплатный доступ?',
			answer: 'Да, можно начать бесплатно без карты в пределах лимитов.'
		},
		{
			id: 'balance',
			question: 'Что будет, если баланс закончится?',
			answer:
				'Вы сможете пополнить баланс и продолжить работу. История списаний доступна в личном кабинете.'
		},
		{
			id: 'history',
			question: 'Где смотреть историю списаний?',
			answer: 'История списаний отображается в личном кабинете.'
		},
		{
			id: 'vpn',
			question: 'Нужен ли VPN?',
			answer: 'Нет, сервис работает без VPN.'
		},
		{
			id: 'io',
			question: 'Что значит “ввод/ответ” в ставках?',
			answer: 'Ввод — это ваш запрос, ответ — текст модели. Стоимость зависит от объёма каждого.'
		}
	];
</script>

<PublicPageLayout
	title="Тарифы"
	description="Прозрачные тарифы AIris: пополнение баланса, списания только за использование и бесплатный старт."
	showHero={false}
>
	<section class="relative overflow-hidden">
		<div
			class="absolute -top-20 -right-32 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.12),transparent_70%)]"
		></div>
		<div
			class="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_70%)]"
		></div>
		<div class="container mx-auto px-4 pt-14 pb-16 relative">
			<div class="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
				<div class="space-y-6">
					<span
						class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600"
					>
						ТАРИФЫ
					</span>
					<h1
						class="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.05]"
					>
						Оплата по использованию — без подписки
					</h1>
					<p class="text-lg md:text-xl text-gray-600 max-w-xl leading-relaxed">
						Пополняете баланс и пользуетесь текстами, изображениями и аудио. Списания происходят
						только когда вы используете сервис. Без подписки и ежемесячных платежей.
					</p>
					<div class="flex flex-wrap gap-3">
						<a
							href={$user ? '/billing/balance' : '/signup'}
							class="bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-900 transition-colors"
							on:click={handleHeroPrimary}
						>
							{$user ? 'Пополнить баланс' : 'Начать бесплатно'}
						</a>
						<a
							href={$user ? '/' : '/auth'}
							class="px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-semibold hover:border-gray-400 hover:text-gray-900 transition-colors"
							on:click={handleHeroSecondary}
						>
							{$user ? 'Перейти в чат' : 'Пополнить баланс'}
						</a>
					</div>
					<div class="space-y-2">
						{#if hasTopupAmounts}
							<TopUpAmountsInline amountsRub={topupAmounts} variant="inline" trackId="hero" />
						{:else}
							<div class="text-xs text-gray-500">Суммы пополнения временно недоступны.</div>
						{/if}
						{#if !$user}
							<div class="text-[12px] font-medium text-gray-500">
								Начать можно бесплатно — без карты.
							</div>
						{/if}
					</div>
					<div class="flex flex-wrap gap-2">
						{#each ['Без VPN', 'Оплата в ₽', 'Без подписки и ежемесячных платежей', 'Списания только за использование', 'История списаний в личном кабинете'] as item}
							<div
								class="rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-xs font-semibold text-gray-700"
							>
								{item}
							</div>
						{/each}
					</div>
				</div>

				<div class="rounded-[32px] border border-gray-200/70 bg-white/90 p-6 shadow-sm space-y-4">
					<h3 class="text-xl font-semibold text-gray-900">Как устроена оплата</h3>
					<ul class="space-y-3 text-sm text-gray-700">
						<li class="flex items-start gap-2">
							<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
							Пополняете баланс
						</li>
						<li class="flex items-start gap-2">
							<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
							Пользуетесь — списания только за использование
						</li>
						<li class="flex items-start gap-2">
							<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
							Смотрите остаток и историю списаний в личном кабинете
						</li>
					</ul>
					<p class="text-xs text-gray-500">
						Текст зависит от объёма запроса и ответа. Изображения и аудио — по фиксированным
						ставкам.
					</p>
					{#if hasTopupAmounts}
						<TopUpAmountsInline
							amountsRub={topupAmounts}
							variant="block"
							label="Пополнение фиксированными суммами"
						/>
					{:else}
						<p class="text-xs text-gray-500">Суммы пополнения временно недоступны.</p>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<section class="bg-[#f7f7f8] py-16">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader
				id="estimator"
				title="Сколько это примерно стоит"
				subtitle="Ниже — ориентиры. Сумма зависит от объёма запросов и выбранной модели."
			/>
			<div class="mt-8">
				<Estimator
					config={estimatorConfig}
					{rateCard}
					{recommendedModelIdByType}
					loading={loadingRates}
					error={ratesError ? 'Оценка временно недоступна. Попробуйте обновить страницу.' : null}
					primaryLabel={$user ? 'Пополнить баланс' : 'Начать бесплатно'}
					onPrimaryAction={handleEstimatorPrimary}
					onScrollToCalculation={scrollToCalculation}
				/>
			</div>
		</div>
	</section>

	<section class="py-16">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader
				id="free"
				title="Бесплатный старт"
				subtitle={`Можно начать бесплатно без карты. Лимиты обновляются каждые ${cycleDays} дней.`}
			/>
			{#if freeLimitItems.length}
				<div class="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-gray-700">
					{#each freeLimitItems as item}
						<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
							{item.label}: {formatNumber(item.value)}{item.suffix}
						</div>
					{/each}
				</div>
			{:else}
				<p class="mt-6 text-sm text-gray-500">
					Лимиты будут отображаться после настройки квот администратора.
				</p>
			{/if}
			<div class="mt-6">
				<a
					href={$user ? '/' : '/signup'}
					class="inline-flex items-center justify-center rounded-full bg-black px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900"
					on:click={handleFreeStartCta}
				>
					Начать бесплатно
				</a>
			</div>
		</div>
	</section>

	<section class="bg-[#f7f7f8] py-16">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader
				id="rates"
				title="Ставки по моделям"
				subtitle="Если не хотите разбираться — используйте рекомендованный режим в чате. Если нужно точнее — выберите модель здесь."
			/>
			<div class="mt-8">
				<RatesTable
					models={rateCard?.models ?? []}
					currency={rateCard?.currency ?? 'RUB'}
					updatedAt={rateCard?.updated_at ?? null}
					{popularModelIds}
					defaultView="popular"
					loading={loadingRates}
					error={ratesError}
				/>
			</div>
		</div>
	</section>

	<section class="py-16">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader
				id="calculation"
				title="Как считается стоимость"
				subtitle="Коротко: за что списывается и где это посмотреть."
			/>
			<div class="mt-8 grid gap-4 text-sm text-gray-700">
				<div class="rounded-xl border border-gray-200/70 bg-white px-4 py-3">
					Текст: учитывается объём запроса и ответа.
				</div>
				<div class="rounded-xl border border-gray-200/70 bg-white px-4 py-3">
					Изображения: по фиксированной ставке (может зависеть от размера и модели).
				</div>
				<div class="rounded-xl border border-gray-200/70 bg-white px-4 py-3">
					Аудио: по длительности или объёму.
				</div>
				<div class="rounded-xl border border-gray-200/70 bg-white px-4 py-3">
					Где смотреть: история списаний в личном кабинете.
				</div>
			</div>
		</div>
	</section>

	<section class="py-16">
		<div class="mx-auto max-w-[1200px] px-4">
			<SectionHeader id="faq" title="Часто задаваемые вопросы" />
			<div class="mt-8 max-w-3xl">
				<FaqAccordion items={faqItems} topUpAmounts={topupAmounts} />
			</div>
		</div>
	</section>

	<section id="cta" class="bg-gray-900 py-16">
		<div class="mx-auto max-w-[1200px] px-4 text-white">
			<div class="rounded-[32px] border border-white/10 bg-white/5 p-8 md:p-10">
				<h2 class="text-3xl md:text-4xl font-semibold">Готовы начать?</h2>
				<p class="mt-3 text-base md:text-lg text-gray-200 leading-relaxed max-w-2xl">
					Начните бесплатно без карты. Без подписки и ежемесячных платежей — списания только за
					использование.
				</p>
				<div class="mt-6 flex flex-wrap gap-3 items-center">
					<a
						href={$user ? '/billing/balance' : '/signup'}
						class="inline-flex items-center justify-center rounded-full bg-white text-gray-900 px-6 py-2 text-sm font-semibold hover:bg-gray-100 transition-colors"
						on:click={handleFinalCta}
					>
						{$user ? 'Пополнить баланс' : 'Начать бесплатно'}
					</a>
					{#if hasTopupAmounts}
						<TopUpAmountsInline
							amountsRub={topupAmounts}
							variant="inline"
							trackId="cta"
							label="Суммы пополнения"
							tone="dark"
						/>
					{:else}
						<span class="text-xs font-medium text-gray-300">
							Суммы пополнения временно недоступны.
						</span>
					{/if}
				</div>
			</div>
		</div>
	</section>
</PublicPageLayout>
