<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { PublicPageLayout } from '$lib/components/landing';
	import {
		getPublicLeadMagnetConfig,
		getPublicRateCards
	} from '$lib/apis/billing';
	import type {
		PublicLeadMagnetConfig,
		PublicRateCardResponse,
		PublicRateCardUnit
	} from '$lib/apis/billing';
	import { formatCompactNumber } from '$lib/utils/billing-formatters';
	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');

	let loading = true;
	let errorMessage = '';
	let leadMagnetConfig: PublicLeadMagnetConfig | null = null;
	let rateCards: PublicRateCardResponse | null = null;

	const modelLabels: Record<string, string> = {
		'gpt-5.2': 'GPT-5.2',
		'gemini/gemini-3-pro-preview': 'Gemini 3'
	};

	onMount(async () => {
		loading = true;
		errorMessage = '';
		try {
			const [rateCardsResult, leadMagnetResult] = await Promise.all([
				getPublicRateCards(),
				getPublicLeadMagnetConfig()
			]);
			rateCards = rateCardsResult;
			leadMagnetConfig = leadMagnetResult;
			if (!rateCardsResult) {
				errorMessage = $i18n.t('Failed to load pricing');
			}
		} catch (error) {
			console.error('Failed to load public pricing:', error);
			errorMessage = $i18n.t('Failed to load pricing');
		} finally {
			loading = false;
		}
	});

	const formatMoney = (kopeks: number, currency: string): string => {
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat($i18n.locale, {
				style: 'currency',
				currency
			}).format(amount);
		} catch (error) {
			return `${amount.toFixed(2)} ${currency}`.trim();
		}
	};

	const formatRateLabel = (rate: PublicRateCardUnit): string => {
		if (rate.modality === 'text' && rate.unit === 'token_in') return 'Текст: ввод (1000 токенов)';
		if (rate.modality === 'text' && rate.unit === 'token_out') return 'Текст: вывод (1000 токенов)';
		if (rate.modality === 'image') return 'Изображение (1024px)';
		if (rate.modality === 'tts') return 'Озвучка (1000 символов)';
		if (rate.modality === 'stt') return 'Распознавание (1 минута)';
		return `${rate.modality} / ${rate.unit}`;
	};

	const formatLeadMagnetItems = (config: PublicLeadMagnetConfig | null) => {
		if (!config?.enabled) return [];
		const quotas = config.quotas;
		return [
			{ label: 'Токены (ввод)', value: quotas.tokens_input },
			{ label: 'Токены (вывод)', value: quotas.tokens_output },
			{ label: 'Изображения', value: quotas.images },
			{ label: 'TTS (сек)', value: quotas.tts_seconds },
			{ label: 'STT (сек)', value: quotas.stt_seconds }
		].filter((item) => item.value > 0);
	};

	const findRate = (modelId: string, modality: PublicRateCardUnit['modality'], unit: PublicRateCardUnit['unit']) => {
		const model = rateCards?.models?.find((item) => item.model_id === modelId);
		return model?.rates?.find((rate) => rate.modality === modality && rate.unit === unit) ?? null;
	};

	const estimateTextCost = (tokensIn: number, tokensOut: number) => {
		if (!rateCards?.currency) return null;
		const firstModel = rateCards.models?.[0]?.model_id;
		if (!firstModel) return null;
		const inRate = findRate(firstModel, 'text', 'token_in');
		const outRate = findRate(firstModel, 'text', 'token_out');
		if (!inRate || !outRate) return null;
		const costKopeks = (tokensIn / 1000) * inRate.price_kopeks + (tokensOut / 1000) * outRate.price_kopeks;
		return formatMoney(costKopeks, rateCards.currency ?? 'RUB');
	};

	const estimateImageCost = () => {
		if (!rateCards?.currency) return null;
		const firstModel = rateCards.models?.[0]?.model_id;
		if (!firstModel) return null;
		const rate =
			findRate(firstModel, 'image', 'image_1024') ??
			rateCards.models?.[0]?.rates?.find((entry) => entry.modality === 'image') ??
			null;
		if (!rate) return null;
		return formatMoney(rate.price_kopeks, rateCards.currency ?? 'RUB');
	};

	$: leadMagnetItems = formatLeadMagnetItems(leadMagnetConfig);
	$: example10 = estimateTextCost(800, 800);
	$: example50 = estimateTextCost(4000, 4000);
	$: exampleImage = estimateImageCost();
</script>

<PublicPageLayout
	title="Тарифы"
	description="PAYG‑оплата в AIris: прозрачные цены по фактическому использованию и бесплатный старт."
	showHero={false}
>
	<section class="container mx-auto px-4 pt-12 pb-12">
		<div class="relative">
			<div class="absolute -top-20 -right-32 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.12),transparent_70%)]"></div>
			<div class="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_70%)]"></div>
			<div class="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
				<div class="space-y-6">
					<span class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600">
						Тарифы
					</span>
					<h1 class="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.05]">
						PAYG‑оплата без подписок
					</h1>
					<p class="text-lg md:text-xl text-gray-600 max-w-xl">
						Платите только за фактическое использование.
					</p>
					<div class="flex flex-wrap gap-3">
						<a
							href="/auth"
							class="bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-900 transition-colors"
						>
							Начать бесплатно
						</a>
						<a
							href="/auth"
							class="px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-semibold hover:border-gray-400 hover:text-gray-900 transition-colors"
						>
							Пополнить баланс
						</a>
					</div>
					<div class="flex flex-wrap gap-3">
						{#each ['Стоимость видна до отправки', 'Оплата только за фактические запросы', 'Прозрачные списания'] as item}
							<div class="rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-xs font-semibold text-gray-700">
								{item}
							</div>
						{/each}
					</div>
				</div>

				<div class="rounded-[32px] border border-gray-200/70 bg-white/90 p-6 shadow-sm">
					<h3 class="text-xl font-semibold text-gray-900 mb-4">Как работает PAYG</h3>
					<ul class="space-y-3 text-sm text-gray-700">
						<li class="flex items-start gap-2">
							<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
							Раздельный расчет по входным и выходным токенам
						</li>
						<li class="flex items-start gap-2">
							<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
							Фиксированные ставки на изображения и аудио
						</li>
						<li class="flex items-start gap-2">
							<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
							История списаний в личном кабинете
						</li>
					</ul>
				</div>
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-12">
		{#if loading}
			<div class="flex justify-center">
				<Spinner className="size-5" />
			</div>
		{:else if errorMessage}
			<div class="flex flex-col items-center justify-center py-24 text-center">
				<div class="text-gray-500 text-lg">{errorMessage}</div>
			</div>
		{:else}
			<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
				<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 text-center mb-10">
					Реальные ставки PAYG
				</h2>
				{#if rateCards?.models?.length}
					<div class="grid md:grid-cols-2 gap-6">
						{#each rateCards.models as model}
							<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
								<div class="text-sm font-semibold text-gray-900 mb-4">
									{modelLabels[model.model_id] ?? model.model_id}
								</div>
								<ul class="space-y-3 text-sm text-gray-700">
									{#each model.rates as rate}
										<li class="flex items-center justify-between gap-4">
											<span>{formatRateLabel(rate)}</span>
											<span class="font-semibold text-gray-900">
												{formatMoney(rate.price_kopeks, rateCards?.currency ?? 'RUB')}
											</span>
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center text-sm text-gray-500">
						Тарифы будут доступны после настройки rate card.
					</div>
				{/if}
			</div>

			<div class="mt-12 rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
				<h2 class="text-2xl font-semibold text-gray-900 mb-4">
					Бесплатный старт на выбранных моделях
				</h2>
				<p class="text-gray-600 mb-6">
					Часть моделей доступна бесплатно в пределах лимитов, которые обновляются каждые
					{leadMagnetConfig?.cycle_days ?? 30} дней.
				</p>
				{#if leadMagnetItems.length}
					<div class="grid gap-3 sm:grid-cols-3 text-sm text-gray-700">
						{#each leadMagnetItems as item}
							<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
								{item.label}: {formatCompactNumber(item.value)}
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-sm text-gray-500">
						Лимиты будут отображаться после настройки квот администратора.
					</div>
				{/if}
			</div>

			<div class="mt-12 rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
				<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 text-center mb-8">
					Пример расходов
				</h2>
				<div class="grid md:grid-cols-3 gap-6 text-sm text-gray-700">
					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
						<h3 class="text-lg font-semibold text-gray-900 mb-2">10 сообщений в день</h3>
						<p class="text-gray-600 mb-4">Текстовые запросы средней длины.</p>
						<div class="text-xl font-semibold text-gray-900">
							{example10 ?? '—'}
						</div>
					</div>
					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
						<h3 class="text-lg font-semibold text-gray-900 mb-2">50 сообщений в день</h3>
						<p class="text-gray-600 mb-4">Активная работа с текстом.</p>
						<div class="text-xl font-semibold text-gray-900">
							{example50 ?? '—'}
						</div>
					</div>
					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
						<h3 class="text-lg font-semibold text-gray-900 mb-2">1 изображение</h3>
						<p class="text-gray-600 mb-4">Генерация визуала 1024px.</p>
						<div class="text-xl font-semibold text-gray-900">
							{exampleImage ?? '—'}
						</div>
					</div>
				</div>
				<p class="mt-6 text-xs text-gray-500 text-center">
					Примеры ориентировочные и рассчитываются по актуальным ставкам.
				</p>
			</div>
		{/if}
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
			<h2 class="text-2xl md:text-3xl font-semibold text-center text-gray-900 mb-8">
				Часто задаваемые вопросы
			</h2>
			<div class="max-w-3xl mx-auto space-y-4">
				<details class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm group">
					<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
						Как считается стоимость в PAYG?
						<svg
							class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						Списание зависит от модели и объема: токены считаются отдельно для ввода и вывода,
						а изображения и аудио — по фиксированным ставкам.
					</p>
				</details>

				<details class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm group">
					<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
						Есть ли бесплатный доступ?
						<svg
							class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						Да, часть моделей доступна бесплатно в пределах лимитов лид‑магнита.
					</p>
				</details>

				<details class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm group">
					<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
						Как пополнить баланс?
						<svg
							class="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</summary>
					<p class="mt-4 text-gray-600">
						Войдите в аккаунт, откройте баланс и выберите удобную сумму пополнения.
					</p>
				</details>
			</div>
		</div>
	</section>
</PublicPageLayout>
