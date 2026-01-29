<script lang="ts">
	import { trackEvent } from '$lib/utils/analytics';
	import type { PublicLeadMagnetConfig } from '$lib/apis/billing';
	import SectionHeader from './SectionHeader.svelte';
	import { openCta } from './welcomeNavigation';

	export let leadMagnetConfig: PublicLeadMagnetConfig | null = null;
	let leadMagnetItems: { label: string; value: number; tooltip?: string }[] = [];

	const formatRawNumber = (value: number): string => new Intl.NumberFormat('ru-RU').format(value);

	const formatLeadMagnetItems = (config: PublicLeadMagnetConfig | null) => {
		if (!config?.enabled) return [];
		const quotas = config.quotas;
		return [
			{
				label: 'Текст (ввод)',
				value: quotas.tokens_input,
				tooltip: 'Текст считается по объёму: ваш запрос и ответ. Это стандартно для AI-сервисов.'
			},
			{
				label: 'Текст (ответ)',
				value: quotas.tokens_output,
				tooltip: 'Текст считается по объёму: ваш запрос и ответ. Это стандартно для AI-сервисов.'
			},
			{ label: 'Изображения', value: quotas.images },
			{ label: 'Озвучка текста (сек)', value: quotas.tts_seconds },
			{ label: 'Распознавание речи (сек)', value: quotas.stt_seconds }
		].filter((item) => item.value > 0);
	};

	$: leadMagnetItems = formatLeadMagnetItems(leadMagnetConfig);

	const handlePricingCtaClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('welcome_pricing_cta_click');
		openCta('welcome_pricing_cta');
	};

	const handlePricingFaqClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('welcome_pricing_faq_click');
		const target = document.getElementById('faq-cost');
		if (target instanceof HTMLDetailsElement) {
			target.open = true;
		}
		target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};
</script>

<section id="pricing" class="welcome-section welcome-section--soft">
	<div class="mx-auto max-w-[1200px] px-4">
		<SectionHeader
			eyebrow="ОПЛАТА"
			title="Бесплатный старт + оплата по использованию"
			subtitle="Без подписки и ежемесячных платежей: пополняете баланс, и списания идут только за использование."
		/>

		<div class="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
			<div class="welcome-card welcome-card--soft p-6">
				<h3 class="text-xl font-semibold text-gray-900">
					Без подписки — списания идут только за использование
				</h3>
				<p class="mt-3 text-sm text-gray-600">
					Вы пополняете баланс, а списания идут только за использование функций.
				</p>
				<div class="mt-6 grid gap-3 text-sm text-gray-700">
					<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
						Баланс пополняется заранее — удобно контролировать расходы
					</div>
					<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
						Текст зависит от объёма запроса и ответа
					</div>
					<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
						Изображения и аудио — по фиксированным ставкам
					</div>
					<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
						История списаний доступна в личном кабинете
					</div>
					<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
						Пополнение фиксированными суммами: 1 000 ₽ / 1 500 ₽ / 5 000 ₽ / 10 000 ₽
					</div>
				</div>
				<div class="mt-6 flex flex-wrap items-center gap-4">
					<a
						href="/signup?src=welcome_pricing_cta"
						class="inline-flex items-center justify-center rounded-full bg-black px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900"
						on:click={handlePricingCtaClick}
					>
						Начать бесплатно
					</a>
					<button
						type="button"
						class="text-sm font-semibold text-gray-600 hover:text-gray-900"
						on:click={handlePricingFaqClick}
					>
						Как считается стоимость?
					</button>
				</div>
			</div>
			<div class="welcome-card welcome-card--soft p-6">
				<h3 class="text-xl font-semibold text-gray-900">Бесплатный старт</h3>
				<p class="mt-3 text-sm text-gray-600">
					Часть возможностей доступна бесплатно в пределах лимитов — без карты и лишних шагов.
				</p>
				{#if leadMagnetItems.length}
					<div class="mt-6 grid gap-3 text-sm text-gray-700">
						{#each leadMagnetItems as item}
							<div
								class="flex items-center justify-between gap-3 rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3"
							>
								<div class="flex items-center gap-2">
									<span>{item.label}</span>
									{#if item.tooltip}
										<span
											class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500"
											title={item.tooltip}
											aria-label={item.tooltip}
										>
											i
										</span>
									{/if}
								</div>
								<span class="font-semibold">{formatRawNumber(item.value)}</span>
							</div>
						{/each}
					</div>
					<p class="mt-4 text-xs text-gray-500">
						Лимиты обновляются каждые {leadMagnetConfig?.cycle_days ?? 30} дней.
					</p>
				{:else}
					<p class="mt-4 text-sm text-gray-500">
						Лимиты будут отображаться после настройки квот администратора.
					</p>
				{/if}
			</div>
		</div>
	</div>
</section>
