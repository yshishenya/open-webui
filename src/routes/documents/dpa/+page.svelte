<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '05 февраля 2026';
</script>

<PublicPageLayout
	title="Поручение обработки персональных данных (DPA)"
	description="Шаблон соглашения о поручении обработки персональных данных для B2B-клиентов AIRIS."
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
				Поручение обработки ПДн (DPA) — шаблон для B2B
			</h1>
			<p class="text-lg text-gray-600 max-w-3xl">
				Документ предназначен для клиентов‑юрлиц/ИП, которые поручают обработку персональных данных через AIRIS.
			</p>
			<p class="text-sm text-gray-500">Последнее обновление: {lastUpdated}</p>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200/70 shadow-sm p-8 md:p-12 space-y-6">
			<div class="rounded-2xl border border-gray-200/70 bg-gray-50 p-4 text-sm text-gray-700">
				<p>
					Это шаблон. Перед использованием требуется адаптация под конкретного клиента (категории данных, меры защиты, перечень субподрядчиков, регионы).
				</p>
			</div>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">1. Роли сторон</h2>
				<p class="text-gray-600 leading-relaxed">
					Клиент выступает оператором персональных данных (определяет цели/средства), AIRIS — обработчиком, осуществляющим обработку
					по поручению клиента в рамках предоставления доступа к платформе.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">2. Предмет поручения</h2>
				<p class="text-gray-600 leading-relaxed">
					Обработка персональных данных для предоставления функционала платформы, хранения контента, выполнения запросов, обеспечения
					безопасности и поддержки. Категории субъектов/данных и перечень операций фиксируются в приложении к DPA.
				</p>
			</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">3. Меры защиты</h2>
					<p class="text-gray-600 leading-relaxed">
						AIRIS применяет организационные и технические меры защиты (контроль доступа, аудит, шифрование, резервное копирование и др.).
						Конкретный перечень мер и уровень защищенности фиксируются в приложении.
					</p>
				</section>

			<section class="space-y-3">
				<h2 class="text-xl font-semibold text-gray-900">4. Субподрядчики</h2>
				<p class="text-gray-600 leading-relaxed">
					AIRIS может привлекать субподрядчиков для оказания услуг. Актуальный перечень размещается на странице
					<a href="/documents/subprocessors" class="text-gray-900 font-medium hover:underline">subprocessors</a>.
					Условия привлечения и уведомления фиксируются в DPA.
				</p>
			</section>

			<p class="text-gray-600 leading-relaxed">
				Для оформления DPA напишите на
				<a href="mailto:support@airis.you" class="text-gray-900 font-medium hover:underline">support@airis.you</a>.
			</p>
		</div>
	</section>
</PublicPageLayout>
