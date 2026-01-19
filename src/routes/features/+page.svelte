<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const heroImage = '/landing/airis-chat.png';

	const modelHighlights = [
		{ name: 'GPT-5.2', provider: 'OpenAI' },
		{ name: 'Gemini 3', provider: 'Google' }
	];

	const capabilities = [
		{
			title: 'Мульти‑модели',
			description: 'Выбирайте оптимальную модель под скорость, качество и стоимость.'
		},
		{
			title: 'Контекстные диалоги',
			description: 'История чатов и результаты остаются под рукой.'
		},
		{
			title: 'Файлы и заметки',
			description: 'Сохраняйте материалы и возвращайтесь к ним в любое время.'
		},
		{
			title: 'Приватность',
			description: 'Управляйте доступами и настройками приватности.'
		},
		{
			title: 'Русский интерфейс',
			description: 'Понятный UX и оплата в рублях без VPN.'
		},
		{
			title: 'API и интеграции',
			description: 'Подключайте AIris к своим процессам и инструментам.'
		}
	];

	const useCases = [
		{
			title: 'Учёба',
			items: ['Конспекты и объяснения', 'Подготовка и практика', 'Быстрые ответы']
		},
		{
			title: 'Работа',
			items: ['Презентации и письма', 'Анализ и отчёты', 'Планы и идеи']
		},
		{
			title: 'Творчество',
			items: ['Идеи и тексты', 'Визуальные концепты', 'Сценарии и брифы']
		}
	];

	const highlights = [
		{
			title: 'PAYG без подписок',
			description: 'Платите только за фактическое использование и контролируйте лимиты.'
		},
		{
			title: 'Без VPN',
			description: 'Полный доступ к моделям работает из России без дополнительных настроек.'
		},
		{
			title: 'Оплата в рублях',
			description: 'Удобное пополнение баланса и прозрачные списания.'
		}
	];
</script>

<PublicPageLayout
	title="Возможности"
	description="Возможности AIris: мульти‑модели, контекстные диалоги, русский интерфейс и PAYG‑оплата."
	showHero={false}
>
	<section class="container mx-auto px-4 pt-12 pb-12">
		<div class="relative">
			<div class="absolute -top-20 -right-32 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.12),transparent_70%)]"></div>
			<div class="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_70%)]"></div>
			<div class="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
				<div class="space-y-6">
					<span class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600">
						Возможности
					</span>
					<h1 class="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.05]">
						Все ключевые возможности AIris
					</h1>
					<p class="text-lg md:text-xl text-gray-600 max-w-xl">
						Тексты, изображения, аудио и код — в одном интерфейсе
					</p>
					<div class="flex flex-wrap gap-3">
						<a
							href="/auth"
							class="bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-900 transition-colors"
						>
							Начать бесплатно
						</a>
						<a
							href="/pricing"
							class="px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-semibold hover:border-gray-400 hover:text-gray-900 transition-colors"
						>
							Посмотреть тарифы
						</a>
					</div>
					<div class="flex flex-wrap gap-3">
						{#each ['Тексты', 'Изображения', 'Аудио', 'Код'] as item}
							<div class="rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-xs font-semibold text-gray-700">
								{item}
							</div>
						{/each}
					</div>
				</div>

				<div class="relative">
					<div class="relative h-[360px] overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0d12] px-4 pb-6 pt-6 shadow-[0_40px_80px_rgba(15,23,42,0.25)] sm:h-[420px]">
						<div class="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(255,255,255,0.08),rgba(0,0,0,0))]"></div>
						<div class="absolute -left-2 top-10 w-[78%] max-w-[520px] -rotate-[10deg] rounded-[26px] border border-white/10 bg-[#0f1218]/80 p-2 shadow-[0_30px_70px_rgba(0,0,0,0.5)]">
							<img
								src={heroImage}
								alt="Интерфейс AIris"
								class="h-full w-full rounded-[20px] border border-white/5 object-cover"
								loading="lazy"
							/>
						</div>
						<div class="absolute right-8 top-14 w-[78%] max-w-[540px] rotate-[4deg] rounded-[26px] border border-white/10 bg-[#0f1218]/90 p-2 shadow-[0_35px_80px_rgba(0,0,0,0.55)]">
							<img
								src={heroImage}
								alt="Интерфейс AIris"
								class="h-full w-full rounded-[20px] border border-white/5 object-cover"
								loading="lazy"
							/>
						</div>
						<div class="absolute left-1/2 top-[52%] w-[78%] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/15 bg-[#0f1218] p-2 shadow-[0_40px_90px_rgba(0,0,0,0.6)]">
							<img
								src={heroImage}
								alt="Интерфейс AIris"
								class="h-full w-full rounded-[22px] border border-white/10 object-cover"
								loading="lazy"
							/>
						</div>
						<div class="absolute right-6 bottom-6 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs font-semibold text-white">
							Интерфейс AIris
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-12">
		<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 text-center mb-6">
				Подключенные модели
			</h2>
			<div class="flex flex-wrap justify-center gap-3">
				{#each modelHighlights as model}
					<div class="flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-xs font-semibold text-gray-700">
						<span>{model.name}</span>
						<span class="text-[0.65rem] font-medium text-gray-500">{model.provider}</span>
					</div>
				{/each}
			</div>
			<p class="text-center text-sm text-gray-600 mt-4">
				Мы обновляем список моделей и добавляем новые версии по мере выхода.
			</p>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-12">
		<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 text-center mb-10">
				Что можно делать в AIris
			</h2>
			<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each capabilities as capability}
					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
						<h3 class="text-lg font-semibold text-gray-900 mb-2">{capability.title}</h3>
						<p class="text-sm text-gray-600 leading-relaxed">{capability.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-12">
		<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 text-center mb-10">
				Сценарии использования
			</h2>
			<div class="grid md:grid-cols-3 gap-6">
				{#each useCases as useCase}
					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 text-center shadow-sm">
						<h3 class="text-lg font-semibold text-gray-900 mb-3">{useCase.title}</h3>
						<ul class="space-y-2 text-sm text-gray-600">
							{#each useCase.items as item}
								<li>{item}</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-12">
		<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 text-center mb-10">
				Почему AIris
			</h2>
			<div class="grid md:grid-cols-3 gap-6">
				{#each highlights as item}
					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
						<h3 class="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
						<p class="text-sm text-gray-600 leading-relaxed">{item.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm text-center">
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 mb-3">Готовы попробовать?</h2>
			<p class="text-gray-600 mb-6">
				Начните бесплатно и получите доступ к лучшим моделям в одном месте.
			</p>
			<div class="flex flex-wrap justify-center gap-4">
				<a
					href="/auth"
					class="bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-900 transition-colors"
				>
					Начать бесплатно
				</a>
				<a
					href="/pricing"
					class="px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-semibold hover:border-gray-400 hover:text-gray-900 transition-colors"
				>
					Посмотреть тарифы
				</a>
			</div>
		</div>
	</section>
</PublicPageLayout>
