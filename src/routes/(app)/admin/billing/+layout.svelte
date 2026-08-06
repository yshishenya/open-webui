<script lang="ts">
	import { page } from '$app/stores';
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';

	const i18n = getContext<Readable<I18nType>>('i18n');
	const tabs = [
		{ href: '/admin/billing', label: 'Overview' },
		{ href: '/admin/billing/customers', label: 'Customers' },
		{ href: '/admin/billing/transactions', label: 'Transactions' },
		{ href: '/admin/billing/plans', label: 'Plans' },
		{ href: '/admin/billing/models', label: 'Model pricing' },
		{ href: '/admin/billing/lead-magnet', label: 'Free limits' }
	];
</script>

<div class="px-4.5 pt-3">
	<nav class="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800" aria-label="Billing sections">
		{#each tabs as tab}
			<a
				href={tab.href}
				class="whitespace-nowrap rounded-t-lg px-3 py-2 text-sm transition {$page.url.pathname === tab.href || ($page.url.pathname.startsWith(`${tab.href}/`) && tab.href !== '/admin/billing') ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-gray-900 dark:hover:text-white'}"
				aria-current={$page.url.pathname === tab.href ? 'page' : undefined}
			>
				{$i18n.t(tab.label)}
			</a>
		{/each}
	</nav>
</div>

<slot />
