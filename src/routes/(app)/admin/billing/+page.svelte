<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { WEBUI_NAME, user } from '$lib/stores';
	import ReportingFilters from '$lib/components/admin/billing/ReportingFilters.svelte';
	import {
		getBillingReportingOverview,
		type BillingReportingOverview
	} from '$lib/apis/admin/billing_reporting';
	import {
		moneyFilters,
		moneyRange,
		moneyQuery,
		formatReportMoney,
		formatReportTime
	} from '$lib/utils/airis/billing_reporting_ui';
	const i18n = getContext<Readable<I18nType>>('i18n');
	onDestroy(() => {
		request++;
	});
	let draft = moneyFilters($page.url);
	let applied = { ...draft };
	let loading = false;
	let error = '';
	let overview: BillingReportingOverview | null = null;
	let request = 0;
	const money = (value: number): string =>
		formatReportMoney(value, overview?.currency || applied.currency, $i18n.language);
	const link = (tab: string, extra: Record<string, string> = {}): string =>
		`/admin/billing/transactions?${moneyQuery(applied, { tab, ...extra })}`;
	const load = async (): Promise<void> => {
		let range: ReturnType<typeof moneyRange>;
		try {
			range = moneyRange(draft);
		} catch (e) {
			request++;
			loading = false;
			error = e instanceof Error ? e.message : 'Choose a valid date range';
			return;
		}
		const id = ++request;
		loading = true;
		error = '';
		const next = { ...draft };
		try {
			const result = await getBillingReportingOverview(localStorage.token, range);
			if (id !== request) return;
			overview = result;
			applied = next;
			await goto(`?${moneyQuery(applied)}`, {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		} catch {
			if (id === request) error = 'Failed to load billing overview';
		} finally {
			if (id === request) loading = false;
		}
	};
	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		await load();
	});
	$: cards = overview
		? [
				{
					label: 'Confirmed wallet top-ups',
					value: overview.metrics.successful_payments_kopeks,
					tab: 'payments',
					kind: 'topup'
				},
				{
					label: 'Returned to customers',
					value: overview.metrics.refund_kopeks,
					tab: 'refunds',
					kind: ''
				},
				{
					label: 'Top-ups after refunds',
					value: overview.metrics.net_kopeks,
					tab: 'payments',
					kind: 'topup'
				},
				{
					label: 'Usage charged',
					value: overview.metrics.usage_spend_kopeks,
					tab: 'usage',
					kind: ''
				}
			]
		: [];
</script>

<svelte:head><title>{$i18n.t('Money')} • {$WEBUI_NAME}</title></svelte:head>
<div class="mx-auto w-full min-w-0 max-w-7xl px-4 py-5">
	<h1 class="mb-4 text-xl font-semibold">{$i18n.t('Money')}</h1>
	<ReportingFilters bind:filters={draft} {loading} {error} onApply={load} />
	{#if loading}<p role="status" class="my-4 text-sm text-gray-500">
			{$i18n.t('Updating report')}
		</p>{/if}
	{#if overview && !loading && !error}
		<p class="mb-3 text-sm text-gray-500">
			{$i18n.t('For the applied period')}: {applied.fromDate} — {applied.toDate} · {overview.metrics
				.payer_count}
			{$i18n.t('paying customers')}
		</p>
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{#each cards as card}<a
					href={link(
						card.tab,
						card.kind
							? {
									kind: card.kind,
									status: 'succeeded',
									credit_status: 'credited',
									is_test: 'false'
								}
							: {}
					)}
					class="min-w-0 rounded-xl border border-gray-200 p-4 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
					><div class="text-sm text-gray-500">{$i18n.t(card.label)}</div>
					<div class="mt-2 break-words text-xl font-semibold tabular-nums">
						{money(card.value)}
					</div></a
				>{/each}
		</div>
		<p class="mt-3 text-xs text-gray-500">
			{$i18n.t(
				'Top-ups after refunds exclude fees, taxes and provider costs. Usage charged is customer spending, not company costs.'
			)}
		</p>
		{#if overview.metrics.other_payments_kopeks}<a
				href={link('payments', { kind: 'subscription' })}
				class="mt-3 block text-sm underline"
				>{$i18n.t('Other subscription payments')}: {money(
					overview.metrics.other_payments_kopeks
				)}</a
			>{/if}
		<section class="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
			<h2 class="font-medium">{$i18n.t('Customer balances now')}</h2>
			<p class="mt-1 text-xs text-gray-500">
				{$i18n.t('Current balances do not depend on the selected period')} · {formatReportTime(
					overview.as_of,
					$i18n.language
				)} UTC
			</p>
			<dl class="mt-4 grid gap-3 sm:grid-cols-2">
				<div>
					<dt class="text-sm text-gray-500">{$i18n.t('Paid funds remaining')}</dt>
					<dd class="mt-1 text-xl font-semibold tabular-nums">
						{money(overview.metrics.paid_balance_kopeks)}
					</dd>
				</div>
				<div>
					<dt class="text-sm text-gray-500">{$i18n.t('Bonus funds remaining')}</dt>
					<dd class="mt-1 text-xl font-semibold tabular-nums">
						{money(overview.metrics.included_balance_kopeks)}
					</dd>
				</div>
			</dl>
		</section>
		<section class="mt-6">
			<h2 class="mb-3 font-medium">{$i18n.t('Top-ups and refunds by day')}</h2>
			{#if overview.series.length}<div
					class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800"
				>
					<table class="w-full min-w-[420px] text-sm">
						<thead class="text-left text-gray-500"
							><tr
								><th class="p-3">{$i18n.t('Date')}</th><th class="p-3 text-right"
									>{$i18n.t('Top-ups')}</th
								><th class="p-3 text-right">{$i18n.t('Refunds')}</th><th class="p-3 text-right"
									>{$i18n.t('Usage charged')}</th
								></tr
							></thead
						><tbody
							>{#each overview.series as row}<tr
									class="border-t border-gray-100 dark:border-gray-800"
									><td class="p-3">{row.date}</td><td class="p-3 text-right tabular-nums"
										>{money(row.paid_kopeks)}</td
									><td class="p-3 text-right tabular-nums">{money(row.refund_kopeks)}</td><td
										class="p-3 text-right tabular-nums">{money(row.usage_kopeks)}</td
									></tr
								>{/each}</tbody
						>
					</table>
				</div>{:else}<p class="text-sm text-gray-500">
					{$i18n.t('No financial events in this period')}
				</p>{/if}
		</section>
		<section class="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
			<h2 class="font-medium">{$i18n.t('Needs attention now')}</h2>
			<ul class="mt-3 space-y-3 text-sm">
				<li>
					<a
						class="underline"
						href={`/admin/billing/customers?${moneyQuery(applied, { status: 'negative_balance' })}`}
						>{$i18n.t('Negative balances')}: {overview.warnings.negative_balances}</a
					>
				</li>
				<li>
					<a class="underline" href={link('payments', { attention: 'stale_pending' })}
						>{$i18n.t('Payments pending over 24 hours')}: {overview.warnings
							.stale_pending_payments}</a
					>
				</li>
				<li>
					<a class="underline" href={link('payments', { attention: 'uncredited' })}
						>{$i18n.t('Payment confirmed but wallet credit not found')}: {overview.warnings
							.successful_topups_without_ledger}</a
					>
				</li>
			</ul>
		</section>
		<p class="mt-4 text-xs text-gray-500">
			{$i18n.t('Updated')}: {formatReportTime(overview.as_of, $i18n.language)} UTC. {$i18n.t(
				'Top-ups use wallet credit time; refunds use provider refund time.'
			)}
		</p>
	{:else if !loading && !error}<p>{$i18n.t('No report available')}</p>{/if}
</div>
