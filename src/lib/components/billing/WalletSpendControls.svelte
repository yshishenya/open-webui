<script lang="ts">
	import { getContext } from 'svelte';
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	const i18n = getContext('i18n');
	export let maxReplyCost = '';
	export let dailyCap = '';
	export let currentMaxReply: number | null = null;
	export let currentDailyCap: number | null = null;
	export let dailySpent: number | null = null;
	export let dailyReserved = 0;
	export let dailyResetAt: number | null = null;
	export let currency = 'RUB';
	export let savingPreferences = false;
	export let dirty = false;
	export let errorMessage = '';
	export let successMessage = '';
	export let onSave: () => void;
	const money = (value: number): string =>
		new Intl.NumberFormat(getI18nLocale($i18n), { style: 'currency', currency }).format(
			value / 100
		);
	const reset = (value: number): string =>
		new Date(value * 1000).toLocaleString(getI18nLocale($i18n));
</script>

<section class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
	<h2 class="text-base font-semibold">{$i18n.t('Spend controls')}</h2>
	<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
		{$i18n.t('Limits are checked before a paid request starts. Zero blocks paid use.')}
	</p>
	<div class="mt-4 grid gap-4 sm:grid-cols-2">
		<div>
			<label class="block text-sm" for="max-reply-cost">{$i18n.t('Maximum per reply, ₽')}</label>
			<label class="mt-2 flex min-h-11 items-center gap-2 text-sm"
				><input
					type="checkbox"
					checked={maxReplyCost === ''}
					on:change={(e) =>
						(maxReplyCost = e.currentTarget.checked
							? ''
							: currentMaxReply !== null
								? (currentMaxReply / 100).toFixed(2)
								: '0')}
				/>{$i18n.t('No limit')}</label
			>
			{#if maxReplyCost !== ''}<input
					id="max-reply-cost"
					name="max_reply_cost"
					inputmode="decimal"
					autocomplete="off"
					bind:value={maxReplyCost}
					aria-invalid={Boolean(errorMessage)}
					class="min-h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3 dark:border-gray-700"
				/>{/if}
		</div>
		<div>
			<label class="block text-sm" for="daily-cap">{$i18n.t('Maximum per day, ₽')}</label>
			<label class="mt-2 flex min-h-11 items-center gap-2 text-sm"
				><input
					type="checkbox"
					checked={dailyCap === ''}
					on:change={(e) =>
						(dailyCap = e.currentTarget.checked
							? ''
							: currentDailyCap !== null
								? (currentDailyCap / 100).toFixed(2)
								: '0')}
				/>{$i18n.t('No limit')}</label
			>
			{#if dailyCap !== ''}<input
					id="daily-cap"
					name="daily_cap"
					inputmode="decimal"
					autocomplete="off"
					bind:value={dailyCap}
					aria-invalid={Boolean(errorMessage)}
					class="min-h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3 dark:border-gray-700"
				/>{/if}
		</div>
	</div>
	{#if dailySpent !== null}<p class="mt-3 text-sm">
			{$i18n.t('Spent today')}: {money(dailySpent)}{#if currentDailyCap !== null}
				/ {money(currentDailyCap)}{/if}
		</p>{/if}
	{#if dailyReserved > 0}<p class="mt-2 text-sm">
			{$i18n.t('Reserved today')}: {money(dailyReserved)}
		</p>{/if}
	{#if dailyResetAt}<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
			{$i18n.t('Resets at')}: {reset(dailyResetAt)}
		</p>{/if}
	{#if errorMessage}<p class="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
			{errorMessage}
		</p>{/if}
	{#if successMessage}<p
			class="mt-3 text-sm text-emerald-700 dark:text-emerald-300"
			role="status"
			aria-live="polite"
		>
			{successMessage}
		</p>{/if}
	<button
		type="button"
		class="mt-4 min-h-11 rounded-xl bg-black px-4 text-sm font-medium text-white dark:bg-white dark:text-black disabled:opacity-50"
		disabled={savingPreferences || !dirty}
		on:click={onSave}>{savingPreferences ? $i18n.t('Saving…') : $i18n.t('Save limits')}</button
	>
</section>
