<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { user } from '$lib/stores';
	import { getPublicLeadMagnetConfig, getPublicRateCards } from '$lib/apis/billing';
	import type { PublicLeadMagnetConfig, PublicRateCardResponse } from '$lib/apis/billing';
	import { sanitizeRedirectPath } from '$lib/utils/airis/return_to';
	import { NavHeader, WelcomeProductLanding } from '$lib/components/landing';

	type TelegramAuthPayload = {
		id: number;
		first_name?: string;
		last_name?: string;
		username?: string;
		photo_url?: string;
		auth_date: number;
		hash: string;
		[key: string]: string | number | undefined;
	};

	type TelegramAuthResponse = {
		requires_email?: boolean;
		temp_session?: string;
		name?: string;
		token?: string;
	};

	let leadMagnetConfig: PublicLeadMagnetConfig | null = null;
	let rateCard: PublicRateCardResponse | null = null;

	// Get redirect URL from query params
	$: redirectParam = sanitizeRedirectPath($page.url.searchParams.get('redirect'));
	$: redirectUrl = redirectParam || '/';
	$: shouldAutoRedirect = Boolean(redirectParam);

	const loadPublicLandingConfig = async (): Promise<void> => {
		[leadMagnetConfig, rateCard] = await Promise.all([
			getPublicLeadMagnetConfig(),
			getPublicRateCards()
		]);
	};

	onMount(() => {
		// Redirect authenticated users to their intended destination
		if ($user && shouldAutoRedirect) {
			goto(redirectUrl);
			return;
		}
		void loadPublicLandingConfig();
	});

	// Also check for token in localStorage (for page refresh scenarios)
	$: if (typeof window !== 'undefined' && localStorage.getItem('token') && shouldAutoRedirect) {
		goto(redirectUrl);
	}

	// Telegram widget callback
	if (typeof window !== 'undefined') {
		const windowWithTelegramAuth = window as Window & {
			onTelegramAuth?: (userData: TelegramAuthPayload) => Promise<void>;
		};

		windowWithTelegramAuth.onTelegramAuth = async (userData: TelegramAuthPayload) => {
			try {
				const response = await fetch('/api/v1/oauth/telegram/callback', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(userData)
				});

				const data = (await response.json()) as TelegramAuthResponse;

				if (data.requires_email && data.temp_session && data.name) {
					// Store temp session and redirect to email collection
					sessionStorage.setItem('telegram_temp_session', data.temp_session);
					sessionStorage.setItem('telegram_name', data.name);
					goto('/auth/telegram-complete');
				} else if (data.token) {
					// Login successful
					localStorage.setItem('token', data.token);
					goto(redirectUrl);
				}
			} catch (error) {
				console.error('Telegram auth error:', error);
			}
		};
	}
</script>

<svelte:head>
	<title>AI-модели без VPN — в одном чате | Airis</title>
	<meta
		name="description"
		content="GPT, Claude, Gemini и другие доступные AI-модели в Airis. Работайте без VPN, начинайте бесплатно и пополняйте баланс в рублях без обязательной подписки."
	/>
</svelte:head>

<div class="min-h-screen bg-[#17112f] text-white font-primary">
	<NavHeader currentPath="/welcome" />
	<WelcomeProductLanding {leadMagnetConfig} {rateCard} />
</div>
