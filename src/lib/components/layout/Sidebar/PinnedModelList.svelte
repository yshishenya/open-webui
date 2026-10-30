<script lang="ts">
	import Sortable from 'sortablejs';

	import { getContext, onDestroy, onMount, tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	const i18n = getContext('i18n');

	import {
		chatId,
		mobile,
		models,
		pinnedModels,
		settings,
		showSidebar,
		visiblePinnedModels
	} from '$lib/stores';
	import { updateUserSettings } from '$lib/apis/users';
	import PinnedModelItem from './PinnedModelItem.svelte';

	export let selectedChatId: string | null = null;
	export let shiftKey = false;

	let mounted = true;
	let sortable: Sortable | null = null;

	const persistPinnedModels = async (ids: string[]): Promise<void> => {
		settings.set({ ...$settings, pinnedModels: ids });
		try {
			const saved = await updateUserSettings(localStorage.token, { ui: { pinnedModels: ids } });
			if (!saved) throw new Error('Settings update failed');
		} catch {
			if (mounted) toast.error($i18n.t('Failed to update settings'));
		}
	};

	const initPinnedModelsSortable = (): void => {
		const pinnedModelsList = document.getElementById('pinned-models-list');
		if (mounted && pinnedModelsList && !$mobile) {
			sortable = new Sortable(pinnedModelsList, {
				animation: 150,
				setData: (dataTransfer: DataTransfer, dragEl: HTMLElement): void => {
					dataTransfer.setData(
						'text/plain',
						JSON.stringify({ type: 'model', id: dragEl.dataset.id })
					);
				},
				onUpdate: async (event: { item: HTMLElement; newIndex?: number }): Promise<void> => {
					const modelId = event.item.dataset.id;
					const newIndex = event.newIndex;
					const ids = [...$visiblePinnedModels];
					const oldIndex = modelId ? ids.indexOf(modelId) : -1;
					if (
						!mounted ||
						!modelId ||
						oldIndex < 0 ||
						newIndex === undefined ||
						!Number.isInteger(newIndex) ||
						newIndex < 0 ||
						newIndex >= ids.length
					)
						return;
					ids.splice(oldIndex, 1);
					ids.splice(newIndex, 0, modelId);
					await persistPinnedModels([...ids, ...$pinnedModels.filter((id) => !$visiblePinnedModels.includes(id))]);
				}
			});
		}
	};

	onMount(async () => {
		await tick();
		initPinnedModelsSortable();
	});

	onDestroy((): void => {
		mounted = false;
		sortable?.destroy();
	});
</script>

<div class="mt-0.5 pb-1.5" id="pinned-models-list" role="list">
	{#each $visiblePinnedModels as modelId (modelId)}
		<PinnedModelItem
			model={$models.find((model) => model.id === modelId)!}
			{shiftKey}
			onClick={() => {
				selectedChatId = null;
				chatId.set('');
				if ($mobile) {
					showSidebar.set(false);
				}
			}}
			onUnpin={() => {
				void persistPinnedModels($pinnedModels.filter((id) => id !== modelId));
			}}
		/>
	{/each}
</div>
