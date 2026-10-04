<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { page as route } from '$app/stores';
	import { goto } from '$app/navigation';
	import { WEBUI_NAME, user } from '$lib/stores';
	import ReportingFilters from '$lib/components/admin/billing/ReportingFilters.svelte';
	import ReportingPagination from '$lib/components/admin/billing/ReportingPagination.svelte';
	import ReportingRecords from '$lib/components/admin/billing/ReportingRecords.svelte';
	import {
		getBillingReportingCustomer,
		getBillingReportingPayments,
		getBillingReportingRefunds,
		getBillingReportingUsage,
		getBillingReportingLedger,
		type BillingReportingCustomerDetail,
		type BillingReportingPayment,
		type BillingReportingRefund,
		type BillingReportingRow
	} from '$lib/apis/admin/billing_reporting';
	import {
		moneyPage,
		moneyFilters,
		moneyRange,
		moneyQuery,
		reportingBack,
		formatReportMoney,
		formatReportTime
	} from '$lib/utils/airis/billing_reporting_ui';
	const i18n = getContext<Readable<I18nType>>('i18n');
	onDestroy(() => {
		request++;
		mounted = false;
	});
	type Tab = 'payments' | 'refunds' | 'usage' | 'ledger';
	let customerId = String($route.params.id || '');
	let mounted = false;
	let back = reportingBack($route.url.searchParams.get('back'));
	$: back = reportingBack($route.url.searchParams.get('back'));
	let draft = moneyFilters($route.url);
	let applied = { ...draft };
	let detail: BillingReportingCustomerDetail | null = null;
	let loading = false;
	let error = '';
	let detailError = '';
	let tab: Tab = ['payments', 'refunds', 'usage', 'ledger'].includes(
		$route.url.searchParams.get('tab') || ''
	)
		? ($route.url.searchParams.get('tab') as Tab)
		: 'payments';
	let page = moneyPage($route.url.searchParams.get('page'));
	let paymentId = $route.url.searchParams.get('payment_id') || '';
	let referenceId = $route.url.searchParams.get('reference_id') || '';
	let relatedContext = `${paymentId}|${referenceId}`;
	let total = 0;
	let totalPages = 1;
	let request = 0;
	let payments: BillingReportingPayment[] = [];
	let refunds: BillingReportingRefund[] = [];
	let rows: BillingReportingRow[] = [];
	const money = (value: number): string =>
		formatReportMoney(value, applied.currency, $i18n.language);
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
		const nextPage = apply ? 1 : page;
		const selected = tab;
		const selectedCustomer = customerId;
		loading = true;
		error = '';
		payments = [];
		refunds = [];
		rows = [];
		detailError = '';
		const filters = { ...range, user_id: selectedCustomer, page: nextPage, page_size: 50 };
		const [profile, history] = await Promise.allSettled([
			getBillingReportingCustomer(localStorage.token, selectedCustomer, { ...range, limit: 1 }),
			selected === 'payments'
				? getBillingReportingPayments(localStorage.token, {
						...filters,
						payment_id: paymentId || undefined
					})
				: selected === 'refunds'
					? getBillingReportingRefunds(localStorage.token, filters)
					: selected === 'usage'
						? getBillingReportingUsage(localStorage.token, filters)
						: getBillingReportingLedger(localStorage.token, {
								...filters,
								reference_id: referenceId || undefined
							})
		]);
		if (id !== request || selectedCustomer !== String($route.params.id || '')) return;
		if (profile.status === 'fulfilled') {
			detail = profile.value;
			applied = next;
		} else {
			detail = null;
			detailError = 'Failed to load customer financial profile';
		}
		if (history.status === 'fulfilled') {
			const result = history.value;
			if (selected === 'payments') payments = result.items as BillingReportingPayment[];
			else if (selected === 'refunds') refunds = result.items as BillingReportingRefund[];
			else rows = result.items as BillingReportingRow[];
			total = result.total;
			totalPages = Math.max(1, result.total_pages);
			page = nextPage;
			applied = next;
		} else {
			payments = [];
			refunds = [];
			rows = [];
			error = 'Failed to load customer history';
		}
		loading = false;
		await goto(
			`?${moneyQuery(applied, { back, tab, page, payment_id: paymentId, reference_id: referenceId })}`,
			{
				replaceState: true,
				noScroll: true,
				keepFocus: true
			}
		);
	};
	const select = (next: Tab): void => {
		tab = next;
		paymentId = '';
		referenceId = '';
		relatedContext = '|';
		page = 1;
		payments = [];
		refunds = [];
		rows = [];
		void load();
	};
	const showRelated = (next: 'payments' | 'ledger', id: string): void => {
		tab = next;
		paymentId = next === 'payments' ? id : '';
		referenceId = next === 'ledger' ? id : '';
		relatedContext = `${paymentId}|${referenceId}`;
		page = 1;
		void load();
	};
	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		mounted = true;
		await load();
	});
	const routeContextChanged = (url: URL, id: string): boolean =>
		id !== customerId ||
		`${url.searchParams.get('payment_id') || ''}|${url.searchParams.get('reference_id') || ''}` !==
			relatedContext;
	const syncRoute = (url: URL, id: string): void => {
		if (!routeContextChanged(url, id)) return;
		customerId = id;
		detail = null;
		detailError = '';
		payments = [];
		refunds = [];
		rows = [];
		total = 0;
		totalPages = 1;
		draft = moneyFilters(url);
		applied = { ...draft };
		page = moneyPage(url.searchParams.get('page'));
		paymentId = url.searchParams.get('payment_id') || '';
		referenceId = url.searchParams.get('reference_id') || '';
		relatedContext = `${paymentId}|${referenceId}`;
		tab = ['payments', 'refunds', 'usage', 'ledger'].includes(url.searchParams.get('tab') || '')
			? (url.searchParams.get('tab') as Tab)
			: 'payments';
		void load();
	};
	$: if (mounted) syncRoute($route.url, String($route.params.id || ''));
</script>

<svelte:head><title>{$i18n.t('Customer money')} • {$WEBUI_NAME}</title></svelte:head>
<div class="mx-auto w-full min-w-0 max-w-7xl px-4 py-5">
	<a href={back} class="mb-4 inline-block text-sm underline"
		>← {$i18n.t(
			back.startsWith('/admin/billing/transactions')
				? 'Back to operations'
				: back.startsWith('/admin/billing/plans')
					? 'Back to subscribers'
					: 'Back to customer list'
		)}</a
	>
	<h1 class="mb-1 break-words text-xl font-semibold">
		{detail?.user.name || $i18n.t('Customer money')}
	</h1>
	{#if detail}<p class="mb-4 break-all text-sm text-gray-500">{detail.user.email}</p>{/if}
	<ReportingFilters bind:filters={draft} {loading} {error} onApply={() => load(true)} />
	{#if loading}<p role="status" class="mb-3 text-sm text-gray-500">
			{$i18n.t('Updating report')}
		</p>{/if}
	{#if detailError}<p role="alert" class="mb-4 text-sm text-red-700 dark:text-red-300">
			{$i18n.t(detailError)}
			<button type="button" class="min-h-11 underline" on:click={() => load()}
				>{$i18n.t('Retry')}</button
			>
		</p>{/if}
	{#if detail && !loading}<p class="mb-3 text-sm text-gray-500">
			{$i18n.t('For the applied period')}: {applied.fromDate} — {applied.toDate}
		</p>
		<dl class="grid gap-3 sm:grid-cols-3">
			{#each [['Top-ups in period', detail.metrics.period_paid_kopeks], ['Refunds in period', detail.metrics.period_refund_kopeks], ['Usage in period', detail.metrics.period_spent_kopeks]] as metric}<div
					class="min-w-0 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
				>
					<dt class="text-sm text-gray-500">{$i18n.t(String(metric[0]))}</dt>
					<dd class="mt-2 break-words text-xl font-semibold tabular-nums">
						{money(Number(metric[1]))}
					</dd>
				</div>{/each}
		</dl>
		{#if detail.metrics.period_other_payments_kopeks}<p class="mt-3 text-sm">
				{$i18n.t('Other subscription payments')}: {money(
					detail.metrics.period_other_payments_kopeks
				)} · {$i18n.t('For the applied period')}
			</p>{/if}
		<section class="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
			<h2 class="font-medium">{$i18n.t('Balance now')}</h2>
			<dl class="mt-3 grid gap-3 sm:grid-cols-2">
				<div>
					<dt class="text-sm text-gray-500">{$i18n.t('Paid funds remaining')}</dt>
					<dd class="mt-1 text-xl font-semibold tabular-nums">
						{money(detail.wallet.balance_topup_kopeks)}
					</dd>
				</div>
				<div>
					<dt class="text-sm text-gray-500">{$i18n.t('Bonus funds remaining')}</dt>
					<dd class="mt-1 text-xl font-semibold tabular-nums">
						{money(detail.wallet.balance_included_kopeks)}
					</dd>
				</div>
			</dl>
			<p class="mt-3 text-xs text-gray-500">
				{$i18n.t('Current balances as of')}: {formatReportTime(detail.as_of, $i18n.language)} UTC. {$i18n.t(
					'Refunds require a separate wallet reconciliation'
				)}
			</p>
		</section>
		<details class="mt-4 text-sm">
			<summary class="cursor-pointer text-gray-500">{$i18n.t('All-time totals and limits')}</summary
			>
			<dl class="mt-3 grid gap-3 sm:grid-cols-3">
				<div>
					<dt>{$i18n.t('Top-ups all time')}</dt>
					<dd class="tabular-nums">{money(detail.metrics.paid_kopeks)}</dd>
				</div>
				<div>
					<dt>{$i18n.t('Refunds all time')}</dt>
					<dd class="tabular-nums">{money(detail.metrics.refund_kopeks)}</dd>
				</div>
				<div>
					<dt>{$i18n.t('Usage all time')}</dt>
					<dd class="tabular-nums">{money(detail.metrics.spent_kopeks)}</dd>
				</div>
				{#if detail.metrics.other_payments_kopeks}<div>
						<dt>{$i18n.t('Other subscription payments')}</dt>
						<dd class="tabular-nums">{money(detail.metrics.other_payments_kopeks)}</dd>
					</div>{/if}
				<div>
					<dt>{$i18n.t('Daily spending limit')}</dt>
					<dd>
						{detail.wallet.daily_cap_kopeks === null
							? $i18n.t('Not set')
							: money(detail.wallet.daily_cap_kopeks)}
					</dd>
				</div>
			</dl>
		</details>{/if}
	<h2 class="mt-6 mb-3 font-medium">{$i18n.t('Customer operations')}</h2>
	{#if (tab === 'payments' && paymentId) || (tab === 'ledger' && referenceId)}<p
			class="mb-3 text-sm text-gray-500"
		>
			{$i18n.t(
				'Related records are shown across all dates; financial totals keep the selected period.'
			)}
			<button type="button" class="min-h-11 ml-2 underline" on:click={() => select(tab)}
				>{$i18n.t('Show all customer operations')}</button
			>
		</p>{/if}
	<div class="mb-4 flex flex-wrap gap-2">
		{#each [['payments', 'Payments'], ['refunds', 'Refunds'], ['usage', 'Usage charged'], ['ledger', 'Technical wallet journal']] as item}<button
				type="button"
				aria-pressed={tab === item[0]}
				on:click={() => select(item[0] as Tab)}
				class={`min-h-11 rounded-lg px-3 py-2 text-sm ${tab === item[0] ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'border border-gray-200 dark:border-gray-700'}`}
				>{$i18n.t(item[1])}</button
			>{/each}
	</div>
	<ReportingRecords
		dataset={tab}
		{payments}
		{refunds}
		{rows}
		currency={applied.currency}
		{loading}
		error={Boolean(error)}
		onPayment={(_id, id) => showRelated('payments', id)}
		onUsageLedger={(_id, id) => showRelated('ledger', id)}
	/>
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
</div>
