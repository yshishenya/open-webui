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
	class="sticky top-0 z-50 border-b backdrop-blur-md {darkSurface
		? 'border-white/10 bg-[#1e1647]/95 text-white'
		: 'border-gray-200/70 bg-white/80'}"
>
	<div class="container mx-auto px-4">
		<div class="flex items-center justify-between h-16">
			<!-- Logo -->
			<a
				href="/welcome"
				class="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-xl {darkSurface
					? 'focus-visible:ring-[#ad93fc]'
					: 'focus-visible:ring-black/60'}"
			>
				<div
					class="w-9 h-9 bg-white rounded-lg border {darkSurface
						? 'border-white/20'
						: 'border-gray-200 shadow-sm'} flex items-center justify-center"
				>
					<img src="{WEBUI_BASE_URL}/static/favicon.svg" class="w-7 h-7" alt="" draggable="false" />
				</div>
				<span
					class="font-semibold text-lg tracking-tight {darkSurface
						? 'bg-gradient-to-r from-white via-[#c8b6ff] to-[#8f58ff] bg-clip-text text-transparent'
						: 'text-gray-900'}">Airis</span
				>
			</a>

			<!-- Desktop Navigation -->
			<div class="hidden md:flex items-center gap-8">
				{#each visibleNavLinks as link}
					<a
						href={link.href}
						aria-current={isActive(link.href) ? 'page' : undefined}
						class="text-sm font-medium transition-colors border-b-2 border-transparent pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-md {darkSurface
							? isActive(link.href)
								? 'text-white border-[#ad93fc] focus-visible:ring-[#ad93fc]'
								: 'text-[#d8d2ec] hover:text-white focus-visible:ring-[#ad93fc]'
							: isActive(link.href)
								? 'text-gray-900 border-gray-900 focus-visible:ring-black/60'
								: 'text-gray-500 hover:text-gray-900 focus-visible:ring-black/60'}"
					>
						{link.label}
					</a>
				{/each}
			</div>

			<!-- Auth Buttons -->
			<div class="hidden md:flex items-center gap-4">
				<a
					href="/auth"
					class="text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-lg px-2 py-1 {darkSurface
						? 'text-[#d8d2ec] hover:text-white focus-visible:ring-[#ad93fc]'
						: 'text-gray-600 hover:text-gray-900 focus-visible:ring-black/60'}"
					on:click={handleLoginClick}
				>
					Войти
				</a>
				<a
					href="/signup"
					class="inline-flex items-center justify-center h-10 px-5 text-white text-sm font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 {darkSurface
						? 'bg-[#7132f2] hover:bg-[#6427e8] focus-visible:ring-[#ad93fc]'
						: 'bg-black hover:bg-gray-900 focus-visible:ring-black/60'}"
					on:click={handleHeaderCta}
				>
					Начать бесплатно
				</a>
			</div>

			<!-- Mobile Actions -->
			<div class="flex md:hidden items-center gap-2">
				<a
					href="/auth"
					class="inline-flex min-h-11 items-center px-1 text-sm font-semibold {darkSurface
						? 'text-[#d8d2ec] focus-visible:ring-[#ad93fc]'
						: 'text-gray-600 focus-visible:ring-black/60'} focus-visible:outline-none focus-visible:ring-2"
					on:click={handleLoginClick}
				>
					Войти
				</a>
				<a
					href="/signup"
					class="inline-flex items-center justify-center h-11 px-4 text-white text-sm font-semibold rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 {darkSurface
						? 'bg-[#7132f2] focus-visible:ring-[#ad93fc]'
						: 'bg-black focus-visible:ring-black/60'}"
					on:click={handleHeaderCta}
				>
					{isWelcome() ? 'Начать' : 'Начать бесплатно'}
				</a>
				<button
					class="p-2 {darkSurface
						? 'text-[#d8d2ec] hover:text-white focus-visible:ring-[#ad93fc]'
						: 'text-gray-600 hover:text-gray-900 focus-visible:ring-black/60'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-lg"
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
				class="md:hidden py-4 border-t {darkSurface ? 'border-white/10' : 'border-gray-200/70'}"
				id="mobile-nav"
			>
				<div class="flex flex-col gap-4">
					{#each navLinks as link}
						<a
							href={link.href}
							aria-current={isActive(link.href) ? 'page' : undefined}
							class="text-sm font-medium px-2 py-2 focus-visible:outline-none focus-visible:ring-2 rounded-md {darkSurface
								? isActive(link.href)
									? 'text-white focus-visible:ring-[#ad93fc]'
									: 'text-[#d8d2ec] focus-visible:ring-[#ad93fc]'
								: isActive(link.href)
									? 'text-gray-900'
									: 'text-gray-600'}"
							on:click={() => (mobileMenuOpen = false)}
						>
							{link.label}
						</a>
					{/each}
					<div
						class="flex flex-col gap-2 pt-4 border-t {darkSurface
							? 'border-white/10'
							: 'border-gray-200/70'}"
					>
						<a
							href="/auth"
							class="text-sm font-medium px-2 py-2 focus-visible:outline-none focus-visible:ring-2 rounded-md {darkSurface
								? 'text-[#d8d2ec] focus-visible:ring-[#ad93fc]'
								: 'text-gray-600 focus-visible:ring-black/60'}"
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
