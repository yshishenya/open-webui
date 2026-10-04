<script lang="ts">
	import { page } from '$app/stores';
	import { config } from '$lib/stores';
	const links = [
		{ href: '/admin/analytics', label: 'Обзор продукта' },
		{ href: '/admin/analytics/funnel', label: 'Воронка' },
		{ href: '/admin/billing', label: 'Деньги' },
		{ href: '/admin/billing/customers', label: 'Клиенты' }
	];
	const settings = [
		{ href: '/admin/billing/models', label: 'Цены моделей' },
		{ href: '/admin/billing/lead-magnet', label: 'Бесплатный доступ' },
		{ href: '/admin/billing/plans', label: 'Подписки' }
	];
	const active = (href: string): boolean =>
		$page.url.pathname === href ||
		(href === '/admin/billing/customers' && $page.url.pathname.startsWith(`${href}/`));
	const url = (href: string): string => {
		const params = new URLSearchParams();
		for (const key of ['from', 'to', 'currency', 'window_days']) {
			const value =
				$page.url.searchParams.get(key) ||
				(key === 'from' || key === 'to' ? $page.url.searchParams.get(`${key}_date`) : null);
			if (value) params.set(key, value);
		}
		return `${href}${params.size ? `?${params}` : ''}`;
	};
</script>

<div class="space-y-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
	<nav aria-label="Продукт и деньги" class="flex flex-wrap gap-1">
		{#each links as link}
			{#if !link.href.startsWith('/admin/analytics') || ($config?.features?.enable_admin_analytics ?? true)}
				<a
					href={url(link.href)}
					aria-current={active(link.href) ? 'page' : undefined}
					class="min-h-11 inline-flex items-center rounded-lg px-3 py-2 text-sm {active(link.href)
						? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-white'
						: 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900'}"
					>{link.label}</a
				>
			{/if}
		{/each}
	</nav>
	<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
		{#if $page.url.pathname.startsWith('/admin/analytics')}
			<a
				class="min-h-11 inline-flex items-center"
				href={url('/admin/analytics/models')}
				aria-current={active('/admin/analytics/models') ? 'page' : undefined}
				>Использование моделей</a
			>
			<a
				class="min-h-11 inline-flex items-center"
				href={url('/admin/analytics/retention')}
				aria-current={active('/admin/analytics/retention') ? 'page' : undefined}
				>После регистрации</a
			>
			<a
				class="min-h-11 inline-flex items-center"
				href={url('/admin/analytics/mail')}
				aria-current={active('/admin/analytics/mail') ? 'page' : undefined}>Проверка писем</a
			>
		{:else}
			<a
				class="min-h-11 inline-flex items-center"
				href={url('/admin/billing/transactions')}
				aria-current={active('/admin/billing/transactions') ? 'page' : undefined}
				>Оплаты и использование</a
			>
		{/if}
		<details>
			<summary class="min-h-11 flex items-center cursor-pointer">Настройки оплаты</summary>
			<nav aria-label="Настройки оплаты" class="mt-2 flex flex-wrap gap-3">
				{#each settings as link}<a
						class="min-h-11 inline-flex items-center"
						href={url(link.href)}
						aria-current={$page.url.pathname.startsWith(link.href) ? 'page' : undefined}
						>{link.label}</a
					>{/each}
			</nav>
		</details>
	</div>
</div>
