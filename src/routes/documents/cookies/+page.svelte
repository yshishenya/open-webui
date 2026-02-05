<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '05 февраля 2026';
</script>

<PublicPageLayout
	title="Cookie‑политика"
	description="Информация о файлах cookie, используемых AIRIS, и способах управления ими."
	showHero={false}
>
	<section class="container mx-auto px-4 pt-12 pb-12">
		<div class="space-y-6">
			<span
				class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600"
			>
				Документы
			</span>
			<h1 class="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-[1.05]">
				Cookie‑политика
			</h1>
			<p class="text-lg text-gray-600 max-w-3xl">
				Рассказываем, какие cookies используются в AIRIS и как можно управлять настройками.
			</p>
			<p class="text-sm text-gray-500">Последнее обновление: {lastUpdated}</p>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-12 space-y-6">
			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">1. Что такое cookie</h2>
				<p class="text-gray-600 leading-relaxed">
					Cookie — это небольшие файлы, которые сохраняются на вашем устройстве и помогают сайту работать,
					запоминать настройки и улучшать пользовательский опыт.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">2. Какие cookies мы используем</h2>
				<ul class="list-disc pl-6 space-y-2 text-gray-600">
					<li>
						<strong>Необходимые</strong> — обеспечивают работу авторизации, безопасности и базовой функциональности.
					</li>
					<li>
						<strong>Функциональные</strong> — сохраняют настройки (например, язык, тему, предпочтения интерфейса).
					</li>
					<li>
						<strong>Аналитические</strong> — помогают понять, как используется сервис (могут быть отключены).
					</li>
				</ul>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">3. Как управлять cookies</h2>
				<p class="text-gray-600 leading-relaxed">
					Вы можете удалить cookies или ограничить их использование в настройках браузера. Обратите внимание: отключение
					необходимых cookies может привести к некорректной работе сервиса.
				</p>
			</section>

			<p class="text-gray-600 leading-relaxed">
				Подробно о целях обработки и категориях данных см. в
				<a href="/privacy" class="text-gray-900 font-medium hover:underline">Политике конфиденциальности</a>.
			</p>
		</div>
	</section>
</PublicPageLayout>

