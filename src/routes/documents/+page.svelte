<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const lastUpdated = '05 февраля 2026';

	const documents: Array<{
		title: string;
		description: string;
		href: string;
	}> = [
		{
			title: 'Лицензионный договор‑оферта',
			description: 'Основные условия доступа к платформе и оплаты по факту использования.',
			href: '/terms'
		},
		{
			title: 'Политика конфиденциальности',
			description: 'Какие данные собираем, как используем и защищаем.',
			href: '/privacy'
		},
		{
			title: 'Согласие на обработку персональных данных',
			description: 'Текст согласия (в т.ч. для чекбокса при регистрации).',
			href: '/documents/consent'
		},
		{
			title: 'Cookie‑политика',
			description: 'Какие cookies используем и как управлять настройками.',
			href: '/documents/cookies'
		},
		{
			title: 'Правила возврата и расторжения',
			description: 'Порядок возвратов/закрытия аккаунта и прекращения доступа.',
			href: '/documents/returns'
		},
		{
			title: 'Правила допустимого использования (AUP)',
			description: 'Ограничения по контенту, безопасности и злоупотреблениям.',
			href: '/documents/acceptable-use'
		},
		{
			title: 'Поставщики и субподрядчики (subprocessors)',
			description: 'Перечень привлеченных поставщиков/подрядчиков и страны обработки.',
			href: '/documents/subprocessors'
		},
		{
			title: 'Поручение обработки ПДн (DPA) для B2B',
			description: 'Шаблон соглашения для клиентов‑юрлиц/ИП.',
			href: '/documents/dpa'
		}
	];
</script>

<PublicPageLayout
	title="Документы"
	description="Юридические документы AIRIS: оферта, политика конфиденциальности и связанные документы."
	showHero={false}
>
	<section class="container mx-auto px-4 pt-12 pb-10">
		<div class="space-y-6">
			<span
				class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600"
			>
				Документы
			</span>
			<h1 class="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-[1.05]">
				Юридические документы
			</h1>
			<p class="text-lg text-gray-600 max-w-3xl">
				Ниже — актуальные документы, которые регулируют использование AIRIS.
			</p>
			<p class="text-sm text-gray-500">Последнее обновление: {lastUpdated}</p>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="grid gap-4 md:grid-cols-2">
			{#each documents as doc}
				<a
					href={doc.href}
					class="group rounded-2xl border border-gray-200/70 bg-white/80 p-6 shadow-sm hover:shadow-md transition-shadow"
				>
					<div class="flex items-start justify-between gap-4">
						<div class="space-y-2">
							<h2 class="text-lg font-semibold text-gray-900 group-hover:underline">
								{doc.title}
							</h2>
							<p class="text-sm text-gray-600">{doc.description}</p>
						</div>
						<span class="text-gray-400 group-hover:text-gray-700 transition-colors">→</span>
					</div>
				</a>
			{/each}
		</div>

		<div class="mt-10 rounded-2xl border border-gray-200/70 bg-white/80 p-6 text-sm text-gray-600">
			<p>
				Важно: документы публикуются в информационных целях. Для финальной редакции перед запуском в
				прод рекомендуется юридическая проверка.
			</p>
		</div>
	</section>
</PublicPageLayout>

