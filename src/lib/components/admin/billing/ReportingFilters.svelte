<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import type { MoneyFilters } from '$lib/utils/airis/billing_reporting_ui';
	const i18n = getContext<Readable<I18nType>>('i18n');
	export let filters: MoneyFilters;
	export let loading = false;
	export let error = '';
	export let onApply: () => void;
	const presets = (days: number): void => {
		const end = new Date();
		const start = new Date(end);
		start.setUTCDate(start.getUTCDate() - days + 1);
		filters = {
			...filters,
			fromDate: start.toISOString().slice(0, 10),
			toDate: end.toISOString().slice(0, 10)
		};
	};
</script>

<form
	on:submit|preventDefault={onApply}
	class="mb-5 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
>
	<div class="flex flex-wrap items-end gap-3">
		<label class="min-w-0 text-xs text-gray-500"
			>{$i18n.t('From')}<input
				type="date"
				bind:value={filters.fromDate}
				class="min-h-11 mt-1 block w-full rounded-lg border border-gray-200 bg-transparent p-2 text-sm dark:border-gray-700"
			/></label
		>
		<label class="min-w-0 text-xs text-gray-500"
			>{$i18n.t('To')}<input
				type="date"
				bind:value={filters.toDate}
				class="min-h-11 mt-1 block w-full rounded-lg border border-gray-200 bg-transparent p-2 text-sm dark:border-gray-700"
			/></label
		>
		<label class="text-xs text-gray-500"
			>{$i18n.t('Currency')}<select
				bind:value={filters.currency}
				class="min-h-11 mt-1 block rounded-lg border border-gray-200 bg-transparent p-2 pr-8 text-sm dark:border-gray-700"
				><option>RUB</option><option>USD</option><option>EUR</option></select
			></label
		>
		<slot />
		<button
			type="submit"
			disabled={loading}
			class="min-h-11 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
			>{$i18n.t(loading ? 'Loading' : 'Apply')}</button
		>
	</div>
	<div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
		<button type="button" class="min-h-11 underline" on:click={() => presets(7)}
			>{$i18n.t('Last 7 days')}</button
		><button type="button" class="min-h-11 underline" on:click={() => presets(30)}
			>{$i18n.t('Last 30 days')}</button
		><span>{$i18n.t('Report dates: UTC')}</span>
	</div>
	{#if error}<p role="alert" class="mt-3 text-sm text-red-700 dark:text-red-300">
			{$i18n.t(error)}
		</p>{/if}
</form>
