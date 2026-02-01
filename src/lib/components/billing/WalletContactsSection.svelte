<script lang="ts">
	import { getContext } from 'svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext('i18n');

	export let contactEmail = '';
	export let contactPhone = '';
	export let savingPreferences = false;
	export let onSave: () => void;
</script>

<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
	<div class="text-sm font-medium mb-3">{$i18n.t('Contacts for receipts')}</div>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-gray-500">{$i18n.t('Email')}</span>
			<input
				type="email"
				placeholder={$i18n.t('you@example.com')}
				bind:value={contactEmail}
				class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-gray-500">{$i18n.t('Phone')}</span>
			<input
				type="tel"
				placeholder={$i18n.t('+7 900 000 00 00')}
				bind:value={contactPhone}
				class="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent"
			/>
		</label>
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
					<span>{$i18n.t('Saving')}</span>
				</div>
			{:else}
				{$i18n.t('Save')}
			{/if}
		</button>
	</div>
</div>
