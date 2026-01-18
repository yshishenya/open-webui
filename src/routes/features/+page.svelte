<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const heroImage =
		'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80';

	const features = [
		{
			icon: 'layers',
			title: 'Множество AI-моделей',
			description: 'Выбирайте оптимальную модель под скорость, качество и стоимость.',
			details: ['OpenAI, Anthropic, Google', 'Поддержка локальных моделей', 'Быстрый выбор в один клик']
		},
		{
			icon: 'chat',
			title: 'Контекстные диалоги',
			description: 'История чатов, заметки и файлы всегда под рукой.',
			details: ['Сохранение и поиск', 'Мульти-чат и папки', 'Удобный экспорт']
		},
		{
			icon: 'shield',
			title: 'Безопасность данных',
			description: 'Управляйте доступами и настройками приватности в одном месте.',
			details: ['Шифрование передачи', 'Контроль ролей', 'Настройки доступа']
		},
		{
			icon: 'globe',
			title: 'Русский интерфейс',
			description: 'Полный UX на русском и локальные способы оплаты.',
			details: ['Поддержка на русском', 'Оплата в рублях', 'Понятные тарифы']
		},
		{
			icon: 'devices',
			title: 'Работа с любого устройства',
			description: 'Веб-приложение адаптировано под ноутбук, планшет и смартфон.',
			details: ['Адаптивный дизайн', 'Быстрый доступ', 'Синхронизация']
		},
		{
			icon: 'api',
			title: 'Интеграции и API',
			description: 'Подключайте AIris к своим инструментам и процессам.',
			details: ['REST API', 'Инструменты для команд', 'Поддержка разработчиков']
		}
	];

	const useCases = [
		{
			icon: 'briefcase',
			title: 'Для бизнеса',
			items: ['Автоматизация рутины', 'Генерация текстов', 'Анализ документов']
		},
		{
			icon: 'code',
			title: 'Для разработчиков',
			items: ['Рефакторинг кода', 'Поиск ошибок', 'Документация']
		},
		{
			icon: 'users',
			title: 'Для команд',
			items: ['Общие чаты', 'Контроль доступов', 'Единые шаблоны']
		},
		{
			icon: 'book',
			title: 'Для обучения',
			items: ['Объяснение тем', 'Практика языков', 'Подготовка к экзаменам']
		}
	];

	const highlights = [
		{
			title: 'Быстрый старт',
			description: 'Регистрация за минуту и сразу в рабочем пространстве.'
		},
		{
			title: 'Прозрачная оплата',
			description: 'Платите по факту использования и контролируйте лимиты.'
		},
		{
			title: 'Локальная поддержка',
			description: 'Команда отвечает быстро и на понятном языке.'
		}
	];
</script>

<PublicPageLayout
	title="Возможности"
	description="Узнайте о возможностях AIris: мульти-модели, безопасность, русский интерфейс и удобные интеграции."
	showHero={true}
	heroTitle="Все ключевые возможности AIris"
	heroSubtitle="Один сервис для работы с AI-моделями, файлами и задачами"
	heroEyebrow="Возможности"
	heroImage={heroImage}
	heroImageAlt="AI-технологии и интерфейс"
>
	<div class="container mx-auto px-4 pt-4 pb-16">
		<section class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
			{#each features as feature}
				<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
					<div class="w-11 h-11 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center mb-4">
						{#if feature.icon === 'layers'}
							<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4"></path>
							</svg>
						{:else if feature.icon === 'chat'}
							<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h6m-6 8l-4-4H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2H7"></path>
							</svg>
						{:else if feature.icon === 'shield'}
							<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3l8 4v5c0 5-3.5 9-8 9s-8-4-8-9V7l8-4z"></path>
							</svg>
						{:else if feature.icon === 'globe'}
							<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 0c2.5 2.5 2.5 12 0 14m0-14c-2.5 2.5-2.5 12 0 14m-7-7h14"></path>
							</svg>
						{:else if feature.icon === 'devices'}
							<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v6m-6 8h4a2 2 0 002-2v-5a2 2 0 00-2-2h-4a2 2 0 00-2 2v5a2 2 0 002 2z"></path>
							</svg>
						{:else if feature.icon === 'api'}
							<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8m-4-4h8M4 12a8 8 0 1116 0 8 8 0 01-16 0z"></path>
							</svg>
						{/if}
					</div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
					<p class="text-gray-600 text-sm leading-relaxed mb-4">{feature.description}</p>
					<ul class="space-y-2">
						{#each feature.details as detail}
							<li class="flex items-start gap-2 text-sm text-gray-600">
								<span class="mt-2 h-1.5 w-1.5 rounded-full bg-gray-400"></span>
								{detail}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</section>

		<section class="max-w-6xl mx-auto mt-16">
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 text-center mb-10">
				Сценарии использования
			</h2>
			<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
				{#each useCases as useCase}
					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 text-center shadow-sm">
						<div class="w-11 h-11 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center mx-auto mb-4">
							{#if useCase.icon === 'briefcase'}
								<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6V5a2 2 0 012-2h0a2 2 0 012 2v1m-9 4h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z"></path>
								</svg>
							{:else if useCase.icon === 'code'}
								<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 18l6-6-6-6M8 6l-6 6 6 6"></path>
								</svg>
							{:else if useCase.icon === 'users'}
								<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>
								</svg>
							{:else if useCase.icon === 'book'}
								<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m8-10h-5a2 2 0 00-2 2v8a2 2 0 002 2h5V8a2 2 0 00-2-2zM4 8h5a2 2 0 012 2v8a2 2 0 01-2 2H4V8a2 2 0 012-2z"></path>
								</svg>
							{/if}
						</div>
						<h3 class="text-lg font-semibold text-gray-900 mb-3">{useCase.title}</h3>
						<ul class="space-y-2 text-sm text-gray-600">
							{#each useCase.items as item}
								<li>{item}</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</section>

		<section class="max-w-5xl mx-auto mt-16">
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
		</section>

		<section class="max-w-5xl mx-auto mt-16">
			<div class="bg-white rounded-2xl border border-gray-200/70 p-8 md:p-10 shadow-sm text-center">
				<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 mb-3">Готовы попробовать?</h2>
				<p class="text-gray-600 mb-6">
					Попробуйте AIris бесплатно и оцените удобство работы с несколькими AI-моделями.
				</p>
				<div class="flex flex-wrap justify-center gap-4">
					<a
						href="/"
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
	</div>
</PublicPageLayout>
