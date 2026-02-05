<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '05 февраля 2026';

	const providers: Array<{
		name: string;
		role: string;
		country: string;
		note?: string;
	}> = [
		{
			name: 'OpenAI',
			role: 'Поставщик AI‑моделей (по выбору пользователя/конфигурации)',
			country: 'США',
			note: 'Данные запросов могут передаваться для генерации ответа.'
		},
		{
			name: 'Anthropic',
			role: 'Поставщик AI‑моделей (по выбору пользователя/конфигурации)',
			country: 'США',
			note: 'Данные запросов могут передаваться для генерации ответа.'
		},
		{
			name: 'Google (Gemini)',
			role: 'Поставщик AI‑моделей (по выбору пользователя/конфигурации)',
			country: 'США/ЕЭЗ (зависит от продукта/региона)',
			note: 'Данные запросов могут передаваться для генерации ответа.'
		},
		{
			name: 'YooKassa',
			role: 'Платёжный провайдер (приём платежей, чеки/фискализация — по настройкам)',
			country: 'Россия'
		}
	];
</script>

<PublicPageLayout
	title="Поставщики и субподрядчики"
	description="Перечень поставщиков/подрядчиков, которые могут получать доступ к данным для работы AIRIS."
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
				Поставщики и субподрядчики (subprocessors)
			</h1>
			<p class="text-lg text-gray-600 max-w-3xl">
				Ниже — перечень организаций, которые могут быть привлечены для оказания услуг и обработки данных.
			</p>
			<p class="text-sm text-gray-500">Последнее обновление: {lastUpdated}</p>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="max-w-4xl mx-auto space-y-6">
			<div class="rounded-2xl border border-gray-200/70 bg-white/80 p-6 text-sm text-gray-600">
				<p>
					Перечень может обновляться по мере подключения новых поставщиков. Актуальная версия публикуется на этой странице.
					Для вопросов: <a href="mailto:support@airis.you" class="text-gray-900 font-medium hover:underline">support@airis.you</a>.
				</p>
			</div>

			<div class="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden">
				<div class="divide-y divide-gray-200/70">
					{#each providers as item}
						<div class="p-6 space-y-2">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="text-lg font-semibold text-gray-900">{item.name}</div>
								<div class="text-sm text-gray-500">{item.country}</div>
							</div>
							<div class="text-sm text-gray-600">{item.role}</div>
							{#if item.note}
								<div class="text-sm text-gray-600">{item.note}</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class="rounded-2xl border border-gray-200/70 bg-white/80 p-6 text-sm text-gray-600 space-y-3">
				<p>
					Подробно о целях и правовых основаниях передачи см. в
					<a href="/privacy" class="text-gray-900 font-medium hover:underline">Политике конфиденциальности</a>.
				</p>
				<p>
					Важно: при выборе пользователем конкретной AI‑модели, запросы и контент могут передаваться соответствующему поставщику,
					в том числе за пределы РФ, если такой поставщик находится за рубежом.
				</p>
			</div>
		</div>
	</section>
</PublicPageLayout>

