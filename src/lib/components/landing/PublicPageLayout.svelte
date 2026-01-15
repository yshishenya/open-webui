<script lang="ts">
	import NavHeader from './NavHeader.svelte';
	import FooterLinks from './FooterLinks.svelte';
	import { page } from '$app/stores';

	export let title: string = '';
	export let description: string = '';
	export let showHero: boolean = false;
	export let heroTitle: string = '';
	export let heroSubtitle: string = '';
</script>

<svelte:head>
	{#if title}
		<title>{title} - AIris</title>
	{/if}
	{#if description}
		<meta name="description" content={description} />
	{/if}
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex flex-col">
	<NavHeader currentPath={$page.url.pathname} />

	{#if showHero}
		<div class="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-16">
			<div class="container mx-auto px-4 text-center">
				<h1 class="text-4xl md:text-5xl font-bold mb-4">{heroTitle}</h1>
				{#if heroSubtitle}
					<p class="text-xl text-purple-100 max-w-2xl mx-auto">{heroSubtitle}</p>
				{/if}
			</div>
		</div>
	{/if}

	<main class="flex-1">
		<slot />
	</main>

	<footer class="bg-white border-t border-gray-100 py-8">
		<div class="container mx-auto px-4 text-center">
			<FooterLinks copyright="2025 AIris. Все права защищены." />
		</div>
	</footer>
</div>

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
