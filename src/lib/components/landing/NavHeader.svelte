<script lang="ts">
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

<nav class="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
	<div class="container mx-auto px-4">
		<div class="flex items-center justify-between h-16">
			<!-- Logo -->
			<a href="/welcome" class="flex items-center gap-2">
				<div class="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-500 rounded-lg flex items-center justify-center">
					<span class="text-white font-bold text-lg">A</span>
				</div>
				<span class="font-bold text-xl text-gray-800">AIris</span>
			</a>

			<!-- Desktop Navigation -->
			<div class="hidden md:flex items-center gap-8">
				{#each navLinks as link}
					<a
						href={link.href}
						class="text-sm font-medium transition-colors {isActive(link.href)
							? 'text-purple-600'
							: 'text-gray-600 hover:text-purple-600'}"
					>
						{link.label}
					</a>
				{/each}
			</div>

			<!-- Auth Buttons -->
			<div class="hidden md:flex items-center gap-4">
				<a
					href="/auth"
					class="text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors"
				>
					Войти
				</a>
				<a
					href="/welcome"
					class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
				>
					Начать бесплатно
				</a>
			</div>

			<!-- Mobile Menu Button -->
			<button
				class="md:hidden p-2 text-gray-600 hover:text-purple-600"
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
			<div class="md:hidden py-4 border-t border-gray-100">
				<div class="flex flex-col gap-4">
					{#each navLinks as link}
						<a
							href={link.href}
							class="text-sm font-medium px-2 py-1 {isActive(link.href)
								? 'text-purple-600'
								: 'text-gray-600'}"
							on:click={() => (mobileMenuOpen = false)}
						>
							{link.label}
						</a>
					{/each}
					<div class="flex flex-col gap-2 pt-4 border-t border-gray-100">
						<a
							href="/auth"
							class="text-sm font-medium text-gray-600 px-2 py-1"
						>
							Войти
						</a>
						<a
							href="/welcome"
							class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg text-center"
						>
							Начать бесплатно
						</a>
					</div>
				</div>
			</div>
		{/if}
	</div>
</nav>
