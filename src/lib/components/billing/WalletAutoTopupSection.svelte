<script lang="ts">
	import { getContext } from 'svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	import { parseBillingMoney } from '$lib/utils/airis/billing_ui';
	const i18n = getContext('i18n');
	export let autoTopupEnabled = false;
	export let autoTopupThreshold = '';
	export let autoTopupAmount = '';
	export let packages: number[] = [];
	export let currency = 'RUB';
	export let savingAutoTopup = false;
	export let dirty = false;
	export let paymentMethodSaved = false;
	export let autoTopupFailCount: number | null = null;
	export let autoTopupLastFailedAt: number | null = null;
	export let errorMessage = '';
	export let successMessage = '';
	export let onSave: () => void;
	const money = (value: number): string =>
		new Intl.NumberFormat(getI18nLocale($i18n), { style: 'currency', currency }).format(
			value / 100
		);
	$: threshold = parseBillingMoney(autoTopupThreshold);
	$: amount = parseBillingMoney(autoTopupAmount);
</script>

<section class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 id="auto-topup-label" class="text-base font-semibold">{$i18n.t('Auto-topup')}</h2>
		<Switch
			state={autoTopupEnabled}
			ariaLabelledbyId="auto-topup-label"
			on:change={(e) => (autoTopupEnabled = e.detail)}
		/>
	</div>
	<p class="mt-2 text-sm text-gray-600 dark:text-gray-300" role="status">
		{!autoTopupEnabled
			? $i18n.t('Disabled')
			: !paymentMethodSaved
				? $i18n.t('A saved payment method is required')
				: $i18n.t('Payment method is saved for auto-topup')}{dirty
			? ` · ${$i18n.t('Changes take effect after saving')}`
			: ''}
	</p>
	{#if (autoTopupFailCount ?? 0) >= 3}<p
			class="mt-3 text-sm text-red-700 dark:text-red-300"
			role="alert"
		>
			{$i18n.t('Auto-topup disabled after failed attempts')}
		</p>{/if}
	<div class="mt-4 grid gap-4 sm:grid-cols-2">
		<label class="text-sm"
			><span>{$i18n.t('Balance threshold, ₽')}</span><input
				name="auto_topup_threshold"
				inputmode="decimal"
				autocomplete="off"
				bind:value={autoTopupThreshold}
				disabled={!autoTopupEnabled}
				aria-invalid={Boolean(errorMessage)}
				class="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3 dark:border-gray-700 disabled:opacity-50"
			/></label
		>
		<label class="text-sm"
			><span>{$i18n.t('Top-up amount')}</span><select
				name="auto_topup_amount"
				bind:value={autoTopupAmount}
				disabled={!autoTopupEnabled}
				class="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-900 disabled:opacity-50"
				><option value="">{$i18n.t('Choose an amount')}</option>{#each packages as pack}<option
						value={(pack / 100).toFixed(2)}>{money(pack)}</option
					>{/each}</select
			></label
		>
	</div>
	{#if autoTopupEnabled && threshold !== null && amount !== null}<p class="mt-3 text-sm">
			{$i18n.t(
				'Before a paid request, top up {{amount}} when the available balance is at most {{threshold}} or is insufficient.',
				{ amount: money(amount), threshold: money(threshold) }
			)}
		</p>{/if}
	{#if autoTopupEnabled && !paymentMethodSaved}<p class="mt-3 text-sm">
			{$i18n.t('Save these settings, then make a manual top-up to save your payment method.')}
		</p>{/if}
	{#if errorMessage}<p class="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
			{errorMessage}
		</p>{/if}
	{#if autoTopupLastFailedAt}<p class="mt-3 text-sm text-gray-600 dark:text-gray-300">
			{$i18n.t('Last failed')}: {new Date(autoTopupLastFailedAt * 1000).toLocaleString(
				getI18nLocale($i18n)
			)}
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
		disabled={savingAutoTopup || !dirty}
		on:click={onSave}>{savingAutoTopup ? $i18n.t('Saving…') : $i18n.t('Save auto-topup')}</button
	>
</section>
