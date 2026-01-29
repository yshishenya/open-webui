<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { user } from '$lib/stores';
	import { getPublicLeadMagnetConfig } from '$lib/apis/billing';
	import type { PublicLeadMagnetConfig } from '$lib/apis/billing';
	import { trackEvent } from '$lib/utils/analytics';
	import { buildSignupUrl, openCta, openPreset } from '$lib/components/landing/welcomeNavigation';
	import { presetsById } from '$lib/data/features';
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
	$: if (
		typeof window !== 'undefined' &&
		localStorage.getItem('token') &&
		!loaded &&
		shouldAutoRedirect
	) {
		goto(redirectUrl);
	}

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

	const heroImage = '/landing/airis-hero.webp';
	const heroImage2x = '/landing/airis-hero@2x.webp';
	const heroImageFallback = '/landing/airis-hero.png';
	const heroImageFallback2x = '/landing/airis-hero@2x.png';
	const heroImageWidth = 1200;
	const heroImageHeight = 697;

	const trustChips = [
		'Без VPN',
		'Оплата в ₽',
		'Без подписки и ежемесячных платежей',
		'Списания идут только за использование',
		'Бесплатный старт'
	];

	const presetIds = ['social_post', 'resume', 'email_reply', 'image_generate'];
	const presets = presetIds
		.map((id) => ({
			id,
			label: presetsById[id]?.title ?? id,
			prompt: presetsById[id]?.prompt ?? ''
		}))
		.filter((preset) => preset.prompt);

	const heroPrimaryHref = buildSignupUrl('welcome_hero_primary');
	const finalCtaHref = buildSignupUrl('welcome_final_cta');

	const handleHeroPrimaryClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('welcome_hero_primary_click');
		openCta('welcome_hero_primary');
	};

	const handleExamplesClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('welcome_hero_examples_click');
		document.getElementById('examples')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const handlePresetClick = (preset: { id: string; prompt: string }) => {
		trackEvent('welcome_hero_preset_click', { preset: preset.id });
		openPreset('welcome_hero_preset', preset.id, preset.prompt);
	};

	const handleFinalCtaClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('welcome_final_cta_click');
		openCta('welcome_final_cta');
	};
</script>

<svelte:head>
	<title>AIris - Интеллектуальный AI-ассистент для работы</title>
	<meta
		name="description"
		content="Мощный AI-ассистент с поддержкой русского языка. Работайте с GPT-5.2, Gemini и другими моделями в одном месте."
	/>
</svelte:head>

{#if loaded}
	<div class="min-h-screen bg-white text-gray-900 font-primary">
		<!-- Navigation Header -->
		<NavHeader currentPath="/welcome" />

		<section
			class="relative overflow-hidden bg-[radial-gradient(1200px_600px_at_15%_-10%,rgba(0,0,0,0.05),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(0,0,0,0.04),transparent),linear-gradient(180deg,#f7f7f8_0%,#ffffff_70%)]"
		>
			<div class="mx-auto max-w-[1200px] px-4 pt-12 md:pt-16 pb-10 md:pb-14">
				<div class="relative isolate">
					<div aria-hidden="true" class="pointer-events-none -z-10 absolute inset-0">
						<div
							class="absolute -top-24 -right-32 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.12),transparent_70%)]"
						></div>
						<div
							class="absolute -left-16 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_70%)]"
						></div>
					</div>
					<div
						class="relative z-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center motion-safe:animate-[fade-up_0.7s_ease]"
					>
						<div class="space-y-6">
							<div
								class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[12px] font-medium text-gray-600"
							>
								Без VPN • Оплата в ₽ • Бесплатный старт
							</div>
							<h1
								class="text-[32px] md:text-[40px] xl:text-[48px] font-bold tracking-tight text-gray-900 leading-[1.08]"
							>
								Тексты и изображения за минуты — в одном чате
							</h1>
							<p
								class="text-[15px] md:text-[16px] font-medium leading-[1.5] text-gray-600 max-w-xl"
							>
								Посты, письма, резюме, объявления и картинки — быстро и просто. Начните бесплатно
								без карты. Когда понадобится больше — пополняете баланс, и списания идут только за
								использование. Никаких подписок и ежемесячных платежей.
							</p>

							<div class="flex flex-col sm:flex-row gap-3">
								<a
									href={heroPrimaryHref}
									class="inline-flex items-center justify-center h-11 md:h-10 px-6 rounded-full bg-black text-white text-sm font-semibold hover:bg-gray-900 transition-colors w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
									on:click={handleHeroPrimaryClick}
								>
									Начать бесплатно
								</a>
								<a
									href="#examples"
									class="inline-flex items-center justify-center h-11 md:h-10 px-6 rounded-full border border-gray-300 text-gray-700 text-sm font-semibold hover:border-gray-400 hover:text-gray-900 transition-colors w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
									on:click={handleExamplesClick}
								>
									Посмотреть примеры
								</a>
							</div>

							<div class="text-[12px] font-medium text-gray-500">
								Без карты • Без подписки и ежемесячных платежей
							</div>

							<div class="flex flex-wrap gap-2">
								{#each trustChips as item}
									<div
										class="rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-[12px] font-medium text-gray-700"
									>
										{item}
									</div>
								{/each}
							</div>

							<div class="space-y-3">
								<div class="text-xs font-semibold text-gray-600">Попробовать задачу:</div>
								<div class="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1">
									{#each presets as preset}
										<button
											type="button"
											class="shrink-0 rounded-full border border-gray-200 bg-white/90 px-4 py-2 text-[12px] font-medium text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
											on:click={() => handlePresetClick(preset)}
										>
											{preset.label}
										</button>
									{/each}
								</div>
							</div>
						</div>

						<div class="relative">
							<div
								class="relative rounded-[32px] border border-white/10 bg-[#0b0d12] px-4 pb-6 pt-5 shadow-[0_40px_80px_rgba(15,23,42,0.25)]"
							>
								<div
									class="absolute inset-0 rounded-[32px] bg-[radial-gradient(70%_60%_at_50%_0%,rgba(255,255,255,0.08),rgba(0,0,0,0))]"
								></div>
								<div class="relative z-10 rounded-[26px] bg-[#0f1218] p-2 ring-1 ring-white/10">
									<picture>
										<source type="image/webp" srcset={`${heroImage} 1x, ${heroImage2x} 2x`} />
										<img
											src={heroImageFallback}
											srcset={`${heroImageFallback} 1x, ${heroImageFallback2x} 2x`}
											alt="Интерфейс Airis: чат для создания текстов и изображений"
											class="w-full rounded-[20px] border border-white/5 object-cover"
											loading="eager"
											decoding="async"
											fetchpriority="high"
											width={heroImageWidth}
											height={heroImageHeight}
										/>
									</picture>
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
			</div>
		</section>

		<WelcomePhaseOneSections {leadMagnetConfig} />

		<section id="cta" class="welcome-section welcome-section--cta">
			<div class="mx-auto max-w-[1200px] px-4">
				<CTASection
					title="Готовы попробовать Airis?"
					description="Начните бесплатно без карты. Без VPN, оплата в ₽. Без подписки и ежемесячных платежей — списания идут только за использование."
					buttonText="Начать бесплатно"
					buttonHref={finalCtaHref}
					tone="dark"
					onClick={handleFinalCtaClick}
				/>
			</div>
		</section>

		<footer class="welcome-footer">
			<div class="mx-auto max-w-[1200px] px-4 pb-24 md:pb-16">
				<FooterLinks />
			</div>
		</footer>
	</div>
{/if}

<style>
	:global(body) {
		overflow-x: hidden;
	}

	:global(section[id]) {
		scroll-margin-top: 88px;
	}

	@media (max-width: 767px) {
		:global(section[id]) {
			scroll-margin-top: 72px;
		}
	}

	:global(.welcome-section.welcome-section--cta) {
		padding-block: 64px;
		background: #0b0d12;
	}
</style>
