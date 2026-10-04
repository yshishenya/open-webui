<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { page as route } from '$app/stores';
	import { goto } from '$app/navigation';
	import { WEBUI_NAME, user } from '$lib/stores';
	import ReportingFilters from '$lib/components/admin/billing/ReportingFilters.svelte';
	import ReportingPagination from '$lib/components/admin/billing/ReportingPagination.svelte';
	import {
		getBillingReportingCustomers,
		type BillingReportingCustomer,
		type ReportingSort
	} from '$lib/apis/admin/billing_reporting';
	import {
		moneyPage,
		moneyFilters,
		moneyRange,
		moneyQuery,
		customerHref,
		formatReportMoney,
		formatReportTime
	} from '$lib/utils/airis/billing_reporting_ui';
	const i18n = getContext<Readable<I18nType>>('i18n');
	onDestroy(() => {
		request++;
	});
	let draft = moneyFilters($route.url);
	let applied = { ...draft };
	let query = $route.url.searchParams.get('query') || '';
	let submittedQuery = query;
	let status = ($route.url.searchParams.get('status') || '') as
		| ''
		| 'paid'
		| 'never_paid'
		| 'problems';
	let appliedStatus = status;
	let page = moneyPage($route.url.searchParams.get('page'));
	let total = 0;
	let totalPages = 1;
	let loading = false;
	let error = '';
	let rows: BillingReportingCustomer[] = [];
	let asOf = 0;
	let request = 0;
	let truncation = false;
	let sort: ReportingSort = ['paid', 'spent', 'balance', 'last_payment', 'last_usage'].includes(
		$route.url.searchParams.get('sort') || ''
	)
		? ($route.url.searchParams.get('sort') as ReportingSort)
		: 'last_payment';
	let direction: 'asc' | 'desc' =
		$route.url.searchParams.get('direction') === 'asc' ? 'asc' : 'desc';
	const currentUrl = (): string =>
		`/admin/billing/customers?${moneyQuery(applied, { query: submittedQuery, status: appliedStatus, page, sort, direction })}`;
	const open = (id: string): Promise<void> => goto(customerHref(id, applied, currentUrl()));
	const money = (value: number): string =>
		formatReportMoney(value, applied.currency, $i18n.language);
	const stateLabel = (row: BillingReportingCustomer): string =>
		row.status === 'negative_balance'
			? 'Negative balance'
			: row.status === 'payment_problem'
				? 'Payment needs review'
				: row.status === 'never_paid'
					? 'Never paid'
					: 'Has successful payments';
	const load = async (apply = false): Promise<void> => {
		const next = apply ? { ...draft } : { ...applied };
		let range: ReturnType<typeof moneyRange>;
		try {
			range = moneyRange(next);
		} catch (e) {
			request++;
			loading = false;
			error = e instanceof Error ? e.message : 'Choose a valid date range';
			return;
		}
		const id = ++request;
		loading = true;
		error = '';
		rows = [];
		const nextQuery = apply ? query.trim() : submittedQuery;
		const nextStatus = apply ? status : appliedStatus;
		const nextPage = apply ? 1 : page;
		try {
			const result = await getBillingReportingCustomers(localStorage.token, {
				...range,
				query: nextQuery,
				status: nextStatus || undefined,
				page: nextPage,
				page_size: 50,
				sort,
				direction
			});
			if (id !== request) return;
			rows = result.items;
			total = result.total;
			totalPages = Math.max(1, result.total_pages);
			asOf = result.as_of;
			truncation = Boolean(result.payment_fact_limit_reached);
			applied = next;
			submittedQuery = nextQuery;
			appliedStatus = nextStatus;
			page = nextPage;
			await goto(currentUrl(), { replaceState: true, noScroll: true, keepFocus: true });
		} catch {
			if (id === request) {
				rows = [];
				total = 0;
				totalPages = 1;
				error = 'Failed to load billing customers';
			}
		} finally {
			if (id === request) loading = false;
		}
	};
	const changeSort = (key: ReportingSort): void => {
		direction = sort === key && direction === 'desc' ? 'asc' : 'desc';
		sort = key;
		page = 1;
		void load();
	};
	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		await load();
	});
</script>

<svelte:head><title>{$i18n.t('Customers')} • {$WEBUI_NAME}</title></svelte:head>
<div class="mx-auto w-full min-w-0 max-w-7xl px-4 py-5">
	<h1 class="mb-4 text-xl font-semibold">{$i18n.t('Customers')}</h1>
	<ReportingFilters bind:filters={draft} {loading} {error} onApply={() => load(true)}>
		<label class="min-w-0 text-xs text-gray-500"
			>{$i18n.t('Search customers')}<input
				bind:value={query}
				placeholder={$i18n.t('Name, email or ID')}
				class="min-h-11 mt-1 block w-full rounded-lg border border-gray-200 bg-transparent p-2 text-sm dark:border-gray-700"
			/></label
		>
		<label class="text-xs text-gray-500"
			>{$i18n.t('Customer filter')}<select
				bind:value={status}
				class="min-h-11 mt-1 block rounded-lg border border-gray-200 bg-transparent p-2 text-sm dark:border-gray-700"
				><option value="">{$i18n.t('All wallet customers')}</option><option value="paid"
					>{$i18n.t('Has successful payments')}</option
				><option value="never_paid">{$i18n.t('Never paid')}</option><option value="problems"
					>{$i18n.t('Needs financial review')}</option
				></select
			></label
		>
	</ReportingFilters>
	<p class="mb-4 text-sm text-gray-500">
		{$i18n.t('All customers with wallets; period amounts and current balances are separate')}. {applied.fromDate}
		— {applied.toDate} · {total}
		{$i18n.t('customers')}
	</p>
	{#if loading}<p role="status" class="mb-3 text-sm text-gray-500">
			{$i18n.t('Updating report')}
		</p>{/if}
	{#if truncation}<p role="alert" class="mb-3 text-sm text-amber-700">
			{$i18n.t('Payment history is incomplete; totals may be limited')}
		</p>{/if}
	<div
		class="hidden overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 md:block"
	>
		<table class="w-full min-w-[850px] text-sm">
			<thead class="text-left text-gray-500"
				><tr
					><th class="p-3">{$i18n.t('Customer')}</th
					>{#each [['paid', 'Top-ups in period'], ['spent', 'Usage in period'], ['balance', 'Paid balance now']] as col}<th
							class="p-3 text-right"
							aria-sort={sort === col[0]
								? direction === 'asc'
									? 'ascending'
									: 'descending'
								: 'none'}
							><button
								type="button"
								on:click={() => changeSort(col[0] as ReportingSort)}
								class="underline"
								>{$i18n.t(col[1])}{sort === col[0]
									? direction === 'asc'
										? ' ↑'
										: ' ↓'
									: ''}</button
							></th
						>{/each}<th class="p-3">{$i18n.t('Last activity')}</th><th class="p-3"
						>{$i18n.t('Status')}</th
					></tr
				></thead
			><tbody
				>{#each rows as row}<tr class="border-t border-gray-100 dark:border-gray-800"
						><td class="p-3"
							><button
								type="button"
								class="min-h-11 text-left underline"
								on:click={() => open(row.user_id)}>{row.name || row.email || row.user_id}</button
							>
							<div class="text-xs text-gray-500">{row.email}</div></td
						><td class="p-3 text-right tabular-nums"
							>{money(row.period_paid_kopeks)}
							<div class="text-xs text-gray-500">
								{$i18n.t('Refunds')}: {money(row.period_refund_kopeks)}
							</div></td
						><td class="p-3 text-right tabular-nums">{money(row.period_spent_kopeks)}</td><td
							class="p-3 text-right tabular-nums"
							>{money(row.balance_topup_kopeks)}
							<div class="text-xs text-gray-500">
								{$i18n.t('Bonus')}: {money(row.balance_included_kopeks)}
							</div></td
						><td class="p-3 text-xs"
							>{formatReportTime(
								Math.max(row.last_usage_at || 0, row.last_payment_at || 0),
								$i18n.language
							)} UTC</td
						><td class="p-3 text-xs">{$i18n.t(stateLabel(row))}</td></tr
					>{:else}{#if !loading && !error}<tr
							><td colspan="6" class="p-8 text-center text-gray-500"
								>{$i18n.t('No customers found')}</td
							></tr
						>{/if}{/each}</tbody
			>
		</table>
	</div>
	<div class="space-y-3 md:hidden">
		{#each rows as row}<article
				class="min-w-0 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
			>
				<h2 class="break-words font-medium">{row.name || row.email || row.user_id}</h2>
				<p class="mt-1 break-all text-xs text-gray-500">{row.email}</p>
				<dl class="mt-3 space-y-2 text-sm">
					<div class="flex flex-wrap justify-between gap-2">
						<dt>{$i18n.t('Paid balance now')}</dt>
						<dd class="font-semibold tabular-nums">{money(row.balance_topup_kopeks)}</dd>
					</div>
					<div class="flex flex-wrap justify-between gap-2">
						<dt>{$i18n.t('Top-ups in period')}</dt>
						<dd class="tabular-nums">{money(row.period_paid_kopeks)}</dd>
					</div>
					<div class="flex flex-wrap justify-between gap-2">
						<dt>{$i18n.t('Usage in period')}</dt>
						<dd class="tabular-nums">{money(row.period_spent_kopeks)}</dd>
					</div>
					<div class="flex flex-wrap justify-between gap-2">
						<dt>{$i18n.t('Refunds')}</dt>
						<dd class="tabular-nums">{money(row.period_refund_kopeks)}</dd>
					</div>
				</dl>
				<p class="mt-3 text-xs text-gray-500">{$i18n.t(stateLabel(row))}</p>
				<button type="button" on:click={() => open(row.user_id)} class="min-h-11 mt-3 underline"
					>{$i18n.t('Details')}</button
				>
			</article>{:else}{#if !loading && !error}<p>{$i18n.t('No customers found')}</p>{/if}{/each}
	</div>
	<ReportingPagination
		{page}
		{totalPages}
		{total}
		{loading}
		onPage={(next) => {
			page = next;
			void load();
		}}
	/>
	{#if asOf}<p class="mt-4 text-xs text-gray-500">
			{$i18n.t('Current balances as of')}: {formatReportTime(asOf, $i18n.language)} UTC
		</p>{/if}
</div>
