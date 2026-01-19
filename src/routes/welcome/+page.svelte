<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { user } from '$lib/stores';
	import { getPublicLeadMagnetConfig } from '$lib/apis/billing';
	import type { PublicLeadMagnetConfig } from '$lib/apis/billing';
	import {
		WelcomePhaseOneSections,
		CTASection,
		FooterLinks,
		NavHeader
	} from '$lib/components/landing';

	let loaded = false;
	let leadMagnetConfig: PublicLeadMagnetConfig | null = null;

	// Get redirect URL from query params
	$: redirectParam = $page.url.searchParams.get('redirect');
	$: redirectUrl = redirectParam || '/';
	$: shouldAutoRedirect = Boolean(redirectParam);

	const loadLeadMagnetConfig = async () => {
		try {
			leadMagnetConfig = await getPublicLeadMagnetConfig();
		} catch (error) {
			console.error('Failed to load lead magnet config:', error);
		}
	};

	onMount(() => {
		// Redirect authenticated users to their intended destination
		if ($user && shouldAutoRedirect) {
			goto(redirectUrl);
			return;
		}
		loaded = true;
		void loadLeadMagnetConfig();
	});

	// Also check for token in localStorage (for page refresh scenarios)
	$: if (typeof window !== 'undefined' && localStorage.getItem('token') && !loaded && shouldAutoRedirect) {
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

	const heroImage = '/landing/airis-chat.png';

	const modelHighlights = [
		{ name: 'GPT-5.2', provider: 'OpenAI', status: 'available' },
		{ name: 'Gemini 3', provider: 'Google', status: 'available' }
	];
</script>

<svelte:head>
	<title>AIris - Интеллектуальный AI-ассистент для работы</title>
	<meta name="description" content="Мощный AI-ассистент с поддержкой русского языка. Работайте с GPT-5.2, Gemini и другими моделями в одном месте." />
</svelte:head>

{#if loaded}
<div class="min-h-screen bg-[radial-gradient(1200px_600px_at_15%_-10%,rgba(0,0,0,0.05),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(0,0,0,0.04),transparent),linear-gradient(180deg,#f7f7f8_0%,#ffffff_70%)] text-gray-900 font-primary">
	<!-- Navigation Header -->
	<NavHeader currentPath="/welcome" />

	<div class="container mx-auto px-4 pt-12 pb-16">
		<div class="relative">
			<div class="absolute -top-24 -right-32 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.12),transparent_70%)]"></div>
			<div class="absolute -left-16 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_70%)]"></div>
			<div class="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center motion-safe:animate-[fade-up_0.7s_ease]">
				<div class="space-y-8">
					<div class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600">
						GPT-5.2 и Gemini 3 в одном интерфейсе
					</div>
					<h1 class="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.05]">
						Все ведущие AI‑модели в одном окне
					</h1>
					<p class="text-lg md:text-xl text-gray-600 max-w-xl">
						Без VPN, с оплатой в рублях и бесплатным стартом.
					</p>
					<p class="text-base text-gray-600 max-w-xl">
						Пишите, анализируйте и создавайте контент быстрее в одном чате.
					</p>

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

					<div class="flex flex-wrap gap-3">
						{#each ['Без VPN', 'PAYG без подписок', 'Оплата в рублях', 'Бесплатный старт'] as item}
							<div class="rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-xs font-semibold text-gray-700">
								{item}
							</div>
						{/each}
					</div>

					<div class="flex flex-wrap gap-3">
						{#each modelHighlights as model}
							<div class="flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-xs font-semibold text-gray-700">
								<span>{model.name}</span>
								<span class="text-[0.65rem] font-medium text-gray-500">{model.provider}</span>
							</div>
						{/each}
					</div>

					<div class="rounded-2xl border border-gray-200/70 bg-white/90 p-4 text-sm text-gray-700">
						<div class="font-semibold text-gray-900">Можно начать бесплатно</div>
						<div class="mt-2 text-xs text-gray-500">
							Стартуйте без карты и оцените сервис на бесплатных лимитах.
						</div>
					</div>
				</div>

				<div class="relative">
					<div class="relative rounded-[32px] border border-white/10 bg-[#0b0d12] px-4 pb-6 pt-5 shadow-[0_40px_80px_rgba(15,23,42,0.25)]">
						<div class="absolute inset-0 rounded-[32px] bg-[radial-gradient(70%_60%_at_50%_0%,rgba(255,255,255,0.08),rgba(0,0,0,0))]"></div>
						<div class="relative z-10 rounded-[26px] bg-[#0f1218] p-2 ring-1 ring-white/10">
							<img
								src={heroImage}
								alt="Интерфейс AIris"
								class="w-full rounded-[20px] border border-white/5 object-cover"
								loading="lazy"
							/>
						</div>
						<div class="absolute right-6 bottom-6 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs font-semibold text-white">
							Интерфейс AIris
						</div>
					</div>
				</div>
			</div>
		</div>

		<WelcomePhaseOneSections {leadMagnetConfig} />

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
