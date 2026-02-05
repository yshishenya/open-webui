<script lang="ts">
	import { getContext } from 'svelte';

	const i18n = getContext('i18n');

	export let currency: string;
	export let defaultPackages: number[] = [];
	export let allowCustom = true;
	export let highlightedPackageKopeks: number | null = null;
	export let highlightedPackageLabel: string | null = null;
	export let creatingTopupAmount: number | null = null;
	export let customTopup = '';
	export let customTopupKopeks: number | null = null;
	export let onTopup: (amountKopeks: number) => void;
	export let onCustomTopup: () => void;

	const formatMoney = (kopeks: number, currencyCode: string): string => {
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

	$: customAmountError =
		allowCustom && customTopup.trim() && (customTopupKopeks === null || customTopupKopeks <= 0)
			? $i18n.t('Enter a valid amount')
			: '';
</script>

<div
	class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
	id="topup-section"
>
	<div class="flex items-center justify-between mb-3">
		<div class="text-sm font-medium">{$i18n.t('Top-up')}</div>
	</div>
	<div class="flex flex-wrap gap-2">
		{#each defaultPackages as amount}
			<button
				type="button"
				on:click={() => onTopup(amount)}
				class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20 {highlightedPackageKopeks === amount
					? 'ring-2 ring-amber-500/40 border-amber-500/30'
					: ''}"
				disabled={creatingTopupAmount !== null}
			>
				{creatingTopupAmount === amount
					? $i18n.t('Processing…')
					: formatMoney(amount, currency)}
			</button>
		{/each}
	</div>
	{#if allowCustom}
		<div class="mt-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
			<label class="flex flex-col gap-1 text-sm">
				<span class="text-gray-500">{$i18n.t('Custom amount')}</span>
				<input
					type="text"
					name="custom_topup"
					autocomplete="off"
					inputmode="decimal"
					placeholder={$i18n.t('0.00…')}
					bind:value={customTopup}
					aria-invalid={Boolean(customAmountError)}
					class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20 {customAmountError
						? 'border-red-500/40 focus:ring-red-500/30'
						: ''}"
					disabled={creatingTopupAmount !== null}
				/>
				{#if customAmountError}
					<span class="text-xs text-red-600 dark:text-red-300">
						{customAmountError}
					</span>
				{:else if customTopupKopeks !== null && customTopupKopeks > 0}
					<span class="text-xs text-gray-500">
						{$i18n.t('You will top up')}: {formatMoney(customTopupKopeks, currency)}
					</span>
				{/if}
			</label>
			<button
				type="button"
				on:click={onCustomTopup}
				disabled={customTopupKopeks === null || customTopupKopeks <= 0 || creatingTopupAmount !== null}
				class="h-fit sm:self-end px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
			>
				{creatingTopupAmount !== null && customTopupKopeks === creatingTopupAmount
					? $i18n.t('Processing…')
					: $i18n.t('Top up')}
			</button>
		</div>
	{:else}
		<div class="mt-4 text-xs text-gray-500">
			{$i18n.t('Custom top-up amounts are unavailable')}
		</div>
	{/if}
	{#if highlightedPackageKopeks !== null && highlightedPackageLabel}
		<div class="text-xs text-gray-500 mt-2">
			{highlightedPackageLabel}: {formatMoney(highlightedPackageKopeks, currency)}
		</div>
	{/if}
	<div class="text-xs text-gray-500 mt-2">
		{$i18n.t('Top-up packages are charged in')}: {currency}
	</div>
	<div class="text-xs text-gray-500 mt-1">
		{$i18n.t('You will be redirected to YooKassa')}
	</div>
</div>
