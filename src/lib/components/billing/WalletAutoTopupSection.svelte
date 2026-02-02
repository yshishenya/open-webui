<script lang="ts">
	import { getContext } from 'svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');

	export let autoTopupEnabled = false;
	export let autoTopupThreshold = '';
	export let autoTopupAmount = '';
	export let savingAutoTopup = false;
	export let autoTopupFailCount: number | null = null;
	export let autoTopupLastFailedAt: number | null = null;
	export let onSave: () => void;
	const toggleLabelId = 'auto-topup-toggle-label';

	const formatDateTime = (timestamp: number | null | undefined): string => {
		if (!timestamp) return $i18n.t('Never');
		return new Date(timestamp * 1000).toLocaleString($i18n.locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};
</script>

<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
	<div class="flex items-center justify-between mb-3">
		<div class="text-sm font-medium" id={toggleLabelId}>
			{$i18n.t('Auto-topup')}
		</div>
		<Switch
			state={autoTopupEnabled}
			ariaLabelledbyId={toggleLabelId}
			on:change={(e) => (autoTopupEnabled = e.detail)}
		/>
	</div>

	{#if autoTopupFailCount && autoTopupFailCount >= 3}
		<div class="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
			{$i18n.t('Auto-topup disabled after failed attempts')}.
		</div>
	{/if}

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-gray-500">{$i18n.t('Threshold')}</span>
			<input
				type="text"
				name="auto_topup_threshold"
				autocomplete="off"
				inputmode="decimal"
				placeholder={$i18n.t('0.00…')}
				bind:value={autoTopupThreshold}
				class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
				disabled={!autoTopupEnabled}
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-gray-500">{$i18n.t('Amount')}</span>
			<input
				type="text"
				name="auto_topup_amount"
				autocomplete="off"
				inputmode="decimal"
				placeholder={$i18n.t('0.00…')}
				bind:value={autoTopupAmount}
				class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
				disabled={!autoTopupEnabled}
			/>
		</label>
	</div>

	<div class="flex items-center justify-between mt-3">
		<div class="text-xs text-gray-500">
			{$i18n.t('Failed attempts')}: {autoTopupFailCount ?? 0}
		</div>
		<button
			type="button"
			on:click={onSave}
			disabled={savingAutoTopup}
			class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
		>
			{#if savingAutoTopup}
					<div class="flex items-center gap-2">
						<Spinner className="size-4" />
						<span>{$i18n.t('Saving…')}</span>
					</div>
			{:else}
				{$i18n.t('Save')}
			{/if}
		</button>
	</div>

	<div class="text-xs text-gray-500 mt-2">
		{$i18n.t('Last failed')}: {formatDateTime(autoTopupLastFailedAt)}
	</div>
</div>
