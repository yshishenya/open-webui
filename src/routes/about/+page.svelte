<script lang="ts">
	import { PublicPageLayout } from '$lib/components/landing';

	const heroImage = '/landing/airis-chat.png';

	const values = [
		{
			title: 'Безопасность',
			description: 'Защита данных и контроль доступа — основа доверия к сервису.'
		},
		{
			title: 'Надежность',
			description: 'Стабильная работа и предсказуемый результат каждый день.'
		},
		{
			title: 'Поддержка',
			description: 'Быстро отвечаем и говорим с пользователями на одном языке.'
		}
	];
</script>

<PublicPageLayout
	title="О нас"
	description="AIris — сервис, который делает AI доступным и понятным для повседневных задач."
	showHero={false}
>
	<section class="container mx-auto px-4 pt-12 pb-12">
		<div class="relative">
			<div
				class="absolute -top-20 -right-32 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.12),transparent_70%)]"
			></div>
			<div
				class="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_70%)]"
			></div>
			<div class="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
				<div class="space-y-6">
					<span
						class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600"
					>
						О компании
					</span>
					<h1
						class="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.05]"
					>
						AIris — доступный и понятный AI
					</h1>
					<p class="text-lg md:text-xl text-gray-600 max-w-xl">
						Мы делаем работу с AI удобной для реальных задач.
					</p>
					<div class="flex flex-wrap gap-3">
						<a
							href="/auth"
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

				<div class="relative">
					<div
						class="relative h-[360px] overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0d12] px-4 pb-6 pt-6 shadow-[0_40px_80px_rgba(15,23,42,0.25)] sm:h-[420px]"
					>
						<div
							class="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(255,255,255,0.08),rgba(0,0,0,0))]"
						></div>
						<div
							class="absolute -left-2 top-10 w-[78%] max-w-[520px] -rotate-[10deg] rounded-[26px] border border-white/10 bg-[#0f1218]/80 p-2 shadow-[0_30px_70px_rgba(0,0,0,0.5)]"
						>
							<img
								src={heroImage}
								alt="Интерфейс AIris"
								class="h-full w-full rounded-[20px] border border-white/5 object-cover"
								loading="lazy"
							/>
						</div>
						<div
							class="absolute right-8 top-14 w-[78%] max-w-[540px] rotate-[4deg] rounded-[26px] border border-white/10 bg-[#0f1218]/90 p-2 shadow-[0_35px_80px_rgba(0,0,0,0.55)]"
						>
							<img
								src={heroImage}
								alt="Интерфейс AIris"
								class="h-full w-full rounded-[20px] border border-white/5 object-cover"
								loading="lazy"
							/>
						</div>
						<div
							class="absolute left-1/2 top-[52%] w-[78%] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/15 bg-[#0f1218] p-2 shadow-[0_40px_90px_rgba(0,0,0,0.6)]"
						>
							<img
								src={heroImage}
								alt="Интерфейс AIris"
								class="h-full w-full rounded-[22px] border border-white/10 object-cover"
								loading="lazy"
							/>
						</div>
						<div
							class="absolute right-6 bottom-6 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs font-semibold text-white"
						>
							Интерфейс AIris
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-12">
		<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
			<div class="grid md:grid-cols-2 gap-8 items-start">
				<div>
					<h2 class="text-2xl font-semibold text-gray-900 mb-4">Наша миссия</h2>
					<p class="text-gray-600 leading-relaxed">
						Сделать современные AI‑модели доступными без сложных настроек и лишних сервисов.
					</p>
				</div>
				<div>
					<h2 class="text-2xl font-semibold text-gray-900 mb-4">Наш подход</h2>
					<p class="text-gray-600 leading-relaxed">
						Мы проектируем продукт так, чтобы каждое действие было очевидным: выбор модели, оплата,
						контроль данных и поддержка.
					</p>
				</div>
			</div>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-12">
		<div class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm">
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
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16">
		<div
			class="rounded-[32px] border border-gray-200/70 bg-white/80 p-8 md:p-10 shadow-sm text-center"
		>
			<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 mb-3">Присоединяйтесь к AIris</h2>
			<p class="text-gray-600 mb-6">
				Начните бесплатно и убедитесь, что AI‑инструменты могут быть простыми.
			</p>
			<div class="flex flex-wrap justify-center gap-4">
				<a
					href="/auth"
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
</PublicPageLayout>
