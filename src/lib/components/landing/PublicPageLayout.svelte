<script lang="ts">
	import NavHeader from './NavHeader.svelte';
	import FooterLinks from './FooterLinks.svelte';
	import { page } from '$app/stores';

	export let title: string = '';
	export let description: string = '';
	export let showHero: boolean = false;
	export let heroTitle: string = '';
	export let heroSubtitle: string = '';
	export let heroEyebrow: string = '';
	export let heroImage: string = '';
	export let heroImageAlt: string = '';
	export let tone: 'light' | 'dark' = 'dark';
</script>

<svelte:head>
	{#if title}
		<title>{title} - Airis</title>
	{/if}
	{#if description}
		<meta name="description" content={description} />
	{/if}
</svelte:head>

<div class="public-page airis-public-page min-h-screen flex flex-col" data-tone={tone}>
	<NavHeader currentPath={$page.url.pathname} {tone} />

	{#if showHero}
		<section class="container mx-auto px-4 pt-14 pb-12">
			<div
				class={`grid items-center gap-10 ${heroImage ? 'md:grid-cols-[1.1fr_0.9fr]' : ''} motion-safe:animate-[fade-up_0.6s_ease]`}
			>
				<div class="space-y-6">
					{#if heroEyebrow}
						<span
							class="inline-flex items-center rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-600"
						>
							{heroEyebrow}
						</span>
					{/if}
					<h1 class="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
						{heroTitle}
					</h1>
					{#if heroSubtitle}
						<p class="text-lg md:text-xl text-gray-600 max-w-2xl">
							{heroSubtitle}
						</p>
					{/if}
				</div>
				{#if heroImage}
					<div class="relative">
						<div class="absolute -inset-4 rounded-[32px] bg-white/70 blur-2xl"></div>
						<img
							src={heroImage}
							alt={heroImageAlt}
							class="relative z-10 w-full rounded-[28px] border border-gray-200/70 shadow-sm object-cover"
							loading="lazy"
						/>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	<main id="main-content" class="flex-1">
		<slot />
	</main>

	<footer class="public-page__footer airis-public-footer border-t py-8">
		<div class="container mx-auto px-4">
			<FooterLinks tone={tone} copyright={`${new Date().getFullYear()} Airis. Все права защищены.`} />
		</div>
	</footer>
</div>

<style>
	:global(body) {
		overflow-x: hidden;
	}

	.public-page__footer {
		background: transparent;
	}

	:global(.public-page section[id]) {
		scroll-margin-top: 88px;
	}
</style>
