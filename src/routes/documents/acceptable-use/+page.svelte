<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '05 февраля 2026';
</script>

<PublicPageLayout
	title="Правила допустимого использования (AUP)"
	description="Ограничения использования AIRIS для безопасности пользователей и соблюдения закона."
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
				Правила допустимого использования (AUP)
			</h1>
			<p class="text-lg text-gray-600 max-w-3xl">
				Эти правила помогают предотвратить злоупотребления и обеспечить безопасность.
			</p>
			<p class="text-sm text-gray-500">Последнее обновление: {lastUpdated}</p>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-12 space-y-6">
			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">1. Запрещенные действия</h2>
				<ul class="list-disc pl-6 space-y-2 text-gray-600">
					<li>Нарушение законодательства РФ и прав третьих лиц.</li>
					<li>Попытки несанкционированного доступа, обход ограничений, вредоносная активность.</li>
					<li>Рассылка спама, фишинг, распространение вредоносного ПО.</li>
					<li>Создание/распространение контента, который является незаконным или вводит в заблуждение.</li>
					<li>Использование сервиса для атак на инфраструктуру третьих лиц.</li>
				</ul>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">2. AI‑контент</h2>
				<p class="text-gray-600 leading-relaxed">
					Ответы моделей носят вероятностный характер и могут содержать ошибки. Вы несёте ответственность за проверку и
					корректное применение результатов.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">3. Реакция на нарушения</h2>
				<p class="text-gray-600 leading-relaxed">
					При выявлении нарушений мы можем ограничить или приостановить доступ, запросить дополнительные сведения, а также
					передать информацию компетентным органам, если это требуется законом.
				</p>
			</section>

			<p class="text-gray-600 leading-relaxed">
				Правила AUP дополняют
				<a href="/terms" class="text-gray-900 font-medium hover:underline">оферту</a>.
			</p>
		</div>
	</section>
</PublicPageLayout>

