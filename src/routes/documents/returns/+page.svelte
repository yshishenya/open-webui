<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '05 февраля 2026';
</script>

<PublicPageLayout
	title="Правила возврата и расторжения"
	description="Порядок возврата средств и прекращения использования сервиса AIRIS."
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
				Правила возврата и расторжения
			</h1>
			<p class="text-lg text-gray-600 max-w-3xl">
				Как закрыть аккаунт, как мы считаем остаток и когда возможен возврат.
			</p>
			<p class="text-sm text-gray-500">Последнее обновление: {lastUpdated}</p>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-12 space-y-6">
			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">1. Прекращение использования</h2>
				<p class="text-gray-600 leading-relaxed">
					Вы можете прекратить использование сервиса в любой момент: прекратить вход в аккаунт и/или обратиться в поддержку
					для удаления аккаунта. Отдельные функции могут быть недоступны при наличии задолженности/спорных операций.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">2. Возврат остатка</h2>
				<p class="text-gray-600 leading-relaxed">
					Неизрасходованный положительный остаток на лицевом счёте может быть возвращён по запросу после окончательных
					взаиморасчётов. Для возврата напишите на
					<a href="mailto:support@airis.you" class="text-gray-900 font-medium hover:underline">support@airis.you</a>
					с указанием реквизитов для перечисления.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">3. Сроки</h2>
				<p class="text-gray-600 leading-relaxed">
					Срок рассмотрения обращения и возврата обычно составляет до 30 календарных дней, если иной срок не требуется по
					закону или правилам платёжного провайдера.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">4. Особенности для потребителей</h2>
				<p class="text-gray-600 leading-relaxed">
					Если вы являетесь потребителем (физическое лицо, использующее сервис для личных нужд), ваши права защищены
					императивными нормами закона о защите прав потребителей. Условия оферты применяются постольку, поскольку не ухудшают
					положение потребителя.
				</p>
			</section>

			<p class="text-gray-600 leading-relaxed">
				Данный документ дополняет
				<a href="/terms" class="text-gray-900 font-medium hover:underline">оферту</a>
				и не заменяет её.
			</p>
		</div>
	</section>
</PublicPageLayout>

