<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { models, settings, user, config } from '$lib/stores';
	import { createEventDispatcher, onMount, getContext } from 'svelte';

	const dispatch = createEventDispatcher();
	import { getModels } from '$lib/apis';
	import {
		getConfig,
		updateConfig,
		type EvaluationConfig,
		type ArenaModel
	} from '$lib/apis/evaluations';

	import Switch from '$lib/components/common/Switch.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Model from './Evaluations/Model.svelte';
	import ArenaModelModal from './Evaluations/ArenaModelModal.svelte';
	import AdminSettingRow from './AdminSettingRow.svelte';
	import AdminSettingSection from './AdminSettingSection.svelte';

	const i18n = getContext('i18n');

	let evaluationConfig: EvaluationConfig | null = null;
	let saving = false;
	let showAddModel = false;

	const submitHandler = async (nextConfig = evaluationConfig): Promise<boolean> => {
		if (!nextConfig || saving) return false;
		saving = true;
		try {
			const saved = await updateConfig(localStorage.token, nextConfig).catch((error) => {
				toast.error(`${error}`);
				return null;
			});
			if (!saved) return false;
			evaluationConfig = saved;
			toast.success($i18n.t('Settings saved successfully!'));
			dispatch('save');
			// Configuration is saved; a catalog refresh failure must not repeat its POST.
			const catalog = await getModels(
				localStorage.token,
				$config?.features?.enable_direct_connections ? ($settings?.directConnections ?? null) : null
			).catch((error) => {
				toast.error(`${error}`);
				return null;
			});
			if (catalog) models.set(catalog);
			return true;
		} finally {
			saving = false;
		}
	};

	const addModelHandler = async (model: ArenaModel): Promise<boolean> => {
		if (!evaluationConfig) return false;
		return submitHandler({
			...evaluationConfig,
			EVALUATION_ARENA_MODELS: [...evaluationConfig.EVALUATION_ARENA_MODELS, model]
		});
	};
	const editModelHandler = async (model: ArenaModel, modelIdx: number): Promise<boolean> => {
		if (!evaluationConfig) return false;
		return submitHandler({
			...evaluationConfig,
			EVALUATION_ARENA_MODELS: evaluationConfig.EVALUATION_ARENA_MODELS.map((current, index) =>
				index === modelIdx ? model : current
			)
		});
	};
	const deleteModelHandler = async (modelIdx: number): Promise<boolean> => {
		if (!evaluationConfig) return false;
		return submitHandler({
			...evaluationConfig,
			EVALUATION_ARENA_MODELS: evaluationConfig.EVALUATION_ARENA_MODELS.filter(
				(_, index) => index !== modelIdx
			)
		});
	};

	onMount(async () => {
		if ($user?.role === 'admin') {
			evaluationConfig = await getConfig(localStorage.token).catch((err) => {
				toast.error(`${err}`);
				return null;
			});
		}
	});
</script>

<ArenaModelModal bind:show={showAddModel} onSubmit={addModelHandler} />

<form
	class="flex flex-col h-full justify-between text-sm"
	on:submit|preventDefault={() => {
		submitHandler();
	}}
>
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">{$i18n.t('Evaluations')}</h2>

	<div class="flex-1 min-h-0 overflow-y-auto scrollbar-hover pr-1.5">
		{#if evaluationConfig !== null}
			<AdminSettingSection first>
				<AdminSettingRow
					label={$i18n.t('Arena Models')}
					description={$i18n.t('Message rating should be enabled to use this feature')}
					let:labelId
				>
					<Tooltip content={$i18n.t(`Message rating should be enabled to use this feature`)}>
						<Switch
							bind:state={evaluationConfig.ENABLE_EVALUATION_ARENA_MODELS}
							ariaLabelledbyId={labelId}
						/>
					</Tooltip>
				</AdminSettingRow>
			</AdminSettingSection>

			{#if evaluationConfig.ENABLE_EVALUATION_ARENA_MODELS}
				<AdminSettingSection title={$i18n.t('Models')}>
					<div class="mb-2 flex items-center justify-between">
						<div class="text-xs text-gray-600 dark:text-gray-400">{$i18n.t('Arena Models')}</div>

						<Tooltip content={$i18n.t('Add Arena Model')}>
							<button
								class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-900 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-white"
								type="button"
								on:click={() => {
									showAddModel = true;
								}}
							>
								<Plus />
							</button>
						</Tooltip>
					</div>

					<div class="flex flex-col gap-2">
						{#if (evaluationConfig?.EVALUATION_ARENA_MODELS ?? []).length > 0}
							{#each evaluationConfig.EVALUATION_ARENA_MODELS as model, index}
								<Model
									{model}
									onSubmit={(model) => editModelHandler(model, index)}
									on:delete={() => {
										deleteModelHandler(index);
									}}
								/>
							{/each}
						{:else}
							<div class="text-center text-[0.6875rem] text-gray-400 dark:text-gray-600">
								{$i18n.t(
									`Using the default arena model with all models. Click the plus button to add custom models.`
								)}
							</div>
						{/if}
					</div>
				</AdminSettingSection>
			{/if}
		{:else}
			<div class="flex h-full justify-center">
				<div class="my-auto">
					<Spinner className="size-6" />
				</div>
			</div>
		{/if}
	</div>

	<div class="flex justify-end pt-6 text-sm font-normal">
		<button
			class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
			type="submit"
			disabled={saving || !evaluationConfig}
		>
			{$i18n.t('Save')}
		</button>
	</div>
</form>
