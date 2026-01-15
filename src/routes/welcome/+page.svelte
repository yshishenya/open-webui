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
</script>

<svelte:head>
	<title>AIris - Интеллектуальный AI-ассистент для работы</title>
	<meta name="description" content="Мощный AI-ассистент с поддержкой русского языка. Работайте с ChatGPT, Claude и другими моделями в одном месте." />
	<script async src="https://telegram.org/js/telegram-widget.js?22"></script>
</svelte:head>

{#if loaded}
<div class="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
	<!-- Navigation Header -->
	<NavHeader currentPath="/welcome" />

	<!-- Hero Section -->
	<div class="container mx-auto px-4 py-16">
		<div class="text-center max-w-4xl mx-auto">
			<HeroSection />

			<!-- OAuth Buttons -->
			<OAuthButtons {telegramBotName} />

			<!-- Features Grid -->
			<FeaturesGrid />

			<!-- Stats Section -->
			<StatsSection />

			<!-- CTA Section -->
			<CTASection onClick={handleVKLogin} />

			<!-- Footer Links -->
			<FooterLinks />
		</div>
	</div>
</div>
{/if}

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
