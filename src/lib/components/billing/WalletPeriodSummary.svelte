<script lang="ts">
	import { getContext, onMount, onDestroy } from 'svelte';
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	import { getBillingSummary, type BillingPeriodSummary } from '$lib/apis/billing';
	const i18n = getContext('i18n');
	export let onPeriodChange: (from: number, to: number) => void = () => {};
	export let refreshRevision = 0;
	let lastRevision = refreshRevision;
	let mounted = false;
	export let initialFrom = '';
	export let initialTo = '';
	const today = new Date().toISOString().slice(0, 10);
	let start = initialFrom || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
	let end = initialTo || today;
	let appliedStart = '';
	let appliedEnd = '';
	let summary: BillingPeriodSummary | null = null;
	let loading = true;
	let error = '';
	let requestVersion = 0;
	onDestroy(() => {
		requestVersion += 1;
	});
	const money = (value: number): string =>
		new Intl.NumberFormat(getI18nLocale($i18n), {
			style: 'currency',
			currency: summary?.currency ?? 'RUB'
		}).format(value / 100);
	const apply = async (): Promise<void> => {
		const from = Date.parse(`${start}T00:00:00Z`) / 1000;
		const to = Date.parse(`${end}T00:00:00Z`) / 1000 + 86400;
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(start) ||
			!/^\d{4}-\d{2}-\d{2}$/.test(end) ||
			!Number.isFinite(from) ||
			!Number.isFinite(to) ||
			new Date(from * 1000).toISOString().slice(0, 10) !== start ||
			new Date((to - 86400) * 1000).toISOString().slice(0, 10) !== end ||
			from >= to ||
			to - from > 366 * 86400 ||
			end > today
		) {
			requestVersion += 1;
			loading = false;
			error = $i18n.t('Choose valid dates within one year, ending no later than today');
			return;
		}
		appliedStart = start;
		appliedEnd = end;
		const version = ++requestVersion;
		loading = true;
		error = '';
		summary = null;
		onPeriodChange(from, to);
		try {
			const result = await getBillingSummary(localStorage.token, from, to);
			if (version === requestVersion) summary = result;
		} catch {
			if (version === requestVersion) error = $i18n.t('Period totals could not be loaded');
		} finally {
			if (version === requestVersion) loading = false;
		}
	};
	onMount(() => {
		mounted = true;
		void apply();
	});
	$: if (mounted && refreshRevision !== lastRevision) {
		lastRevision = refreshRevision;
		void apply();
	}
</script>

<section
	class="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
	aria-label={$i18n.t('Spending for selected dates')}
	aria-busy={loading}
>
	<form class="flex flex-wrap items-end gap-3" on:submit|preventDefault={apply}>
		<label class="text-sm"
			>{$i18n.t('From date')}<input
				type="date"
				bind:value={start}
				max={end || today}
				required
				class="mt-1 block min-h-11 min-w-0 rounded-xl border border-gray-300 bg-transparent px-3 dark:border-gray-700"
			/></label
		>
		<label class="text-sm"
			>{$i18n.t('Through date')}<input
				type="date"
				bind:value={end}
				min={start}
				max={today}
				required
				class="mt-1 block min-h-11 min-w-0 rounded-xl border border-gray-300 bg-transparent px-3 dark:border-gray-700"
			/></label
		>
		<button
			class="min-h-11 rounded-xl border border-gray-300 px-4 text-sm dark:border-gray-700"
			disabled={loading}>{$i18n.t('Apply dates')}</button
		>
	</form>
	<p class="mt-2 text-xs text-gray-600 dark:text-gray-300">
		{$i18n.t('Dates include the full day in UTC')}
	</p>
	{#if error}<div class="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
			{error}<button type="button" class="ml-3 min-h-11 underline" on:click={apply}
				>{$i18n.t('Retry')}</button
			>
		</div>
	{:else if loading || summary}<p class="mt-3 text-sm font-medium">
			{#if loading}<span role="status">{$i18n.t('Loading period totals…')}</span>
			{:else}{appliedStart} — {appliedEnd}{/if}
		</p>
		<dl class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
			<div>
				<dt class="text-sm text-gray-600 dark:text-gray-300">{$i18n.t('Credited top-ups')}</dt>
				<dd class="mt-1 text-xl font-semibold tabular-nums">
					{summary ? money(summary.topup_kopeks) : '—'}
				</dd>
			</div>
			<div>
				<dt class="text-sm text-gray-600 dark:text-gray-300">{$i18n.t('Charged for usage')}</dt>
				<dd class="mt-1 text-xl font-semibold tabular-nums">
					{summary ? money(summary.spent_kopeks) : '—'}
				</dd>
			</div>
			<div>
				<dt class="text-sm text-gray-600 dark:text-gray-300">
					{$i18n.t('Confirmed payment refunds')}
				</dt>
				<dd class="mt-1 text-xl font-semibold tabular-nums">
					{summary ? money(summary.refund_kopeks) : '—'}
				</dd>
			</div>
		</dl>
		<p class="mt-3 text-xs text-gray-600 dark:text-gray-300">
			{$i18n.t('Refund confirmation and its reflection in the wallet are checked separately')}
		</p>{/if}
</section>
