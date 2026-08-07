<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const heroImage = '/landing/airis-chat.png';

	const steps = [
		{
			number: '01',
			title: 'Выберите задачу',
			description: 'Напишите запрос своими словами или начните с готового примера.'
		},
		{
			number: '02',
			title: 'Выберите модель',
			description: 'Доступные в Airis модели собраны в одном чате — без отдельных сервисов и VPN.'
		},
		{
			number: '03',
			title: 'Получите результат',
			description: 'Продолжайте диалог, уточняйте ответ и следите за расходами в кабинете.'
		}
	];
</script>

<PublicPageLayout
	title="О проекте"
	description="Airis — проект для работы с доступными AI-моделями в одном чате без VPN."
	showHero={false}
>
	<section class="container mx-auto px-4 pt-12 pb-14 md:pt-16 md:pb-20">
		<div class="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
			<div class="space-y-6">
				<span
					class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600"
				>
					О проекте
				</span>
				<h1 class="text-4xl font-semibold leading-[1.05] tracking-tight text-gray-900 md:text-5xl">
					Один понятный чат для разных AI-моделей
				</h1>
				<p class="max-w-xl text-lg leading-relaxed text-gray-600">
					Airis — веб-сервис, который собирает доступные AI-модели в одном месте. Можно работать с
					текстом, файлами, изображениями и аудио там, где эти функции доступны выбранной модели.
				</p>
				<div class="flex flex-wrap gap-3">
					<a
						href="/signup?src=about_project"
						class="rounded-full bg-[#7132f2] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#6427e8]"
					>
						Открыть Airis
					</a>
					<a
						href="/features"
						class="rounded-full border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900"
					>
						Посмотреть возможности
					</a>
				</div>
			</div>

			<div
				class="rounded-[28px] border border-gray-200/80 bg-white/80 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
			>
				<img
					src={heroImage}
					alt="Чат Airis с выбором AI-модели"
					width="2640"
					height="1534"
					class="w-full rounded-[22px] border border-gray-200/70 object-cover"
					loading="eager"
				/>
			</div>
		</div>
	</section>

	<section class="border-y border-gray-200/70 bg-white/70">
		<div class="container mx-auto px-4 py-14 md:py-16">
			<div class="max-w-2xl">
				<h2 class="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
					Как устроен проект
				</h2>
				<p class="mt-3 text-gray-600">
					Вместо переключения между разными интерфейсами вы решаете задачу в одном диалоге.
				</p>
			</div>

			<div class="mt-8 grid gap-4 md:grid-cols-3">
				{#each steps as step}
					<article class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
						<div class="text-sm font-semibold tracking-[0.18em] text-[#7132f2]">{step.number}</div>
						<h3 class="mt-5 text-lg font-semibold text-gray-900">{step.title}</h3>
						<p class="mt-2 text-sm leading-relaxed text-gray-600">{step.description}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 py-14 md:py-16">
		<div class="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start">
			<div>
				<h2 class="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
					Что важно знать
				</h2>
			</div>
			<div class="space-y-4 text-gray-600">
				<p>
					Airis не является отдельной AI-моделью. Это единый интерфейс, через который можно
					пользоваться моделями, доступными в текущей конфигурации сервиса.
				</p>
				<p>
					Набор моделей, функций и стоимость могут меняться. Перед использованием проверяйте
					актуальные данные в разделе возможностей и в кабинете.
				</p>
				<p>
					Проект развивается вокруг простой идеи: дать пользователю понятный способ выбрать
					подходящий инструмент и сразу перейти к задаче.
				</p>
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div class="rounded-[28px] bg-[#17131f] px-6 py-10 text-center text-white md:px-10">
			<h2 class="text-2xl font-semibold md:text-3xl">Попробуйте Airis на своей задаче</h2>
			<p class="mx-auto mt-3 max-w-xl text-white/70">
				Начните с готового примера или откройте пустой чат.
			</p>
			<a
				href="/signup?src=about_project_cta"
				class="mt-6 inline-flex rounded-full bg-white px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-100"
			>
				Начать бесплатно
			</a>
		</div>
	</section>
</PublicPageLayout>
