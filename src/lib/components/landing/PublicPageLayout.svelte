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
</script>

<svelte:head>
	{#if title}
		<title>{title} - AIris</title>
	{/if}
	{#if description}
		<meta name="description" content={description} />
	{/if}
</svelte:head>

<div
	class="min-h-screen bg-[radial-gradient(1200px_600px_at_15%_-10%,rgba(0,0,0,0.05),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(0,0,0,0.04),transparent),linear-gradient(180deg,#f7f7f8_0%,#ffffff_70%)] text-gray-900 flex flex-col font-primary"
>
	<NavHeader currentPath={$page.url.pathname} />

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

	<main class="flex-1">
		<slot />
	</main>

	<footer class="bg-white/80 border-t border-gray-200/70 py-8">
		<div class="container mx-auto px-4">
			<FooterLinks copyright="2025 AIris. Все права защищены." />
		</div>
	</footer>
</div>

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
