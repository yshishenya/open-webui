<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { goto } from '$app/navigation';
	import { page as pageStore } from '$app/stores';
	import { WEBUI_NAME, user } from '$lib/stores';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import {
		getBillingReportingCustomers,
		type BillingReportingCustomer,
		type ReportingSort
	} from '$lib/apis/admin/billing_reporting';

	const i18n = getContext<Readable<I18nType>>('i18n');
	let loaded = false;
	let loading = true;
	let errorMessage = '';
	let rows: BillingReportingCustomer[] = [];
	let query = '';
	let submittedQuery = '';
	let page = 1;
	let totalPages = 1;
	let total = 0;
	let sort: ReportingSort = 'last_payment';
	let direction: 'asc' | 'desc' = 'desc';
	let currency = 'RUB';
	let fromDate = '';
	let toDate = '';
	const supportedCurrencies = new Set(['RUB', 'USD', 'EUR']);

	const money = (kopeks: number, currencyCode = currency): string =>
		new Intl.NumberFormat($i18n.language, { style: 'currency', currency: currencyCode, maximumFractionDigits: 2 }).format(
			kopeks / 100
		);
	const dateTime = (value: number | null): string => (value ? new Date(value * 1000).toLocaleString($i18n.language) : '—');
	const epoch = (value: string, end = false): number | undefined => {
		if (!value) return undefined;
		const date = new Date(`${value}T${end ? '23:59:59' : '00:00:00'}`);
		return Number.isNaN(date.getTime()) ? undefined : Math.floor(date.getTime() / 1000);
	};

	const load = async (): Promise<void> => {
		loading = true;
		errorMessage = '';
		try {
			const result = await getBillingReportingCustomers(localStorage.token, {
				currency,
				from: epoch(fromDate),
				to: epoch(toDate, true),
				query: submittedQuery,
				page,
				page_size: 50,
				sort,
				direction
			});
			rows = result.items;
			total = result.total;
			totalPages = Math.max(1, result.total_pages);
		} catch (error) {
			console.error('Failed to load billing customers:', error);
			errorMessage = $i18n.t('Failed to load billing customers');
		} finally {
			loading = false;
		}
	};

	const search = async (): Promise<void> => {
		page = 1;
		submittedQuery = query.trim();
		await load();
	};

	const changeSort = async (next: ReportingSort): Promise<void> => {
		if (sort === next) direction = direction === 'asc' ? 'desc' : 'asc';
		else {
			sort = next;
			direction = 'desc';
		}
		await load();
	};

	const openCustomer = async (userId: string): Promise<void> => {
		await goto(`/admin/billing/customers/${encodeURIComponent(userId)}`);
	};

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		const requestedCurrency = $pageStore.url.searchParams.get('currency');
		currency = requestedCurrency && supportedCurrencies.has(requestedCurrency) ? requestedCurrency : currency;
		fromDate = $pageStore.url.searchParams.get('from_date') || '';
		toDate = $pageStore.url.searchParams.get('to_date') || '';
		await load();
		loaded = true;
	});
</script>

<svelte:head><title>{$i18n.t('Billing customers')} • {$WEBUI_NAME}</title></svelte:head>

{#if !loaded || loading}
	<div class="flex h-64 items-center justify-center"><Spinner className="size-5" /></div>
{:else}
	<div class="mx-auto max-w-7xl px-4 py-5">
		<div class="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h1 class="text-xl font-semibold text-gray-900 dark:text-white">{$i18n.t('Customers')}</h1><p class="mt-1 text-sm text-gray-500">{total} {$i18n.t('customers in this view')}</p></div><div class="flex flex-wrap items-end gap-2"><label class="text-xs text-gray-500">{$i18n.t('Currency')}<select bind:value={currency} on:change={() => { page = 1; load(); }} class="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"><option>RUB</option><option>USD</option><option>EUR</option></select></label><label class="text-xs text-gray-500">{$i18n.t('From')}<input bind:value={fromDate} on:change={() => { page = 1; load(); }} type="date" class="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" /></label><label class="text-xs text-gray-500">{$i18n.t('To')}<input bind:value={toDate} on:change={() => { page = 1; load(); }} type="date" class="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" /></label><form class="flex gap-2" on:submit|preventDefault={search}><label class="sr-only" for="customer-search">{$i18n.t('Search customers')}</label><input id="customer-search" bind:value={query} placeholder={$i18n.t('Name, email or ID')} class="w-64 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" /><button type="submit" class="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-gray-900">{$i18n.t('Search')}</button></form></div></div>
		{#if errorMessage}<div class="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{errorMessage} <button class="ml-2 underline" on:click={load}>{$i18n.t('Retry')}</button></div>{/if}
		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"><div class="overflow-x-auto"><table class="min-w-[1080px] w-full text-left text-sm"><caption class="sr-only">{$i18n.t('Customer financial balances and payment activity')}</caption><thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-950"><tr><th scope="col" class="px-4 py-3">{$i18n.t('Customer')}</th><th scope="col" class="px-4 py-3 text-right" aria-sort={sort === 'paid' ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" aria-label={`${$i18n.t('Sort by Paid')}; ${sort === 'paid' ? direction : 'none'}`} on:click={() => changeSort('paid')} class="underline-offset-2 hover:underline">{$i18n.t('Paid')}</button></th><th scope="col" class="px-4 py-3 text-right" aria-sort={sort === 'spent' ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" aria-label={`${$i18n.t('Sort by Spent')}; ${sort === 'spent' ? direction : 'none'}`} on:click={() => changeSort('spent')} class="underline-offset-2 hover:underline">{$i18n.t('Spent')}</button></th><th scope="col" class="px-4 py-3 text-right" aria-sort={sort === 'balance' ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" aria-label={`${$i18n.t('Sort by Balance')}; ${sort === 'balance' ? direction : 'none'}`} on:click={() => changeSort('balance')} class="underline-offset-2 hover:underline">{$i18n.t('Balance')}</button></th><th scope="col" class="px-4 py-3">{$i18n.t('Last payment')}</th><th scope="col" class="px-4 py-3">{$i18n.t('Last usage')}</th><th scope="col" class="px-4 py-3">{$i18n.t('Status')}</th></tr></thead><tbody>{#each rows as row}<tr class="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-850" on:click={() => openCustomer(row.user_id)} on:keydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCustomer(row.user_id); } }} role="link" aria-label={`${$i18n.t('Open customer')} ${row.name || row.email || row.user_id}`} tabindex="0"><td class="px-4 py-3"><div class="font-medium text-gray-900 dark:text-white">{row.name || '—'}</div><div class="text-xs text-gray-500">{row.email}<span class="ml-2 text-gray-400">{row.user_id}</span></div></td><td class="px-4 py-3 text-right tabular-nums">{money(row.paid_kopeks, row.currency)}<div class="text-xs text-gray-400">{row.successful_payment_count} {$i18n.t('payments')}</div></td><td class="px-4 py-3 text-right tabular-nums">{money(row.spent_kopeks, row.currency)}<div class="text-xs text-gray-400">{money(row.period_spent_kopeks, row.currency)} {$i18n.t('period')}</div></td><td class="px-4 py-3 text-right tabular-nums"><div>{money(row.balance_topup_kopeks, row.currency)}</div><div class="text-xs text-amber-600">+ {money(row.balance_included_kopeks, row.currency)} {$i18n.t('bonus')}</div></td><td class="px-4 py-3 text-xs tabular-nums">{dateTime(row.last_payment_at)}</td><td class="px-4 py-3 text-xs tabular-nums">{dateTime(row.last_usage_at)}</td><td class="px-4 py-3"><span class={`rounded-full px-2 py-1 text-xs ${row.status === 'negative_balance' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200' : row.status === 'never_paid' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'}`}>{$i18n.t(row.status)}</span></td></tr>{:else}<tr><td colspan="7" class="px-4 py-12 text-center text-sm text-gray-500">{$i18n.t('No customers found')}</td></tr>{/each}</tbody></table></div><div class="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm dark:border-gray-800"><span class="text-gray-500">{$i18n.t('Page')} {page} / {totalPages}</span><div class="flex gap-2"><button type="button" disabled={page <= 1} on:click={() => { page -= 1; load(); }} class="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">{$i18n.t('Previous')}</button><button type="button" disabled={page >= totalPages} on:click={() => { page += 1; load(); }} class="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">{$i18n.t('Next')}</button></div></div></div>
	</div>
{/if}
