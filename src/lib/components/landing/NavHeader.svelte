<script lang="ts">
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores';
	import { WEBUI_BASE_URL } from '$lib/constants';
	import { trackEvent } from '$lib/utils/analytics';

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

	const isWelcome = (): boolean => currentPath === '/welcome';

	const buildChatTarget = (source: string): string => `/?src=${source}`;

	const buildSignupTarget = (source: string): string => {
		const redirectTarget = buildChatTarget(source);
		const params = new URLSearchParams({ redirect: redirectTarget, src: source });
		return `/signup?${params.toString()}`;
	};

	const buildLoginTarget = (source: string): string => {
		const redirectTarget = buildChatTarget(source);
		const params = new URLSearchParams({ redirect: redirectTarget, src: source });
		return `/auth?${params.toString()}`;
	};

	const handleHeaderCta = (event: MouseEvent): void => {
		if (!isWelcome()) {
			return;
		}

		event.preventDefault();
		trackEvent('welcome_header_cta_click');

		const target = buildChatTarget('welcome_header_cta');
		if ($user) {
			goto(target);
			return;
		}

		goto(buildSignupTarget('welcome_header_cta'));
	};

	const handleLoginClick = (event: MouseEvent): void => {
		if (!isWelcome()) {
			return;
		}

		event.preventDefault();
		trackEvent('welcome_login_click');
		goto(buildLoginTarget('welcome_login'));
	};
</script>

<nav class="bg-white/80 backdrop-blur-md border-b border-gray-200/70 sticky top-0 z-50">
	<div class="container mx-auto px-4">
		<div class="flex items-center justify-between h-16">
			<!-- Logo -->
			<a href="/" class="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 rounded-xl">
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
						class="text-sm font-medium transition-colors border-b-2 border-transparent pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 rounded-md {isActive(link.href)
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
					class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 rounded-lg px-2 py-1"
					on:click={handleLoginClick}
				>
					Войти
				</a>
				<a
					href="/signup"
					class="inline-flex items-center justify-center h-10 px-5 bg-black hover:bg-gray-900 text-white text-sm font-semibold rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
					on:click={handleHeaderCta}
				>
					Начать бесплатно
				</a>
			</div>

			<!-- Mobile Actions -->
			<div class="flex md:hidden items-center gap-2">
				<a
					href="/signup"
					class="inline-flex items-center justify-center h-11 px-4 bg-black text-white text-sm font-semibold rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
					on:click={handleHeaderCta}
				>
					Начать бесплатно
				</a>
				<button
					class="p-2 text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 rounded-lg"
					on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
					aria-label="Открыть меню"
					aria-expanded={mobileMenuOpen}
					aria-controls="mobile-nav"
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
		</div>

		<!-- Mobile Menu -->
		{#if mobileMenuOpen}
			<div class="md:hidden py-4 border-t border-gray-200/70" id="mobile-nav">
				<div class="flex flex-col gap-4">
					{#each navLinks as link}
						<a
							href={link.href}
							class="text-sm font-medium px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 rounded-md {isActive(link.href)
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
							class="text-sm font-medium text-gray-600 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 rounded-md"
							on:click={handleLoginClick}
						>
							Войти
						</a>
					</div>
				</div>
			</div>
		{/if}
	</div>
</nav>
