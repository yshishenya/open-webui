<script lang="ts">
	import Sortable from 'sortablejs';

	import { getContext, onDestroy, onMount, tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	const i18n = getContext('i18n');

	import { chatId, config, mobile, models, settings, showSidebar } from '$lib/stores';
	import { updateUserSettings } from '$lib/apis/users';
	import PinnedModelItem from './PinnedModelItem.svelte';

	export let selectedChatId: string | null = null;
	export let shiftKey = false;

	let pinnedModels: string[] = [];
	let mounted = true;
	let sortable: Sortable | null = null;

	const persistPinnedModels = async (ids: string[]): Promise<void> => {
		settings.set({ ...$settings, pinnedModels: ids });
		try {
			const saved = await updateUserSettings(localStorage.token, { ui: $settings });
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
					const ids = [...($settings.pinnedModels ?? [])];
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
					await persistPinnedModels(ids);
				}
			});
		}
	};

	let unsubscribeSettings: (() => void) | undefined;

	const cleanupStalePinnedModels = async (modelIds: string[]): Promise<void> => {
		const validModels = modelIds.filter((id) => {
			const model = $models.find((m) => m.id === id);
			// Remove if model not found (deleted) or if hidden
			return model && !(model?.info?.meta?.hidden ?? false);
		});

		if (validModels.length !== modelIds.length) {
			await persistPinnedModels(validModels);
		}
	};

	onMount(async (): Promise<void> => {
		unsubscribeSettings = settings.subscribe((value) => {
			pinnedModels = value?.pinnedModels ?? [];
		});

		if (pinnedModels.length === 0 && $config?.default_pinned_models) {
			const defaultPinnedModels = $config.default_pinned_models.split(',').filter((id) => id);
			pinnedModels = defaultPinnedModels.filter((id) => $models.find((model) => model.id === id));

			await persistPinnedModels(pinnedModels);
		}

		// Auto-unpin hidden or deleted models
		if (mounted && pinnedModels.length > 0) {
			await cleanupStalePinnedModels(pinnedModels);
		}

		await tick();
		initPinnedModelsSortable();
	});

	onDestroy((): void => {
		mounted = false;
		unsubscribeSettings?.();
		sortable?.destroy();
	});
</script>

<div class="mt-0.5 pb-1.5" id="pinned-models-list">
	{#each pinnedModels as modelId (modelId)}
		{@const model = $models.find((model) => model.id === modelId)}
		{#if model}
			<PinnedModelItem
				{model}
				{shiftKey}
				onClick={() => {
					selectedChatId = null;
					chatId.set('');
					if ($mobile) {
						showSidebar.set(false);
					}
				}}
				onUnpin={($settings?.pinnedModels ?? []).includes(modelId)
					? async (): Promise<void> => {
							await persistPinnedModels(
								($settings.pinnedModels ?? []).filter((id) => id !== modelId)
							);
						}
					: null}
			/>
		{/if}
	{/each}
</div>
