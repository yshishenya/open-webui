<script lang="ts">
	import type { PublicLeadMagnetConfig } from '$lib/apis/billing';

	export let leadMagnetConfig: PublicLeadMagnetConfig | null = null;

	const steps = [
		{
			title: 'Выберите модель под задачу',
			description: 'Сравните скорость и стоимость — все ключевые модели в одном окне.'
		},
		{
			title: 'Сформулируйте запрос',
			description: 'Опишите задачу как в чате и получите результат за секунды.'
		},
		{
			title: 'Платите по факту',
			description: 'Списание происходит только за фактическое использование.'
		}
	];

	const capabilities = [
		{
			title: 'Тексты и анализ',
			description: 'Письма, статьи, резюме, планы и идеи.',
			example: 'Например: черновик коммерческого предложения.'
		},
		{
			title: 'Изображения',
			description: 'Генерация визуалов по описанию и доработка идей.',
			example: 'Например: визуал для соцсетей или концепт.'
		},
		{
			title: 'Аудио',
			description: 'Озвучка текста и распознавание речи.',
			example: 'Например: озвучить статью или расшифровать запись.'
		},
		{
			title: 'Код и данные',
			description: 'Помощь с кодом, объяснения и структурирование данных.',
			example: 'Например: быстро проверить идею или ошибку.'
		}
	];

	const useCases = [
		{
			title: 'Учёба',
			items: ['Конспекты и объяснения', 'Практика и подготовка', 'Быстрые ответы']
		},
		{
			title: 'Работа',
			items: ['Презентации и письма', 'Анализ и отчёты', 'Идеи и планы']
		},
		{
			title: 'Творчество',
			items: ['Идеи и тексты', 'Визуальные концепты', 'Сценарии и брифы']
		}
	];

	const formatRawNumber = (value: number): string =>
		new Intl.NumberFormat('ru-RU').format(value);

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

	$: leadMagnetItems = formatLeadMagnetItems(leadMagnetConfig);
</script>

<section class="mt-20">
	<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
		<div class="flex flex-col gap-3 max-w-2xl">
			<span class="text-xs uppercase tracking-[0.2em] text-gray-500">Как это работает</span>
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900">
				Три шага до результата
			</h2>
			<p class="text-gray-600">
				Минимум действий — максимум пользы. Всё устроено как понятный диалог.
			</p>
		</div>
		<div class="mt-8 grid md:grid-cols-3 gap-6">
			{#each steps as step, index}
				<div class="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-sm">
					<div class="text-3xl font-semibold text-gray-900 mb-3">
						0{index + 1}
					</div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
					<p class="text-sm text-gray-600 leading-relaxed">{step.description}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<section class="mt-20">
	<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
		<div class="flex flex-col gap-3 max-w-2xl">
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900">
				Что можно делать в AIris
			</h2>
			<p class="text-gray-600">
				Ключевые сценарии: тексты, визуалы, аудио и помощь с кодом.
			</p>
		</div>
		<div class="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
			{#each capabilities as capability}
				<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-gray-900 mb-2">{capability.title}</h3>
					<p class="text-sm text-gray-600 leading-relaxed">{capability.description}</p>
					<p class="mt-4 text-xs text-gray-500">{capability.example}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<section class="mt-20">
	<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
		<div class="max-w-3xl">
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900">Сценарии использования</h2>
			<p class="mt-3 text-gray-600">
				AIris помогает в учебе, работе и творчестве — выберите сценарий и начните.
			</p>
		</div>
		<div class="mt-8 grid md:grid-cols-3 gap-6">
			{#each useCases as useCase}
				<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
					<h3 class="text-lg font-semibold text-gray-900 mb-3">{useCase.title}</h3>
					<ul class="space-y-2 text-sm text-gray-600">
						{#each useCase.items as item}
							<li class="flex items-start gap-2">
								<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
								{item}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</div>
</section>

<section class="mt-20">
	<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
		<div class="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
			<div>
				<h2 class="text-2xl font-semibold text-gray-900 mb-4">
					Платите по факту — стартуйте бесплатно
				</h2>
				<p class="text-gray-600 mb-6">
					Стоимость видна до отправки. Списание происходит только за фактическое использование.
				</p>
				<div class="grid gap-3 text-sm text-gray-700">
					<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
						Раздельный расчет по входным и выходным токенам
					</div>
					<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
						Фиксированные ставки на изображения и аудио
					</div>
					<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
						История списаний доступна в личном кабинете
					</div>
				</div>
				<a
					href="/auth"
					class="mt-6 inline-flex items-center justify-center px-6 py-2 rounded-full bg-black text-white shadow-sm"
				>
					Начать бесплатно
				</a>
			</div>
			<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
				<h3 class="text-xl font-semibold text-gray-900 mb-3">Бесплатный старт</h3>
				<p class="text-sm text-gray-600 mb-4">
					Часть моделей доступна бесплатно в пределах лимитов — без карты и лишних шагов.
				</p>
				{#if leadMagnetItems.length}
					<div class="grid gap-3 text-sm text-gray-700">
						{#each leadMagnetItems as item}
							<div class="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3">
								{item.label}: {formatRawNumber(item.value)}
							</div>
						{/each}
					</div>
					<p class="mt-4 text-xs text-gray-500">
						Лимиты обновляются каждые {leadMagnetConfig?.cycle_days ?? 30} дней.
					</p>
				{:else}
					<p class="text-sm text-gray-500">
						Лимиты будут отображаться после настройки квот администратора.
					</p>
				{/if}
			</div>
		</div>
	</div>
</section>

<section class="mt-20">
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
					Оплата зависит от модели и объема: токены считаются отдельно для ввода и вывода,
					а изображения и аудио — по фиксированным ставкам. Перед отправкой виден расчет стоимости.
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
					Да, на выбранных моделях доступен бесплатный старт — можно попробовать сервис без оплаты.
				</p>
			</details>

			<details class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm group">
				<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
					Почему не все модели бесплатные?
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
					Часть моделей имеет более высокую себестоимость, поэтому бесплатный доступ ограничен
					списком моделей и квотами.
				</p>
			</details>

			<details class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm group">
				<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
					Нужен ли VPN для работы?
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
					Нет, сервис работает в России без дополнительных настроек.
				</p>
			</details>

			<details class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm group">
				<summary class="font-semibold text-gray-900 cursor-pointer flex justify-between items-center">
					Как пополнить баланс и контролировать лимиты?
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
					В личном кабинете вы можете пополнить баланс, задать лимит стоимости и увидеть историю списаний.
				</p>
			</details>
		</div>
	</div>
</section>
