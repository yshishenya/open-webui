<script lang="ts">
	import { WEBUI_BASE_URL } from '$lib/constants';

	export let currentPath: string = '';

	interface NavLink {
		href: string;
		label: string;
	}

	const navLinks: NavLink[] = [
		{ href: '/features', label: 'Возможности' },
		{ href: '/pricing', label: 'Тарифы' },
		{ href: '/about', label: 'О нас' },
		{ href: '/contact', label: 'Контакты' }
	];

	let mobileMenuOpen = false;

	function isActive(href: string): boolean {
		return currentPath === href;
	}
</script>

<nav class="bg-white/80 backdrop-blur-md border-b border-gray-200/70 sticky top-0 z-50">
	<div class="container mx-auto px-4">
		<div class="flex items-center justify-between h-16">
			<!-- Logo -->
			<a href="/welcome" class="flex items-center gap-2">
				<div
					class="w-9 h-9 bg-white rounded-lg border border-gray-200 shadow-sm flex items-center justify-center"
				>
					<img
						src="{WEBUI_BASE_URL}/static/favicon.svg"
						class="w-7 h-7"
						alt="AIris logo"
						draggable="false"
					/>
				</div>
				<span class="font-semibold text-lg text-gray-900 tracking-tight">AIris</span>
			</a>

			<!-- Desktop Navigation -->
			<div class="hidden md:flex items-center gap-8">
				{#each navLinks as link}
					<a
						href={link.href}
						class="text-sm font-medium transition-colors border-b-2 border-transparent pb-1 {isActive(link.href)
							? 'text-gray-900 border-gray-900'
							: 'text-gray-500 hover:text-gray-900'}"
					>
						{link.label}
					</a>
				{/each}
			</div>

			<!-- Auth Buttons -->
			<div class="hidden md:flex items-center gap-4">
				<a
					href="/auth"
					class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
				>
					Войти
				</a>
				<a
					href="/auth"
					class="px-4 py-2 bg-black hover:bg-gray-900 text-white text-sm font-medium rounded-full transition-colors"
				>
					Начать бесплатно
				</a>
			</div>

			<!-- Mobile Menu Button -->
			<button
				class="md:hidden p-2 text-gray-600 hover:text-gray-900"
				on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
				aria-label="Toggle menu"
			>
				{#if mobileMenuOpen}
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				{:else}
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				{/if}
			</button>
		</div>

		<!-- Mobile Menu -->
		{#if mobileMenuOpen}
			<div class="md:hidden py-4 border-t border-gray-200/70">
				<div class="flex flex-col gap-4">
					{#each navLinks as link}
						<a
							href={link.href}
							class="text-sm font-medium px-2 py-1 {isActive(link.href)
								? 'text-gray-900'
								: 'text-gray-600'}"
							on:click={() => (mobileMenuOpen = false)}
						>
							{link.label}
						</a>
					{/each}
					<div class="flex flex-col gap-2 pt-4 border-t border-gray-200/70">
						<a
							href="/auth"
							class="text-sm font-medium text-gray-600 px-2 py-1"
						>
							Войти
						</a>
						<a
							href="/auth"
							class="px-4 py-2 bg-black text-white text-sm font-medium rounded-full text-center"
						>
							Начать бесплатно
						</a>
					</div>
				</div>
			</div>
		{/if}
	</div>
</nav>
