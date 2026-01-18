<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { user } from '$lib/stores';
	import {
		HeroSection,
		OAuthButtons,
		FeaturesGrid,
		StatsSection,
		CTASection,
		FooterLinks,
		NavHeader
	} from '$lib/components/landing';

	let loaded = false;

	// Get redirect URL from query params
	$: redirectUrl = $page.url.searchParams.get('redirect') || '/';

	onMount(() => {
		// Redirect authenticated users to their intended destination
		if ($user) {
			goto(redirectUrl);
			return;
		}
		loaded = true;
	});

	// Also check for token in localStorage (for page refresh scenarios)
	$: if (typeof window !== 'undefined' && localStorage.getItem('token') && !loaded) {
		goto(redirectUrl);
	}

	const handleVKLogin = () => {
		window.location.href = '/api/v1/oauth/vk/login';
	};

	// Telegram widget callback
	if (typeof window !== 'undefined') {
		(window as any).onTelegramAuth = async (userData: any) => {
			try {
				const response = await fetch('/api/v1/oauth/telegram/callback', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(userData)
				});

				const data = await response.json();

				if (data.requires_email) {
					// Store temp session and redirect to email collection
					sessionStorage.setItem('telegram_temp_session', data.temp_session);
					sessionStorage.setItem('telegram_name', data.name);
					goto('/auth/telegram-complete');
				} else {
					// Login successful
					localStorage.setItem('token', data.token);
					goto(redirectUrl);
				}
			} catch (error) {
				console.error('Telegram auth error:', error);
			}
		};
	}

	// Get Telegram bot name from environment
	const telegramBotName = import.meta.env.PUBLIC_TELEGRAM_BOT_NAME || '';

	const heroImage =
		'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80';

	const steps = [
		{
			title: 'Выберите модель',
			description: 'Подберите AI под задачу - от быстрых черновиков до сложных анализов.'
		},
		{
			title: 'Сформулируйте запрос',
			description: 'Задайте контекст, прикрепите файлы и уточните формат ответа.'
		},
		{
			title: 'Получите результат',
			description: 'Сохраняйте чаты, делитесь ссылками и возвращайтесь к истории.'
		}
	];
</script>

<svelte:head>
	<title>AIris - Интеллектуальный AI-ассистент для работы</title>
	<meta name="description" content="Мощный AI-ассистент с поддержкой русского языка. Работайте с ChatGPT, Claude и другими моделями в одном месте." />
	<script async src="https://telegram.org/js/telegram-widget.js?22"></script>
</svelte:head>

{#if loaded}
<div class="min-h-screen bg-[radial-gradient(1200px_600px_at_15%_-10%,rgba(0,0,0,0.05),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(0,0,0,0.04),transparent),linear-gradient(180deg,#f7f7f8_0%,#ffffff_70%)] text-gray-900 font-primary">
	<!-- Navigation Header -->
	<NavHeader currentPath="/welcome" />

	<div class="container mx-auto px-4 pt-12 pb-16">
		<div class="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center motion-safe:animate-[fade-up_0.7s_ease]">
			<div class="space-y-8">
				<HeroSection
					title="AIris"
					subtitle="Работайте с AI-моделями в одном аккуратном интерфейсе"
					description="Пишите, анализируйте и принимайте решения быстрее. Оплата по факту использования, прозрачные лимиты и полный контроль данных."
					eyebrow="AI для работы и повседневных задач"
				/>

				<div class="flex flex-wrap gap-3">
					<a
						href="/auth"
						class="bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-900 transition-colors"
					>
						Начать бесплатно
					</a>
					<a
						href="/features"
						class="px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-semibold hover:border-gray-400 hover:text-gray-900 transition-colors"
					>
						Смотреть возможности
					</a>
				</div>

				<div class="grid sm:grid-cols-2 gap-4 text-sm text-gray-600">
					<div class="flex items-start gap-2">
						<span class="mt-2 h-2 w-2 rounded-full bg-green-500"></span>
						<div>Поддержка русского языка и локальная оплата</div>
					</div>
					<div class="flex items-start gap-2">
						<span class="mt-2 h-2 w-2 rounded-full bg-green-500"></span>
						<div>Безопасные настройки доступа для каждого пользователя</div>
					</div>
				</div>
			</div>

			<div class="relative">
				<div class="absolute -inset-4 rounded-[32px] bg-white/70 blur-2xl"></div>
				<img
					src={heroImage}
					alt="Рабочее пространство AIris"
					class="relative z-10 w-full rounded-[28px] border border-gray-200/70 shadow-sm object-cover"
					loading="lazy"
				/>
				<div class="absolute left-5 bottom-5 rounded-full border border-gray-200 bg-white/90 px-4 py-2 text-xs font-semibold text-gray-700">
					Интерфейс AIris
				</div>
			</div>
		</div>

		<section class="mt-16 grid md:grid-cols-3 gap-6">
			{#each steps as step, index}
				<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm">
					<div class="text-xs uppercase tracking-[0.2em] text-gray-500 mb-3">
						Шаг {index + 1}
					</div>
					<h3 class="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
					<p class="text-sm text-gray-600 leading-relaxed">{step.description}</p>
				</div>
			{/each}
		</section>

		<section class="mt-16">
			<div class="flex flex-col gap-3 max-w-2xl">
				<h2 class="text-2xl md:text-3xl font-semibold text-gray-900">Почему AIris удобен</h2>
				<p class="text-gray-600">
					Собрали ключевые преимущества, которые делают ежедневную работу с AI простой и предсказуемой.
				</p>
			</div>
			<div class="mt-6">
				<FeaturesGrid />
			</div>
		</section>

		<section class="mt-16">
			<div class="flex flex-col gap-3 max-w-2xl">
				<h2 class="text-2xl md:text-3xl font-semibold text-gray-900">Коротко в цифрах</h2>
				<p class="text-gray-600">Сервис растет вместе с пользователями и их задачами.</p>
			</div>
			<div class="mt-6">
				<StatsSection />
			</div>
		</section>

		<section class="mt-16 grid lg:grid-cols-[1fr_0.9fr] gap-8 items-center">
			<div>
				<h2 class="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
					Вход за минуту
				</h2>
				<p class="text-gray-600 mb-6">
					Подключайтесь через удобный способ входа и сразу переходите к работе. Можно использовать
					аккаунты ВКонтакте, Яндекса или классическую регистрацию.
				</p>
				<div class="grid sm:grid-cols-2 gap-4 text-sm text-gray-600">
					<div class="rounded-xl border border-gray-200/70 bg-white p-4">
						Не нужен отдельный пароль
					</div>
					<div class="rounded-xl border border-gray-200/70 bg-white p-4">
						Безопасная авторизация
					</div>
				</div>
			</div>
			<OAuthButtons {telegramBotName} />
		</section>

		<section class="mt-16">
			<CTASection onClick={handleVKLogin} />
		</section>

		<footer class="mt-16">
			<FooterLinks />
		</footer>
	</div>
</div>
{/if}

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
