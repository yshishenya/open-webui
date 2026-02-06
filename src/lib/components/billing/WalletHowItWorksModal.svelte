<script lang="ts">
	import { getContext } from 'svelte';
	import Modal from '$lib/components/common/Modal.svelte';

	const i18n = getContext('i18n');

	export let open = false;
	export let onTopup: () => void = () => {};
	export let onLimits: () => void = () => {};
</script>

<Modal bind:show={open} size="sm" containerClassName="p-3" className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-4xl">
	<div class="p-5">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h2 class="text-lg font-semibold">{$i18n.t('How billing works')}</h2>
				<div class="text-sm text-gray-500 mt-1">
					{$i18n.t('Pay as you go wallet')}
				</div>
			</div>
			<button
				type="button"
				aria-label={$i18n.t('Close')}
				class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition px-2 -my-1"
				on:click={() => (open = false)}
			>
				&times;
			</button>
		</div>

		<ul class="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-200 list-disc pl-5">
			<li>{$i18n.t('Top up your balance and pay only for usage')}</li>
			<li>{$i18n.t('Free limit applies to select models')}</li>
			<li>{$i18n.t('After the free limit ends, usage is charged from your wallet')}</li>
			<li>{$i18n.t('Payments are processed by YooKassa')}</li>
			<li>{$i18n.t('Use limits and auto-topup to control spending')}</li>
			<li>{$i18n.t("We don't store card details")}</li>
		</ul>

		<div class="mt-5 flex flex-wrap gap-2 justify-end">
			<button
				type="button"
				class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 transition text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
				on:click={() => {
					open = false;
					onLimits();
				}}
			>
				{$i18n.t('Manage limits & auto-topup')}
			</button>
			<button
				type="button"
				class="px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
				on:click={() => {
					open = false;
					onTopup();
				}}
			>
				{$i18n.t('Top up')}
			</button>
		</div>
	</div>
</Modal>
