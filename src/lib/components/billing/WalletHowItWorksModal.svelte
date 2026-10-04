<script lang="ts">
	import { getContext } from 'svelte';
	import Modal from '$lib/components/common/Modal.svelte';

	const i18n = getContext('i18n');

	export let open = false;
	export let onTopup: () => void = () => {};
	export let onLimits: () => void = () => {};
</script>

<Modal
	bind:show={open}
	size="sm"
	containerClassName="p-3"
	className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-4xl"
>
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
				class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition min-h-11 min-w-11 px-2 -my-1"
				on:click={() => (open = false)}
			>
				&times;
			</button>
		</div>

		<ol class="mt-4 list-decimal space-y-3 pl-5 text-sm text-gray-700 dark:text-gray-200">
			<li>{$i18n.t('Free usage is available on marked models while the quota lasts.')}</li>
			<li>
				{$i18n.t(
					'Top up for paid use. Before a reply, part of the balance is temporarily reserved.'
				)}
			</li>
			<li>
				{$i18n.t('After the reply, the final cost is charged and the unused reserve is released.')}
			</li>
		</ol>

		<div class="mt-5 flex flex-wrap gap-2 justify-end">
			<button
				type="button"
				class="min-h-11 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 transition text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
				on:click={() => {
					open = false;
					onLimits();
				}}
			>
				{$i18n.t('Manage limits & auto-topup')}
			</button>
			<button
				type="button"
				class="min-h-11 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
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
