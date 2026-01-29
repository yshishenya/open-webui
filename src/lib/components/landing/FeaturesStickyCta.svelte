<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores';
	import { buildChatUrl, buildSignupUrl, openCta } from './welcomeNavigation';
	import { trackEvent } from '$lib/utils/analytics';

	export let source: string = 'features_sticky_cta';
	export let labelGuest: string = 'Начать бесплатно';
	export let labelAuthed: string = 'Перейти в чат';

	let showStickyCta = false;
	let stickyDismissed = false;

	$: ctaHref = $user ? buildChatUrl(source) : buildSignupUrl(source);

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
			sessionStorage.setItem('features_sticky_cta_dismissed', '1');
		}
	};

	const handleStickyCtaClick = (event: MouseEvent) => {
		event.preventDefault();
		trackEvent('features_sticky_cta_click');
		openCta(source);
	};

	onMount(() => {
		if (typeof window === 'undefined') return;
		stickyDismissed = sessionStorage.getItem('features_sticky_cta_dismissed') === '1';
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

{#if showStickyCta}
	<div class="features-sticky-cta md:hidden">
		<button
			type="button"
			class="features-sticky-close"
			aria-label="Закрыть"
			on:click={dismissStickyCta}
		>
			×
		</button>
		<a href={ctaHref} class="features-sticky-button" on:click={handleStickyCtaClick}>
			{$user ? labelAuthed : labelGuest}
		</a>
	</div>
{/if}

<style>
	:global(.features-sticky-cta) {
		position: fixed;
		left: 16px;
		right: 16px;
		bottom: calc(16px + env(safe-area-inset-bottom));
		background: #ffffff;
		border: 1px solid var(--features-border, #e7e7ea);
		border-radius: 999px;
		padding: 10px 14px;
		display: flex;
		align-items: center;
		gap: 12px;
		box-shadow: var(--features-shadow-sm, 0 12px 24px rgba(15, 23, 42, 0.08));
		z-index: 40;
	}

	:global(.features-sticky-button) {
		flex: 1;
		text-align: center;
		background: #111827;
		color: #ffffff;
		font-weight: 600;
		padding: 10px 16px;
		border-radius: 999px;
		font-size: 14px;
	}

	:global(.features-sticky-close) {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid var(--features-border, #e7e7ea);
		background: #f9fafb;
		color: #6b7280;
		font-size: 18px;
		line-height: 1;
	}
</style>
