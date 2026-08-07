<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const groups = [
		{
			title: 'Для пользователей',
			documents: [
				['Оферта', 'Условия доступа к Airis и оплаты по факту использования.', '/terms'],
				['Конфиденциальность', 'Как обрабатываются данные и запросы.', '/privacy'],
				[
					'Согласие на обработку данных',
					'Текст согласия для пользователей сервиса.',
					'/documents/consent'
				],
				['Cookie-политика', 'Какие cookies используются на сайте.', '/documents/cookies'],
				[
					'Возвраты и расторжение',
					'Порядок возврата средств и закрытия аккаунта.',
					'/documents/returns'
				],
				[
					'Допустимое использование',
					'Ограничения по контенту и безопасности.',
					'/documents/acceptable-use'
				]
			]
		},
		{
			title: 'Для бизнеса',
			documents: [
				[
					'Поставщики и обработчики',
					'Список subprocessors и страны обработки.',
					'/documents/subprocessors'
				],
				['DPA', 'Поручение обработки персональных данных для B2B.', '/documents/dpa']
			]
		}
	] as const;
</script>

<PublicPageLayout
	title="Документы"
	description="Оферта, политика конфиденциальности и другие документы Airis."
	showHero={false}
>
	<section class="airis-public-simple-hero">
		<div class="container mx-auto px-4 py-16 lg:py-20">
			<div class="max-w-3xl">
				<p class="airis-public-eyebrow">Документы Airis</p>
				<h1 class="airis-public-display mt-5">Всё важное — в одном месте</h1>
				<p class="airis-public-lead mt-6">
					Выберите документ, чтобы узнать условия использования, оплаты и обработки данных.
				</p>
				<p class="mt-4 text-sm text-[var(--airis-muted)]">
					Актуальная редакция указана внутри каждого документа.
				</p>
			</div>
		</div>
	</section>

	<section class="airis-public-section">
		<div class="container mx-auto space-y-12 px-4">
			{#each groups as group}
				<section aria-labelledby={group.title.replace(/\s+/g, '-').toLowerCase()}>
					<h2
						id={group.title.replace(/\s+/g, '-').toLowerCase()}
						class="airis-public-section-title text-2xl md:text-3xl"
					>
						{group.title}
					</h2>
					<div class="mt-6 grid gap-4 md:grid-cols-2">
						{#each group.documents as document}
							<a
								class="airis-public-card group flex min-h-32 items-start justify-between gap-4 p-6 transition hover:-translate-y-0.5"
								href={document[2]}
							>
								<div>
									<h3>{document[0]}</h3>
									<p class="mt-2">{document[1]}</p>
								</div>
								<span class="airis-public-text-button" aria-hidden="true">→</span>
							</a>
						{/each}
					</div>
				</section>
			{/each}
			<p class="max-w-3xl text-sm leading-relaxed text-[var(--airis-muted)]">
				Если вы ищете информацию о продукте, начните с <a
					class="airis-public-text-button"
					href="/features">возможностей</a
				>
				или <a class="airis-public-text-button" href="/pricing">стоимости</a>.
			</p>
		</div>
	</section>
</PublicPageLayout>
