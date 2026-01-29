<script lang="ts">
	import { onMount } from 'svelte';
	import type { PublicLeadMagnetConfig } from '$lib/apis/billing';
	import { openCta } from './welcomeNavigation';
	import WelcomeExamplesSection from './WelcomeExamplesSection.svelte';
	import WelcomeHowSection from './WelcomeHowSection.svelte';
	import WelcomeFeaturesSection from './WelcomeFeaturesSection.svelte';
	import WelcomeUsecasesSection from './WelcomeUsecasesSection.svelte';
	import WelcomePricingSection from './WelcomePricingSection.svelte';
	import WelcomeFaqSection from './WelcomeFaqSection.svelte';

	export let leadMagnetConfig: PublicLeadMagnetConfig | null = null;

	let showStickyCta = false;
	let stickyDismissed = false;
	let audioEnabled = true;

	const resolveAudioEnabled = (config: PublicLeadMagnetConfig | null): boolean => {
		if (!config) return true;
		const { tts_seconds, stt_seconds } = config.quotas;
		return tts_seconds > 0 || stt_seconds > 0;
	};

	$: audioEnabled = resolveAudioEnabled(leadMagnetConfig);

	const updateStickyCta = () => {
		if (typeof window === 'undefined') return;
		if (stickyDismissed) {
			showStickyCta = false;
			return;
		}
		const isMobile = window.innerWidth < 768;
		const scrolled = window.scrollY > window.innerHeight * 0.3;
		showStickyCta = isMobile && scrolled;
	};

	const dismissStickyCta = () => {
		stickyDismissed = true;
		showStickyCta = false;
		if (typeof window !== 'undefined') {
			sessionStorage.setItem('welcome_sticky_cta_dismissed', '1');
		}
	};

	const handleStickyCtaClick = (event: MouseEvent) => {
		event.preventDefault();
		openCta('welcome_sticky_cta');
	};

	onMount(() => {
		if (typeof window === 'undefined') return;
		stickyDismissed = sessionStorage.getItem('welcome_sticky_cta_dismissed') === '1';
		updateStickyCta();

		const handleScroll = () => updateStickyCta();
		const handleResize = () => updateStickyCta();

		window.addEventListener('scroll', handleScroll, { passive: true });
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<WelcomeExamplesSection {audioEnabled} />
<WelcomeHowSection />
<WelcomeFeaturesSection {audioEnabled} />
<WelcomeUsecasesSection />
<WelcomePricingSection {leadMagnetConfig} />
<WelcomeFaqSection />

{#if showStickyCta}
	<div class="welcome-sticky-cta md:hidden">
		<button
			type="button"
			class="welcome-sticky-close"
			aria-label="Закрыть"
			on:click={dismissStickyCta}
		>
			×
		</button>
		<a
			href="/signup?src=welcome_sticky_cta"
			class="welcome-sticky-button"
			on:click={handleStickyCtaClick}
		>
			Начать бесплатно
		</a>
	</div>
{/if}

<style>
	:global(:root) {
		--section-y-desktop: 88px;
		--section-y-tablet: 72px;
		--section-y-mobile: 56px;
		--bg-soft: #f7f7f8;
		--border: #e7e7ea;
		--shadow-sm: 0 12px 24px rgba(15, 23, 42, 0.08);
		--shadow-md: 0 16px 32px rgba(15, 23, 42, 0.12);
	}

	:global(.welcome-section) {
		padding-block: var(--section-y-desktop);
	}

	:global(.welcome-section--soft) {
		background: var(--bg-soft);
	}

	:global(.welcome-section--divider) {
		border-top: 1px solid var(--border);
	}

	:global(.welcome-card) {
		background: #ffffff;
		border: 1px solid var(--border);
		border-radius: 16px;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			border-color 0.18s ease;
	}

	:global(.welcome-card--soft) {
		box-shadow: var(--shadow-sm);
	}

	:global(.welcome-card--flat) {
		box-shadow: none;
	}

	:global(.welcome-card--clickable) {
		cursor: pointer;
	}

	@media (hover: hover) {
		:global(.welcome-card--clickable:hover) {
			transform: translateY(-2px);
			box-shadow: var(--shadow-md);
		}
	}

	@media (max-width: 1023px) {
		:global(.welcome-section) {
			padding-block: var(--section-y-tablet);
		}
	}

	@media (max-width: 767px) {
		:global(.welcome-section) {
			padding-block: var(--section-y-mobile);
		}
	}

	.welcome-sticky-cta {
		position: fixed;
		left: 16px;
		right: 16px;
		bottom: calc(16px + env(safe-area-inset-bottom));
		background: #ffffff;
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 10px 14px;
		display: flex;
		align-items: center;
		gap: 12px;
		box-shadow: var(--shadow-sm);
		z-index: 40;
	}

	.welcome-sticky-button {
		flex: 1;
		text-align: center;
		background: #111827;
		color: #ffffff;
		font-weight: 600;
		padding: 10px 16px;
		border-radius: 999px;
		font-size: 14px;
	}

	.welcome-sticky-close {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: #f9fafb;
		color: #6b7280;
		font-size: 18px;
		line-height: 1;
	}
</style>
