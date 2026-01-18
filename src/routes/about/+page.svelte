<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const heroImage =
		'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=1400&q=80';

	const values = [
		{
			title: 'Безопасность',
			description: 'Защита данных и контроль доступа - основа доверия к сервису.'
		},
		{
			title: 'Надежность',
			description: 'Стабильная работа и предсказуемый результат каждый день.'
		},
		{
			title: 'Поддержка',
			description: 'Мы отвечаем быстро и говорим с пользователями на одном языке.'
		}
	];

	const stats = [
		{ value: '10K+', label: 'Пользователей' },
		{ value: '1M+', label: 'Запросов' },
		{ value: '99.9%', label: 'Доступность' },
		{ value: '24/7', label: 'Поддержка' }
	];
</script>

<PublicPageLayout
	title="О нас"
	description="Узнайте больше о AIris - сервисе, который делает AI удобным и доступным."
	showHero={true}
	heroTitle="AIris - сервис, в котором AI работает на ваш результат"
	heroSubtitle="Мы строим понятный и безопасный опыт для людей, которые используют AI каждый день"
	heroEyebrow="О компании"
	heroImage={heroImage}
	heroImageAlt="Команда AIris"
>
	<div class="container mx-auto px-4 pt-4 pb-16">
		<section class="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
			<div class="bg-white rounded-2xl border border-gray-200/70 p-8 shadow-sm">
				<h2 class="text-2xl font-semibold text-gray-900 mb-4">Наша миссия</h2>
				<p class="text-gray-600 leading-relaxed">
					Сделать современные AI-модели доступными для бизнеса и личных задач без сложных
					настроек и лишних сервисов.
				</p>
			</div>
			<div class="bg-white rounded-2xl border border-gray-200/70 p-8 shadow-sm">
				<h2 class="text-2xl font-semibold text-gray-900 mb-4">Наш подход</h2>
				<p class="text-gray-600 leading-relaxed">
					Мы проектируем продукт так, чтобы каждое действие было очевидным: выбор модели, оплата,
					контроль данных и поддержка.
				</p>
			</div>
		</section>

		<section class="max-w-6xl mx-auto mt-16">
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 text-center mb-10">
				Наши ценности
			</h2>
			<div class="grid md:grid-cols-3 gap-6">
				{#each values as value}
					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
						<h3 class="text-lg font-semibold text-gray-900 mb-2">{value.title}</h3>
						<p class="text-sm text-gray-600 leading-relaxed">{value.description}</p>
					</div>
				{/each}
			</div>
		</section>

		<section class="max-w-6xl mx-auto mt-16">
			<div class="bg-white rounded-2xl border border-gray-200/70 p-8 md:p-10 shadow-sm">
				<div class="grid md:grid-cols-2 gap-8 items-center">
					<div>
						<h2 class="text-2xl font-semibold text-gray-900 mb-4">Команда, которая рядом</h2>
						<p class="text-gray-600 leading-relaxed">
							Мы поддерживаем пользователей на каждом этапе - от первого входа до настройки
							корпоративных сценариев. Все изменения продукта проверяем на реальных задачах.
						</p>
					</div>
					<div class="rounded-2xl border border-gray-200/70 overflow-hidden">
						<img
							src={heroImage}
							alt="Команда AIris за работой"
							class="w-full h-full object-cover"
							loading="lazy"
						/>
					</div>
				</div>
			</div>
		</section>

		<section class="max-w-6xl mx-auto mt-16">
			<div class="grid grid-cols-2 md:grid-cols-4 gap-6">
				{#each stats as stat}
					<div class="bg-white rounded-2xl border border-gray-200/70 p-6 text-center shadow-sm">
						<div class="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">{stat.value}</div>
						<div class="text-sm text-gray-600">{stat.label}</div>
					</div>
				{/each}
			</div>
		</section>

		<section class="max-w-4xl mx-auto mt-16">
			<div class="bg-white rounded-2xl border border-gray-200/70 p-8 md:p-10 shadow-sm text-center">
				<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 mb-3">
					Присоединяйтесь к AIris
				</h2>
				<p class="text-gray-600 mb-6">
					Попробуйте сервис бесплатно и убедитесь, что AI-инструменты могут быть простыми.
				</p>
				<div class="flex flex-wrap justify-center gap-4">
					<a
						href="/"
						class="bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-900 transition-colors"
					>
						Начать бесплатно
					</a>
					<a
						href="/contact"
						class="px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-semibold hover:border-gray-400 hover:text-gray-900 transition-colors"
					>
						Связаться с нами
					</a>
				</div>
			</div>
		</section>
	</div>
</PublicPageLayout>
