<script lang="ts">
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import { getContext, onDestroy } from 'svelte';

	import { getPrompts, type PromptRecord } from '$lib/apis/prompts';

	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';

	const i18n = getContext<Readable<I18n>>('i18n');

	export let query = '';
	export let onSelect: (e: { type: 'prompt'; data: PromptRecord }) => void = () => {};

	let selectedPromptIdx = 0;
	export let filteredItems: PromptRecord[] = [];
	let searchDebounceTimer: ReturnType<typeof setTimeout>;

	let items: PromptRecord[] = [];

	$: if (query !== undefined) {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			getItems();
		}, 200);
	}

	onDestroy(() => {
		clearTimeout(searchDebounceTimer);
	});

	$: filteredItems = items
		.filter((p) => p.command.toLowerCase().includes(query.toLowerCase()))
		.sort((a, b) => a.name.localeCompare(b.name));

	$: if (query) {
		selectedPromptIdx = 0;
	}

	const getItems = async (): Promise<void> => {
		const res = await getPrompts(localStorage.token).catch(() => null);
		if (res) {
			items = res;
		}
	};

	export const selectUp = (): void => {
		selectedPromptIdx = Math.max(0, selectedPromptIdx - 1);
	};
	export const selectDown = (): void => {
		selectedPromptIdx = Math.min(selectedPromptIdx + 1, filteredItems.length - 1);
	};

	export const select = async (): Promise<void> => {
		const command = filteredItems[selectedPromptIdx];
		if (command) {
			onSelect({ type: 'prompt', data: command });
		}
	};
</script>

<div class="px-2 py-1 text-[11px] text-gray-500 dark:text-gray-400">
	{$i18n.t('Prompts')}
</div>

{#if filteredItems.length > 0}
	<div class="scrollbar-hidden">
		{#each filteredItems as promptItem, promptIdx}
			<Tooltip content={promptItem.name} placement="top-start">
				<button
					class="flex h-[1.6875rem] w-full items-center gap-1.5 rounded-xl px-2 text-left text-[13px] hover:bg-gray-50/40 dark:hover:bg-gray-800/40 {promptIdx ===
					selectedPromptIdx
						? 'bg-gray-50/40 dark:bg-gray-800/40 selected-command-option-button'
						: ''}"
					type="button"
					on:click={() => {
						onSelect({ type: 'prompt', data: promptItem });
					}}
					on:mousemove={() => {
						selectedPromptIdx = promptIdx;
					}}
					on:focus={() => {}}
					data-selected={promptIdx === selectedPromptIdx}
				>
					<span class="shrink-0 font-normal text-black dark:text-gray-100">
						{promptItem.command}
					</span>

					<span class="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">
						{promptItem.name}
					</span>
				</button>
			</Tooltip>
		{/each}
	</div>
{/if}
