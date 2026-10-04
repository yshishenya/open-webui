<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	const i18n = getContext<Readable<I18nType>>('i18n');
	export let page = 1;
	export let totalPages = 1;
	export let total = 0;
	export let loading = false;
	export let onPage: (page: number) => void;
</script>

<div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
	<span class="text-gray-500"
		>{$i18n.t('Page')} {page} / {Math.max(1, totalPages)} · {total} {$i18n.t('records')}</span
	>
	<div class="flex gap-2">
		<button
			type="button"
			disabled={loading || page <= 1}
			on:click={() => onPage(page - 1)}
			class="min-h-11 rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40 dark:border-gray-700"
			>{$i18n.t('Previous')}</button
		><button
			type="button"
			disabled={loading || page >= totalPages}
			on:click={() => onPage(page + 1)}
			class="min-h-11 rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40 dark:border-gray-700"
			>{$i18n.t('Next')}</button
		>
	</div>
</div>
