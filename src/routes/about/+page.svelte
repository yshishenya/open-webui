<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const teamMembers = [
		{ name: 'Команда разработки', role: 'Создание продукта', icon: '👨‍💻' },
		{ name: 'Команда поддержки', role: 'Помощь пользователям', icon: '🎧' },
		{ name: 'Команда безопасности', role: 'Защита данных', icon: '🔒' }
	];

	const milestones = [
		{ year: '2024', event: 'Запуск Open WebUI', description: 'Начало работы проекта' },
		{ year: '2024', event: 'Первые пользователи', description: 'Рост до 1000 активных пользователей' },
		{ year: '2025', event: 'Масштабирование', description: 'Расширение функционала и команды' }
	];
</script>

<PublicPageLayout
	title="О нас"
	description="Узнайте больше о AIris - интеллектуальном AI-ассистенте для работы и творчества."
	showHero={true}
	heroTitle="О компании AIris"
	heroSubtitle="Мы создаем инструменты, которые делают искусственный интеллект доступным каждому"
>
	<div class="container mx-auto px-4 py-16">

		<!-- Mission Section -->
		<div class="grid md:grid-cols-2 gap-12 mb-16 max-w-6xl mx-auto">
			<div class="bg-white rounded-2xl shadow-xl p-8">
				<div class="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
					<svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
					</svg>
				</div>
				<h2 class="text-2xl font-bold text-gray-900 mb-4">Наша миссия</h2>
				<p class="text-gray-600 leading-relaxed">
					Сделать передовые технологии искусственного интеллекта доступными для каждого.
					Мы верим, что AI должен быть инструментом, который помогает людям, а не заменяет их.
				</p>
			</div>

			<div class="bg-white rounded-2xl shadow-xl p-8">
				<div class="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
					<svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
					</svg>
				</div>
				<h2 class="text-2xl font-bold text-gray-900 mb-4">Наше видение</h2>
				<p class="text-gray-600 leading-relaxed">
					Мы стремимся создать экосистему, где каждый может использовать возможности AI
					для решения своих задач - от простого общения до сложных бизнес-процессов.
				</p>
			</div>
		</div>

		<!-- Values Section -->
		<div class="max-w-6xl mx-auto mb-16">
			<h2 class="text-3xl font-bold text-center text-gray-900 mb-12">Наши ценности</h2>

			<div class="grid md:grid-cols-3 gap-8">
				<div class="text-center">
					<div class="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
						<svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
						</svg>
					</div>
					<h3 class="text-xl font-semibold text-gray-900 mb-3">Безопасность</h3>
					<p class="text-gray-600">
						Защита данных пользователей - наш главный приоритет. Все данные шифруются и хранятся в безопасности.
					</p>
				</div>

				<div class="text-center">
					<div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
						<svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
						</svg>
					</div>
					<h3 class="text-xl font-semibold text-gray-900 mb-3">Надежность</h3>
					<p class="text-gray-600">
						Наши сервисы работают 24/7 с гарантией доступности 99.9%. Мы всегда рядом, когда вы нас нужны.
					</p>
				</div>

				<div class="text-center">
					<div class="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
						<svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
						</svg>
					</div>
					<h3 class="text-xl font-semibold text-gray-900 mb-3">Поддержка</h3>
					<p class="text-gray-600">
						Мы ценим каждого пользователя и готовы помочь в любой ситуации. Наша команда всегда на связи.
					</p>
				</div>
			</div>
		</div>

		<!-- Stats Section -->
		<div class="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 md:p-12 text-white mb-16 max-w-6xl mx-auto">
			<div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
				<div>
					<div class="text-4xl md:text-5xl font-bold mb-2">10K+</div>
					<div class="text-white/80">Пользователей</div>
				</div>
				<div>
					<div class="text-4xl md:text-5xl font-bold mb-2">1M+</div>
					<div class="text-white/80">Запросов</div>
				</div>
				<div>
					<div class="text-4xl md:text-5xl font-bold mb-2">99.9%</div>
					<div class="text-white/80">Время работы</div>
				</div>
				<div>
					<div class="text-4xl md:text-5xl font-bold mb-2">24/7</div>
					<div class="text-white/80">Поддержка</div>
				</div>
			</div>
		</div>

		<!-- CTA Section -->
		<div class="text-center max-w-2xl mx-auto">
			<h2 class="text-3xl font-bold text-gray-900 mb-6">
				Присоединяйтесь к нам
			</h2>
			<p class="text-gray-600 mb-8">
				Начните использовать Open WebUI уже сегодня и откройте для себя возможности искусственного интеллекта.
			</p>
			<div class="flex flex-wrap justify-center gap-4">
				<a
					href="/"
					class="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-colors shadow-lg"
				>
					Начать бесплатно
				</a>
				<a
					href="/contact"
					class="border-2 border-purple-600 text-purple-600 px-8 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-colors"
				>
					Связаться с нами
				</a>
			</div>
		</div>
	</div>
</PublicPageLayout>
