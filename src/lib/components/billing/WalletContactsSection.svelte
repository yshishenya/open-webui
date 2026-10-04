<script lang="ts">
	import { getContext } from 'svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');

	export let contactEmail = '';
	export let contactPhone = '';
	export let savingPreferences = false;
	export let dirty = false;
	export let onSave: () => void;
	export let loadFailed = false;
	export let errorMessage = '';
	export let successMessage = '';
	export let onRetry: () => void = () => {};
</script>

<div
	class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4"
>
	<div class="text-sm font-medium mb-3">{$i18n.t('Where to send receipts')}</div>
	{#if loadFailed}<p role="alert" class="mb-3 text-sm text-red-700 dark:text-red-300">
			{$i18n.t('Load saved contacts before changing them')}
			<button type="button" class="min-h-11 underline" on:click={onRetry}>{$i18n.t('Retry')}</button
			>
		</p>{/if}
	<p class="mb-3 text-sm text-gray-600 dark:text-gray-300">
		{$i18n.t(
			'Receipt contact details are sent to the payment provider. Delivery is handled by the provider.'
		)}
	</p>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-gray-500">{$i18n.t('Email')}</span>
			<input
				type="email"
				name="billing_contact_email"
				autocomplete="email"
				spellcheck={false}
				placeholder={$i18n.t('you@example.com')}
				bind:value={contactEmail}
				disabled={loadFailed}
				class="min-h-11 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-gray-500">{$i18n.t('Phone')}</span>
			<input
				type="tel"
				name="billing_contact_phone"
				autocomplete="tel"
				placeholder={$i18n.t('+7 900 000 00 00')}
				bind:value={contactPhone}
				disabled={loadFailed}
				class="min-h-11 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
			/>
		</label>
	</div>
	{#if errorMessage}<p class="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
			{errorMessage}
		</p>{/if}
	<div class="flex flex-wrap items-center justify-end gap-3 mt-4">
		{#if successMessage}<p
				class="mt-3 text-sm text-emerald-700 dark:text-emerald-300"
				role="status"
				aria-live="polite"
			>
				{successMessage}
			</p>{/if}
		<button
			type="button"
			on:click={onSave}
			disabled={savingPreferences || !dirty || loadFailed}
			class="min-h-11 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
		>
			{#if savingPreferences}
				<div class="flex items-center gap-2">
					<Spinner className="size-4" />
					<span>{$i18n.t('Saving…')}</span>
				</div>
			{:else}
				{$i18n.t('Save contacts')}
			{/if}
		</button>
	</div>
</div>
