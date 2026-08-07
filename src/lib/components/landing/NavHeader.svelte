<script lang="ts">
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores';
	import { WEBUI_BASE_URL } from '$lib/constants';
	import { trackEvent } from '$lib/utils/analytics';

	export let currentPath: string = '';
	export let tone: 'light' | 'dark' = 'dark';

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
	$: darkSurface = tone === 'dark' || isWelcome();
	$: visibleNavLinks = navLinks;

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

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-gray-900 focus:shadow-lg"
>
	Перейти к содержимому
</a>

<nav
	class="airis-public-nav {darkSurface ? 'airis-public-nav--dark' : ''}"
>
	<div class="container mx-auto px-4">
		<div class="flex items-center justify-between h-16">
			<!-- Logo -->
			<a
				href="/welcome"
				class="airis-public-logo flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#ad93fc]"
			>
				<div
					class="airis-public-logo__mark w-9 h-9 rounded-lg flex items-center justify-center"
				>
					<img src="{WEBUI_BASE_URL}/static/favicon.svg" class="w-7 h-7" alt="" draggable="false" />
				</div>
				<span
					class="font-semibold text-lg tracking-tight">Airis</span
				>
			</a>

			<!-- Desktop Navigation -->
			<div class="hidden md:flex items-center gap-8">
				{#each visibleNavLinks as link}
					<a
						href={link.href}
						aria-current={isActive(link.href) ? 'page' : undefined}
						class="airis-public-nav__link text-sm font-medium border-b-2 border-transparent pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad93fc] rounded-md"
					>
						{link.label}
					</a>
				{/each}
			</div>

			<!-- Auth Buttons -->
			<div class="hidden md:flex items-center gap-4">
				<a
					href="/auth"
					class="airis-public-nav__login text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad93fc] rounded-lg px-2 py-1"
					on:click={handleLoginClick}
				>
					Войти
				</a>
				<a
					href="/signup"
					class="airis-public-btn-primary inline-flex items-center justify-center h-10 px-5 text-sm font-semibold rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad93fc]"
					on:click={handleHeaderCta}
				>
					Начать бесплатно
				</a>
			</div>

			<!-- Mobile Actions -->
			<div class="flex md:hidden items-center gap-2">
				<a
					href="/auth"
					class="airis-public-nav__login inline-flex min-h-11 items-center px-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad93fc]"
					on:click={handleLoginClick}
				>
					Войти
				</a>
				<a
					href="/signup"
					class="airis-public-btn-primary inline-flex items-center justify-center h-11 px-4 text-sm font-semibold rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad93fc]"
					on:click={handleHeaderCta}
				>
					{isWelcome() ? 'Начать' : 'Начать бесплатно'}
				</a>
				<button
					class="airis-public-nav__login p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad93fc] rounded-lg"
					on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
					aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
					aria-expanded={mobileMenuOpen}
					aria-controls="mobile-nav"
				>
					{#if mobileMenuOpen}
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					{:else}
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6h16M4 12h16M4 18h16"
							/>
						</svg>
					{/if}
				</button>
			</div>
		</div>

		<!-- Mobile Menu -->
		{#if mobileMenuOpen}
			<div
				class="airis-public-nav__mobile md:hidden py-4 border-t"
				id="mobile-nav"
			>
				<div class="flex flex-col gap-4">
					{#each navLinks as link}
						<a
							href={link.href}
						aria-current={isActive(link.href) ? 'page' : undefined}
							class="airis-public-nav__link text-sm font-medium px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad93fc] rounded-md"
							on:click={() => (mobileMenuOpen = false)}
						>
							{link.label}
						</a>
					{/each}
					<div
						class="airis-public-nav__mobile flex flex-col gap-2 pt-4 border-t"
					>
						<a
							href="/auth"
							class="airis-public-nav__login text-sm font-medium px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad93fc] rounded-md"
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
