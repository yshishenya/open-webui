<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const features = [
		{
			icon: '🤖',
			title: 'Множество AI-моделей',
			description: 'Работайте с ChatGPT-4, Claude, Llama и другими передовыми моделями в одном интерфейсе.',
			details: [
				'GPT-3.5 и GPT-4 от OpenAI',
				'Claude 3 от Anthropic',
				'Llama 3 от Meta',
				'Mistral и другие открытые модели'
			]
		},
		{
			icon: '💬',
			title: 'Умные диалоги',
			description: 'Ведите естественные разговоры с AI, который понимает контекст и помнит историю чата.',
			details: [
				'Полная история переписки',
				'Понимание контекста',
				'Многоязычная поддержка',
				'Персонализация ответов'
			]
		},
		{
			icon: '🔒',
			title: 'Безопасность данных',
			description: 'Ваши данные защищены шифрованием и не передаются третьим лицам без вашего согласия.',
			details: [
				'Шифрование TLS/SSL',
				'Безопасное хранение данных',
				'Контроль доступа',
				'GDPR-совместимость'
			]
		},
		{
			icon: '🇷🇺',
			title: 'Полностью на русском',
			description: 'Интерфейс и поддержка полностью на русском языке. AI отлично понимает русский язык.',
			details: [
				'Русский интерфейс',
				'Поддержка на русском',
				'Документация на русском',
				'Локальные способы оплаты'
			]
		},
		{
			icon: '📱',
			title: 'Работа с любого устройства',
			description: 'Используйте Open WebUI на компьютере, планшете или смартфоне без установки приложений.',
			details: [
				'Адаптивный дизайн',
				'Работа в браузере',
				'Синхронизация данных',
				'Офлайн-режим (скоро)'
			]
		},
		{
			icon: '⚡',
			title: 'Высокая скорость',
			description: 'Быстрые ответы благодаря оптимизированной инфраструктуре и кэшированию.',
			details: [
				'Серверы в России',
				'CDN для статики',
				'Потоковая передача ответов',
				'Приоритет для платных планов'
			]
		},
		{
			icon: '🔌',
			title: 'API для разработчиков',
			description: 'Интегрируйте возможности Open WebUI в свои приложения через REST API.',
			details: [
				'REST API',
				'Документация OpenAPI',
				'Примеры кода',
				'Поддержка разработчиков'
			]
		},
		{
			icon: '📊',
			title: 'Аналитика использования',
			description: 'Отслеживайте статистику использования и контролируйте расходы.',
			details: [
				'Статистика запросов',
				'Использование токенов',
				'Контроль квот',
				'Отчеты по периодам'
			]
		},
		{
			icon: '👥',
			title: 'Командная работа',
			description: 'Работайте над проектами вместе с коллегами с общими чатами и настройками.',
			details: [
				'Общие чаты команды',
				'Управление участниками',
				'Ролевой доступ',
				'Корпоративные настройки'
			]
		}
	];

	const useCases = [
		{
			title: 'Для бизнеса',
			icon: '💼',
			items: [
				'Автоматизация рутинных задач',
				'Генерация контента',
				'Анализ документов',
				'Поддержка клиентов'
			]
		},
		{
			title: 'Для разработчиков',
			icon: '👨‍💻',
			items: [
				'Написание и рефакторинг кода',
				'Отладка и поиск ошибок',
				'Документирование',
				'Обучение новым технологиям'
			]
		},
		{
			title: 'Для творчества',
			icon: '🎨',
			items: [
				'Написание текстов',
				'Генерация идей',
				'Редактирование контента',
				'Переводы'
			]
		},
		{
			title: 'Для обучения',
			icon: '📚',
			items: [
				'Объяснение сложных тем',
				'Подготовка к экзаменам',
				'Изучение языков',
				'Исследования'
			]
		}
	];
</script>

<PublicPageLayout
	title="Возможности"
	description="Узнайте о возможностях AIris: множество AI-моделей, безопасность, русский интерфейс и многое другое."
	showHero={true}
	heroTitle="Все возможности AIris"
	heroSubtitle="Мощный инструмент для работы с искусственным интеллектом"
>
	<div class="container mx-auto px-4 py-16">

		<!-- Features Grid -->
		<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20 max-w-7xl mx-auto">
			{#each features as feature}
				<div class="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
					<div class="text-4xl mb-4">{feature.icon}</div>
					<h3 class="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
					<p class="text-gray-600 mb-4">{feature.description}</p>
					<ul class="space-y-2">
						{#each feature.details as detail}
							<li class="flex items-center gap-2 text-sm text-gray-600">
								<svg class="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
								</svg>
								{detail}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		<!-- Use Cases Section -->
		<div class="max-w-6xl mx-auto mb-20">
			<h2 class="text-3xl font-bold text-center text-gray-900 mb-12">
				Сценарии использования
			</h2>

			<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
				{#each useCases as useCase}
					<div class="bg-white rounded-xl shadow-md p-6 text-center">
						<div class="text-4xl mb-4">{useCase.icon}</div>
						<h3 class="text-lg font-bold text-gray-900 mb-4">{useCase.title}</h3>
						<ul class="space-y-2 text-sm text-gray-600">
							{#each useCase.items as item}
								<li>{item}</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</div>

		<!-- Comparison Section -->
		<div class="max-w-4xl mx-auto mb-20">
			<h2 class="text-3xl font-bold text-center text-gray-900 mb-12">
				Почему Open WebUI?
			</h2>

			<div class="bg-white rounded-2xl shadow-xl p-8 md:p-12">
				<div class="grid md:grid-cols-2 gap-8">
					<div>
						<h3 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
							<span class="text-green-500">✓</span> Open WebUI
						</h3>
						<ul class="space-y-3">
							<li class="flex items-start gap-3 text-gray-600">
								<svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
								</svg>
								Множество AI-моделей в одном месте
							</li>
							<li class="flex items-start gap-3 text-gray-600">
								<svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
								</svg>
								Полностью на русском языке
							</li>
							<li class="flex items-start gap-3 text-gray-600">
								<svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
								</svg>
								Оплата в рублях
							</li>
							<li class="flex items-start gap-3 text-gray-600">
								<svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
								</svg>
								Локальная поддержка 24/7
							</li>
							<li class="flex items-start gap-3 text-gray-600">
								<svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
								</svg>
								Серверы в России
							</li>
						</ul>
					</div>

					<div>
						<h3 class="text-xl font-bold text-gray-400 mb-4 flex items-center gap-2">
							<span class="text-gray-400">✗</span> Зарубежные аналоги
						</h3>
						<ul class="space-y-3">
							<li class="flex items-start gap-3 text-gray-400">
								<svg class="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
								</svg>
								Одна модель на сервис
							</li>
							<li class="flex items-start gap-3 text-gray-400">
								<svg class="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
								</svg>
								Интерфейс на английском
							</li>
							<li class="flex items-start gap-3 text-gray-400">
								<svg class="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
								</svg>
								Оплата только в долларах
							</li>
							<li class="flex items-start gap-3 text-gray-400">
								<svg class="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
								</svg>
								Поддержка на английском
							</li>
							<li class="flex items-start gap-3 text-gray-400">
								<svg class="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
								</svg>
								Высокий пинг из России
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>

		<!-- CTA Section -->
		<div class="max-w-4xl mx-auto">
			<div class="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 md:p-12 text-white text-center">
				<h2 class="text-3xl font-bold mb-4">
					Готовы начать?
				</h2>
				<p class="text-lg mb-8 opacity-90">
					Попробуйте Open WebUI бесплатно и откройте для себя возможности AI
				</p>
				<div class="flex flex-wrap justify-center gap-4">
					<a
						href="/"
						class="bg-white text-purple-600 px-8 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors shadow-lg"
					>
						Начать бесплатно
					</a>
					<a
						href="/pricing"
						class="border-2 border-white text-white px-8 py-3 rounded-xl font-semibold hover:bg-white hover:text-purple-600 transition-colors"
					>
						Посмотреть тарифы
					</a>
				</div>
			</div>
		</div>
	</div>
</PublicPageLayout>
