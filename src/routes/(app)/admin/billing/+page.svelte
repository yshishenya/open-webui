<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { goto } from '$app/navigation';
	import { WEBUI_NAME, user } from '$lib/stores';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import {
		getBillingReportingOverview,
		type BillingReportingOverview
	} from '$lib/apis/admin/billing_reporting';

	const i18n = getContext<Readable<I18nType>>('i18n');
	let loaded = false;
	let loading = true;
	let errorMessage = '';
	let overview: BillingReportingOverview | null = null;
	let currency = 'RUB';
	let fromDate = '';
	let toDate = '';
	let metricCards: Array<[string, number, string]> = [];

	const epoch = (value: string, end = false): number | undefined => {
		if (!value) return undefined;
		const date = new Date(`${value}T${end ? '23:59:59' : '00:00:00'}`);
		return Math.floor(date.getTime() / 1000);
	};

	const money = (kopeks: number): string =>
		new Intl.NumberFormat($i18n.language, { style: 'currency', currency, maximumFractionDigits: 2 }).format(
			kopeks / 100
		);

	const dateTime = (value: number | null): string =>
		value ? new Date(value * 1000).toLocaleString($i18n.language) : '—';

	const load = async (): Promise<void> => {
		loading = true;
		errorMessage = '';
		try {
			overview = await getBillingReportingOverview(localStorage.token, {
				currency,
				from: epoch(fromDate),
				to: epoch(toDate, true)
			});
		} catch (error) {
			console.error('Failed to load billing overview:', error);
			errorMessage = $i18n.t('Failed to load billing overview');
		} finally {
			loading = false;
		}
	};

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/');
			return;
		}
		await load();
		loaded = true;
	});

	$: maxSeries = Math.max(
		1,
		...(overview?.series ?? []).flatMap((item) => [item.paid_kopeks, item.usage_kopeks])
	);
	$: metricCards = overview
		? [
				['Paid', overview.metrics.successful_payments_kopeks, 'Successful provider payments'],
				['Payers', overview.metrics.payer_count, 'Unique customers with successful payments'],
				['Usage spend', overview.metrics.usage_spend_kopeks, 'Actual usage event cost'],
				['Paid balance', overview.metrics.paid_balance_kopeks, 'Outstanding paid balance liability'],
				['Bonus balance', overview.metrics.included_balance_kopeks, 'Included/bonus funds; not cash']
			]
			: [];
	$: reportingQuery = new URLSearchParams(
		Object.entries({
			currency,
			from_date: fromDate,
			to_date: toDate
		}).filter(([, value]) => value)
		).toString();
</script>

<svelte:head><title>{$i18n.t('Billing overview')} • {$WEBUI_NAME}</title></svelte:head>

{#if !loaded || loading}
	<div class="flex h-64 items-center justify-center"><Spinner className="size-5" /></div>
{:else if errorMessage}
	<div class="mx-auto max-w-6xl px-4 py-8">
		<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
			{errorMessage}
			<button class="ml-3 underline" on:click={load}>{$i18n.t('Retry')}</button>
		</div>
	</div>
{:else if overview}
	<div class="mx-auto max-w-7xl px-4 py-5">
		<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">{$i18n.t('Billing overview')}</h1>
				<p class="mt-1 text-sm text-gray-500">{$i18n.t('Read-only financial control center')}</p>
			</div>
			<div class="flex flex-wrap items-end gap-2">
				<label class="text-xs text-gray-500">{$i18n.t('Currency')}<select bind:value={currency} on:change={load} class="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"><option>RUB</option><option>USD</option><option>EUR</option></select></label>
				<label class="text-xs text-gray-500">{$i18n.t('From')}<input bind:value={fromDate} on:change={load} type="date" class="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
				<label class="text-xs text-gray-500">{$i18n.t('To')}<input bind:value={toDate} on:change={load} type="date" class="mt-1 block rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
			</div>
		</div>

		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
			{#each metricCards as metric}
				<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
					<div class="text-xs text-gray-500">{$i18n.t(metric[0])}</div>
					<div class="mt-2 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{metric[0] === 'Payers' ? metric[1] : money(Number(metric[1]))}</div>
					<div class="mt-1 text-xs text-gray-400">{$i18n.t(metric[2])}</div>
				</div>
			{/each}
		</div>

		<div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
			<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
				<div class="mb-3 flex items-center justify-between"><h2 class="font-medium text-gray-900 dark:text-white">{$i18n.t('Daily movement')}</h2><span class="text-xs text-gray-400">UTC · {$i18n.t(overview.time_semantics)}</span></div>
				{#if overview.series.length === 0}
					<p class="py-8 text-center text-sm text-gray-500">{$i18n.t('No financial events in this period')}</p>
				{:else}
					<div class="overflow-x-auto"><table class="w-full text-left text-sm"><caption class="sr-only">{$i18n.t('Daily payments and usage spend')}</caption><thead class="text-xs text-gray-500"><tr><th class="pb-2">{$i18n.t('Date')}</th><th class="pb-2 text-right">{$i18n.t('Paid')}</th><th class="pb-2 text-right">{$i18n.t('Usage')}</th><th class="pb-2 pl-4">{$i18n.t('Movement')}</th></tr></thead><tbody>{#each overview.series as item}<tr class="border-t border-gray-100 dark:border-gray-800"><td class="py-2 tabular-nums">{item.date}</td><td class="py-2 text-right tabular-nums">{money(item.paid_kopeks)}</td><td class="py-2 text-right tabular-nums">{money(item.usage_kopeks)}</td><td class="w-1/3 py-2 pl-4"><div class="flex gap-1" aria-label={`${item.date}: ${money(item.paid_kopeks)} paid, ${money(item.usage_kopeks)} usage`}><span class="h-2 rounded bg-emerald-500" style={`width:${(item.paid_kopeks / maxSeries) * 100}%`}></span><span class="h-2 rounded bg-blue-500" style={`width:${(item.usage_kopeks / maxSeries) * 100}%`}></span></div></td></tr>{/each}</tbody></table></div>
				{/if}
			</section>
			<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><h2 class="font-medium text-gray-900 dark:text-white">{$i18n.t('Needs attention')}</h2><div class="mt-3 space-y-3 text-sm"><div class="flex justify-between"><span>{$i18n.t('Negative balances')}</span><strong>{overview.warnings.negative_balances}</strong></div><div class="flex justify-between"><span>{$i18n.t('Pending over 24h')}</span><strong>{overview.warnings.stale_pending_payments}</strong></div><div class="flex justify-between"><span>{$i18n.t('Paid without ledger')}</span><strong>{overview.warnings.successful_topups_without_ledger}</strong></div></div><p class="mt-5 text-xs leading-5 text-gray-400">{$i18n.t('Warnings are read-only reconciliation signals. Corrective actions remain in the guarded wallet flow.')}</p><div class="mt-4 flex gap-2"><a class="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-gray-900" href={`/admin/billing/customers?${reportingQuery}`}>{$i18n.t('View customers')}</a><a class="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700" href={`/admin/billing/transactions?${reportingQuery}`}>{$i18n.t('View transactions')}</a></div></section>
		</div>
		<p class="mt-4 text-xs text-gray-400">{$i18n.t('As of')} {dateTime(overview.as_of)} · {$i18n.t('Paid time uses provider processing fallback until paid_at is persisted.')}</p>
	</div>
{/if}
