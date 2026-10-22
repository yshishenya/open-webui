<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import { page } from '$app/stores';
	import { config } from '$lib/stores';
	const i18n = getContext<Writable<I18n>>('i18n');
	const billingLinks = [
		{ href: '/admin/billing', label: 'Money' },
		{ href: '/admin/billing/transactions', label: 'Operations' },
		{ href: '/admin/billing/customers', label: 'Customers' }
	];
	const analyticsLinks = [
		{ href: '/admin/analytics', label: 'Product overview' },
		{ href: '/admin/analytics/funnel', label: 'Funnel' },
		{ href: '/admin/billing', label: 'Money' },
		{ href: '/admin/billing/customers', label: 'Customers' }
	];
	const settings = [
		{ href: '/admin/billing/models', label: 'Model prices' },
		{ href: '/admin/billing/lead-magnet', label: 'Free access' },
		{ href: '/admin/billing/plans', label: 'Subscriptions' }
	];
	$: isAnalytics = $page.url.pathname.startsWith('/admin/analytics');
	$: links = isAnalytics ? analyticsLinks : billingLinks;
	const active = (href: string): boolean =>
		$page.url.pathname === href ||
		(href === '/admin/billing/customers' && $page.url.pathname.startsWith(`${href}/`));
	const url = (href: string): string => {
		const params = new URLSearchParams();
		// Acquisition dates and monetary operation dates have different meanings.
		if ($page.url.pathname.startsWith('/admin/analytics') !== href.startsWith('/admin/analytics'))
			return href;
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
	<nav
		aria-label={$i18n.t(isAnalytics ? 'Product and money' : 'Billing')}
		class="flex flex-wrap gap-1"
	>
		{#each links as link}
			{#if !link.href.startsWith('/admin/analytics') || ($config?.features?.enable_admin_analytics ?? true)}
				<a
					href={url(link.href)}
					aria-current={active(link.href) ? 'page' : undefined}
					class="min-h-11 inline-flex items-center rounded-lg px-3 py-2 text-sm {active(link.href)
						? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-white'
						: 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900'}"
					>{$i18n.t(link.label)}</a
				>
			{/if}
		{/each}
	</nav>
	<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
		{#if isAnalytics}
			<a
				class="min-h-11 inline-flex items-center"
				href={url('/admin/analytics/models')}
				aria-current={active('/admin/analytics/models') ? 'page' : undefined}
				>{$i18n.t('Model usage')}</a
			>
			<a
				class="min-h-11 inline-flex items-center"
				href={url('/admin/analytics/retention')}
				aria-current={active('/admin/analytics/retention') ? 'page' : undefined}
				>{$i18n.t('After registration')}</a
			>
			<a
				class="min-h-11 inline-flex items-center"
				href={url('/admin/analytics/mail')}
				aria-current={active('/admin/analytics/mail') ? 'page' : undefined}
				>{$i18n.t('Email verification report')}</a
			>
		{:else if $config?.features?.enable_admin_analytics ?? true}
			<a class="min-h-11 inline-flex items-center" href={url('/admin/analytics')}
				>{$i18n.t('Product overview')}</a
			>
		{/if}
		<details>
			<summary class="min-h-11 flex items-center cursor-pointer"
				>{$i18n.t('Payment settings')}</summary
			>
			<nav aria-label={$i18n.t('Payment settings')} class="mt-2 flex flex-wrap gap-3">
				{#each settings as link}<a
						class="min-h-11 inline-flex items-center"
						href={url(link.href)}
						aria-current={$page.url.pathname.startsWith(link.href) ? 'page' : undefined}
						>{$i18n.t(link.label)}</a
					>{/each}
			</nav>
		</details>
	</div>
</div>
