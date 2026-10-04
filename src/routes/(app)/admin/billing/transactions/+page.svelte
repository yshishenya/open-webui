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
	import ReportingCustomerPicker from '$lib/components/admin/billing/ReportingCustomerPicker.svelte';
	import {
		getBillingReportingPayments,
		getBillingReportingRefunds,
		getBillingReportingLedger,
		getBillingReportingUsage,
		getBillingReportingExportUrl,
		type BillingReportingPayment,
		type BillingReportingRefund,
		type BillingReportingRow
	} from '$lib/apis/admin/billing_reporting';
	import {
		moneyPage,
		moneyFilters,
		moneyRange,
		moneyQuery,
		customerHref
	} from '$lib/utils/airis/billing_reporting_ui';
	const i18n = getContext<Readable<I18nType>>('i18n');
	onDestroy(() => {
		request++;
		exportRequest++;
	});
	type Tab = 'payments' | 'refunds' | 'usage' | 'ledger';
	let draft = moneyFilters($route.url);
	let applied = { ...draft };
	let tab: Tab = ['payments', 'refunds', 'usage', 'ledger'].includes(
		$route.url.searchParams.get('tab') || ''
	)
		? ($route.url.searchParams.get('tab') as Tab)
		: 'payments';
	let page = moneyPage($route.url.searchParams.get('page'));
	let userId = $route.url.searchParams.get('user_id') || '';
	let appliedUser = userId;
	let status = $route.url.searchParams.get('status') || '';
	let appliedStatus = status;
	let kind = $route.url.searchParams.get('kind') || '';
	let appliedKind = kind;
	let creditStatus = $route.url.searchParams.get('credit_status') || '';
	let older = $route.url.searchParams.get('older_than_hours') || '';
	let attention: 'stale_pending' | 'uncredited' | '' = ['stale_pending', 'uncredited'].includes(
		$route.url.searchParams.get('attention') || ''
	)
		? ($route.url.searchParams.get('attention') as 'stale_pending' | 'uncredited')
		: '';
	let excludeTests = $route.url.searchParams.get('is_test') === 'false';
	let loading = false;
	let exporting = false;
	let exportRequest = 0;
	let error = '';
	let payments: BillingReportingPayment[] = [];
	let refunds: BillingReportingRefund[] = [];
	let rows: BillingReportingRow[] = [];
	let total = 0;
	let totalPages = 1;
	let truncated = false;
	let request = 0;
	const currentUrl = (): string =>
		`/admin/billing/transactions?${moneyQuery(applied, { tab, page, user_id: appliedUser, status: appliedStatus, kind: appliedKind, credit_status: creditStatus, older_than_hours: older, attention, is_test: excludeTests ? 'false' : '' })}`;
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
		const nextUser = apply ? userId.trim() : appliedUser;
		const nextStatus = apply ? status : appliedStatus;
		const nextKind = apply ? kind : appliedKind;
		const selected = tab;
		loading = true;
		error = '';
		payments = [];
		refunds = [];
		rows = [];
		try {
			const values = { ...range, page: nextPage, page_size: 50, user_id: nextUser || undefined };
			const result =
				selected === 'payments'
					? await getBillingReportingPayments(localStorage.token, {
							...values,
							status: nextStatus || undefined,
							kind: nextKind || undefined,
							credit_status: creditStatus || undefined,
							older_than_hours: older ? Number(older) : undefined,
							attention: attention || undefined,
							is_test: excludeTests ? false : undefined
						})
					: selected === 'refunds'
						? await getBillingReportingRefunds(localStorage.token, values)
						: selected === 'usage'
							? await getBillingReportingUsage(localStorage.token, values)
							: await getBillingReportingLedger(localStorage.token, values);
			if (id !== request) return;
			if (selected === 'payments') payments = result.items as BillingReportingPayment[];
			else if (selected === 'refunds') refunds = result.items as BillingReportingRefund[];
			else rows = result.items as BillingReportingRow[];
			total = result.total;
			totalPages = Math.max(1, result.total_pages);
			truncated = Boolean(result.truncated);
			applied = next;
			appliedUser = nextUser;
			appliedStatus = nextStatus;
			appliedKind = nextKind;
			page = nextPage;
			await goto(currentUrl(), { replaceState: true, noScroll: true, keepFocus: true });
		} catch {
			if (id === request) {
				payments = [];
				refunds = [];
				rows = [];
				total = 0;
				totalPages = 1;
				error = 'Failed to load billing transactions';
			}
		} finally {
			if (id === request) loading = false;
		}
	};
	const select = (next: Tab): void => {
		tab = next;
		attention = '';
		creditStatus = '';
		older = '';
		excludeTests = false;
		page = 1;
		payments = [];
		refunds = [];
		rows = [];
		void load();
	};
	const exportData = async (): Promise<void> => {
		const id = ++exportRequest;
		const selected = tab;
		exporting = true;
		try {
			const response = await fetch(
				getBillingReportingExportUrl({
					dataset: tab,
					...moneyRange(applied),
					user_id: appliedUser || undefined,
					status: tab === 'payments' ? appliedStatus || undefined : undefined,
					kind: tab === 'payments' ? appliedKind || undefined : undefined,
					credit_status: tab === 'payments' ? creditStatus || undefined : undefined,
					older_than_hours: tab === 'payments' && older ? Number(older) : undefined,
					attention: tab === 'payments' ? attention || undefined : undefined,
					is_test: tab === 'payments' && excludeTests ? false : undefined
				}),
				{
					headers: { Authorization: `Bearer ${localStorage.token}` },
					signal: AbortSignal.timeout(70000),
					cache: 'no-store'
				}
			);
			if (id !== exportRequest) return;
			if (!response.ok) throw new Error();
			const blob = await response.blob();
			if (id !== exportRequest) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `billing-${selected}.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			if (id === exportRequest) error = 'Failed to export billing transactions';
		} finally {
			if (id === exportRequest) exporting = false;
		}
	};
	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		await load();
	});
</script>

<svelte:head><title>{$i18n.t('Money operations')} • {$WEBUI_NAME}</title></svelte:head>
<div class="mx-auto w-full min-w-0 max-w-7xl px-4 py-5">
	<h1 class="mb-4 text-xl font-semibold">{$i18n.t('Money operations')}</h1>
	<div class="mb-4 flex flex-wrap gap-2" aria-label={$i18n.t('Money operation views')}>
		{#each [['payments', 'Top-ups and payment attempts'], ['refunds', 'Refunds'], ['usage', 'Usage charged'], ['ledger', 'Technical wallet journal']] as item}<button
				type="button"
				aria-pressed={tab === item[0]}
				on:click={() => select(item[0] as Tab)}
				class={`min-h-11 rounded-lg px-3 py-2 text-sm ${tab === item[0] ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'border border-gray-200 dark:border-gray-700'}`}
				>{$i18n.t(item[1])}</button
			>{/each}
	</div>
	<ReportingFilters bind:filters={draft} {loading} {error} onApply={() => load(true)}
		><ReportingCustomerPicker bind:userId currency={draft.currency} />{#if tab === 'payments'}<label
				class="text-xs text-gray-500"
				>{$i18n.t('Payment status')}<select
					bind:value={status}
					class="min-h-11 mt-1 block rounded-lg border border-gray-200 bg-transparent p-2 text-sm dark:border-gray-700"
					><option value="">{$i18n.t('All statuses')}</option><option value="succeeded"
						>{$i18n.t('Payment confirmed')}</option
					><option value="pending">{$i18n.t('Awaiting payment')}</option><option value="failed"
						>{$i18n.t('Payment failed')}</option
					><option value="canceled">{$i18n.t('Payment canceled')}</option></select
				></label
			><label class="text-xs text-gray-500"
				>{$i18n.t('Payment type')}<select
					bind:value={kind}
					class="min-h-11 mt-1 block rounded-lg border border-gray-200 bg-transparent p-2 text-sm dark:border-gray-700"
					><option value="">{$i18n.t('All types')}</option><option value="topup"
						>{$i18n.t('Wallet top-up')}</option
					><option value="subscription">{$i18n.t('Subscription payment')}</option></select
				></label
			>{/if}</ReportingFilters
	>
	{#if creditStatus || older || attention || excludeTests}<div class="mb-4 text-sm text-gray-500">
			{$i18n.t(
				attention === 'uncredited' || creditStatus === 'not_credited'
					? 'Only payments without wallet credit'
					: attention === 'stale_pending' || older
						? 'Only payments pending over 24 hours'
						: 'Only credited non-test wallet top-ups'
			)}
			<button
				type="button"
				class="min-h-11 ml-2 underline"
				on:click={() => {
					creditStatus = '';
					older = '';
					attention = '';
					excludeTests = false;
					page = 1;
					void load();
				}}>{$i18n.t('Clear')}</button
			>
		</div>{/if}
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-gray-500">
			{#if attention}{$i18n.t(
					'All history; current problems, regardless of selected dates'
				)}{:else}{applied.fromDate} — {applied.toDate}{/if} · {total}
			{$i18n.t('records')}
		</p>
		<button
			type="button"
			on:click={exportData}
			disabled={loading || exporting || ((tab === 'usage' || tab === 'ledger') && !appliedUser)}
			class="min-h-11 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
			>{$i18n.t(exporting ? 'Exporting...' : 'Export CSV')}</button
		>
	</div>
	<p class="mb-4 text-xs text-gray-500">
		{$i18n.t(
			tab === 'ledger' || tab === 'usage'
				? 'CSV export: one selected customer, up to 50000 records'
				: 'CSV export: applied filters, up to 50000 records'
		)}
	</p>
	{#if loading}<p role="status" class="mb-3 text-sm text-gray-500">
			{$i18n.t('Updating report')}
		</p>{/if}{#if truncated}<p role="alert" class="mb-3 text-sm text-amber-700">
			{$i18n.t('This list is limited to 50000 records; narrow the period')}
		</p>{/if}
	<ReportingRecords
		dataset={tab}
		{payments}
		{refunds}
		{rows}
		currency={applied.currency}
		{loading}
		error={Boolean(error)}
		onCustomer={(id) => goto(customerHref(id, applied, currentUrl()))}
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
