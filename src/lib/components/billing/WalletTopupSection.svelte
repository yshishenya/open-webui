<script lang="ts">
	import { getContext } from 'svelte';

	const i18n = getContext('i18n');

	export let currency: string;
	export let defaultPackages: number[] = [];
	export let allowCustom = true;
	export let autoSelectFirst = false;
	export let highlightedPackageKopeks: number | null = null;
	export let highlightedPackageLabel: string | null = null;
	export let creatingTopupAmount: number | null = null;
	export let customTopup = '';
	export let customTopupKopeks: number | null = null;
	export let onTopup: (amountKopeks: number, source?: 'package' | 'custom') => void | Promise<void>;

	const formatMoney = (kopeks: number, currencyCode: string): string => {
		const amount = kopeks / 100;
		try {
			return new Intl.NumberFormat($i18n.locale, {
				style: 'currency',
				currency: currencyCode,
				maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
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

	let selectedPackageKopeks: number | null = null;
	let userSelected = false;

	$: hasValidCustom =
		allowCustom && customTopupKopeks !== null && customTopupKopeks > 0 && !customAmountError;
	$: selectedAmountKopeks = hasValidCustom ? customTopupKopeks : selectedPackageKopeks;
	$: canProceed =
		creatingTopupAmount === null && selectedAmountKopeks !== null && selectedAmountKopeks > 0;

	$: if (
		!userSelected &&
		selectedPackageKopeks === null
	) {
		const suggestedPackage =
			highlightedPackageKopeks ?? (autoSelectFirst ? defaultPackages[0] ?? null : null);
		if (suggestedPackage !== null && defaultPackages.includes(suggestedPackage)) {
			selectedPackageKopeks = suggestedPackage;
		}
	}

	const handleSelectPackage = (amount: number): void => {
		if (creatingTopupAmount !== null) return;
		selectedPackageKopeks = amount;
		// Ensure selected amount matches what user sees (and avoid custom taking precedence).
		if (allowCustom) {
			customTopup = '';
		}
		userSelected = true;
	};

	const handleProceed = async (): Promise<void> => {
		if (!selectedAmountKopeks || selectedAmountKopeks <= 0) return;
		const source: 'package' | 'custom' = hasValidCustom ? 'custom' : 'package';
		userSelected = true;
		await onTopup(selectedAmountKopeks, source);
	};
</script>

<div
	class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4"
	id="topup-section"
>
	<div class="flex items-center justify-between mb-3">
		<div>
			<div class="text-sm font-medium">{$i18n.t('Top up balance')}</div>
			<div class="mt-1 text-xs text-gray-500">{$i18n.t('Choose an amount, then pay securely')}</div>
		</div>
	</div>
	{#if highlightedPackageKopeks !== null && highlightedPackageLabel}
		<div
			class="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
			data-testid="topup-recommendation"
		>
			<span>{highlightedPackageLabel}</span>
			<strong class="shrink-0 tabular-nums"
				>{formatMoney(highlightedPackageKopeks, currency)}</strong
			>
		</div>
	{/if}
	<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
		{#each defaultPackages as amount}
			<button
				type="button"
				on:click={() => handleSelectPackage(amount)}
				data-testid="topup-preset"
				data-amount-kopeks={amount}
				aria-pressed={selectedPackageKopeks === amount && !hasValidCustom}
				aria-label={$i18n.t('Top up {{amount}}', { amount: formatMoney(amount, currency) })}
				class="min-h-11 px-3 py-2 rounded-xl border text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20 {selectedPackageKopeks ===
					amount && !hasValidCustom
					? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
					: 'border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800'} {highlightedPackageKopeks ===
					amount && highlightedPackageLabel
					? 'ring-2 ring-amber-500/50'
					: ''}"
				disabled={creatingTopupAmount !== null}
			>
				{formatMoney(amount, currency)}
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
					on:input={(event) => {
						const value = (event.currentTarget as HTMLInputElement).value;
						// If the user starts typing a custom amount, avoid accidentally proceeding
						// with a previously selected preset.
						if (value.trim()) {
							selectedPackageKopeks = null;
						}
						userSelected = true;
					}}
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
			<div class="h-fit sm:self-end"></div>
		</div>
	{:else}
		<div class="mt-4 text-xs text-gray-500">
			{$i18n.t('Custom top-up amounts are unavailable')}
		</div>
	{/if}
	<div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
		<div class="text-xs text-gray-500">
			{#if selectedAmountKopeks !== null && selectedAmountKopeks > 0}
				{$i18n.t('Selected')}: {formatMoney(selectedAmountKopeks, currency)}
			{:else}
				{$i18n.t('Choose an amount to continue')}
			{/if}
		</div>
		<button
			type="button"
			on:click={() => void handleProceed()}
			data-testid="topup-proceed"
			disabled={!canProceed}
			class="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
		>
			{#if creatingTopupAmount !== null}
				{$i18n.t('Processing…')}
			{:else if selectedAmountKopeks !== null && selectedAmountKopeks > 0}
				{$i18n.t('Pay {{amount}}', { amount: formatMoney(selectedAmountKopeks, currency) })}
			{:else}
				{$i18n.t('Choose an amount')}
			{/if}
		</button>
	</div>
	<div class="text-xs text-gray-500 mt-3">
		{$i18n.t('Top-up packages are charged in')}: {currency} · {$i18n.t(
			'You will be redirected to YooKassa'
		)} · {$i18n.t("We don't store card details")}
	</div>
</div>
