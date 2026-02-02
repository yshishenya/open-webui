<script lang="ts">
	import { getContext } from 'svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');

	export let maxReplyCost = '';
	export let dailyCap = '';
	export let currentMaxReply: number | null = null;
	export let currentDailyCap: number | null = null;
	export let currency: string;
	export let savingPreferences = false;
	export let onSave: () => void;

	const formatMoney = (kopeks: number | null | undefined, currencyCode: string): string => {
		if (kopeks === null || kopeks === undefined) {
			return $i18n.t('Not set');
		}
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat($i18n.locale, {
				style: 'currency',
				currency: currencyCode
			}).format(amount);
		} catch (error) {
			console.warn('Invalid currency code:', currencyCode, error);
			return `${amount.toFixed(2)} ${currencyCode}`.trim();
		}
	};
</script>

<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
	<div class="text-sm font-medium mb-3">{$i18n.t('Spend controls')}</div>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-gray-500">{$i18n.t('Max reply cost')}</span>
			<input
				type="text"
				name="max_reply_cost"
				autocomplete="off"
				inputmode="decimal"
				placeholder={$i18n.t('0.00…')}
				bind:value={maxReplyCost}
				class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
			/>
			<span class="text-xs text-gray-500">
				{$i18n.t('Current')}: {formatMoney(currentMaxReply, currency)}
			</span>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-gray-500">{$i18n.t('Daily cap')}</span>
			<input
				type="text"
				name="daily_cap"
				autocomplete="off"
				inputmode="decimal"
				placeholder={$i18n.t('0.00…')}
				bind:value={dailyCap}
				class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
			/>
			<span class="text-xs text-gray-500">
				{$i18n.t('Current')}: {formatMoney(currentDailyCap, currency)}
			</span>
		</label>
	</div>
	<div class="text-xs text-gray-500 mt-2">
		{$i18n.t('Set limits to control spending')}
	</div>
	<div class="flex justify-end mt-4">
		<button
			type="button"
			on:click={onSave}
			disabled={savingPreferences}
			class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
		>
			{#if savingPreferences}
					<div class="flex items-center gap-2">
						<Spinner className="size-4" />
						<span>{$i18n.t('Saving…')}</span>
					</div>
			{:else}
				{$i18n.t('Save')}
			{/if}
		</button>
	</div>
</div>
