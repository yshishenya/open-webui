<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { functions, tools } from '$lib/stores';
	import { createEventDispatcher, getContext, onDestroy } from 'svelte';
	import type { Writable } from 'svelte/store';
	import {
		convertValveArrays,
		type ValveSpec,
		type ValveValues
	} from '$lib/utils/airis/userValves';

	import {
		getUserValvesSpecById as getToolUserValvesSpecById,
		getUserValvesById as getToolUserValvesById,
		updateUserValvesById as updateToolUserValvesById,
		getTools
	} from '$lib/apis/tools';
	import {
		getUserValvesSpecById as getFunctionUserValvesSpecById,
		getUserValvesById as getFunctionUserValvesById,
		updateUserValvesById as updateFunctionUserValvesById,
		getFunctions
	} from '$lib/apis/functions';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Valves from '$lib/components/common/Valves.svelte';

	const dispatch = createEventDispatcher();

	const i18n = getContext<Writable<{ t: (key: string) => string }>>('i18n');

	export let show = false;

	let tab = 'tools';
	let selectedId = '';

	let loading = false;

	let valvesSpec: ValveSpec | null = null;
	let valves: ValveValues = {};
	let detailLoading = false;
	let loadFailed = false;
	let saving = false;
	let detailRequest = 0;
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	const clearSubmitTimer = (): void => {
		clearTimeout(debounceTimer);
		debounceTimer = undefined;
	};

	const resetValves = (): void => {
		clearSubmitTimer();
		detailRequest += 1;
		valvesSpec = null;
		valves = {};
		detailLoading = false;
		loadFailed = false;
		saving = false;
	};

	const isCurrent = (request: number, category: string, id: string): boolean =>
		show && request === detailRequest && tab === category && selectedId === id;

	const getUserValves = async (category: string, id: string): Promise<void> => {
		resetValves();
		const request = detailRequest;
		detailLoading = true;
		try {
			const values = await (
				category === 'tools' ? getToolUserValvesById : getFunctionUserValvesById
			)(localStorage.token, id);
			if (!isCurrent(request, category, id)) return;
			const spec = await (
				category === 'tools' ? getToolUserValvesSpecById : getFunctionUserValvesSpecById
			)(localStorage.token, id);
			if (!isCurrent(request, category, id)) return;
			const editorValues = convertValveArrays(values, spec, true);
			valves = editorValues;
			valvesSpec = spec;
		} catch {
			if (isCurrent(request, category, id)) {
				loadFailed = true;
				toast.error($i18n.t('Could not load settings. Try again.'));
			}
		} finally {
			if (isCurrent(request, category, id)) detailLoading = false;
		}
	};

	const submitHandler = async (): Promise<void> => {
		clearSubmitTimer();
		if (!show || !selectedId || !valvesSpec || detailLoading || loadFailed || saving) return;
		const request = detailRequest,
			category = tab,
			id = selectedId;
		saving = true;
		try {
			const values = convertValveArrays(valves, valvesSpec, false);
			const res = await (
				category === 'tools' ? updateToolUserValvesById : updateFunctionUserValvesById
			)(localStorage.token, id, values);
			if (!isCurrent(request, category, id)) return;
			if (res === null) throw new Error('Missing settings save response');
			valves = convertValveArrays(res, valvesSpec, true);
			toast.success($i18n.t('Valves updated'));
			dispatch('save');
		} catch {
			if (isCurrent(request, category, id))
				toast.error($i18n.t('Could not save settings. Try again.'));
		} finally {
			if (isCurrent(request, category, id)) saving = false;
		}
	};

	const debounceSubmitHandler = (): void => {
		if (saving || detailLoading || loadFailed) return;
		clearSubmitTimer();
		const request = detailRequest,
			category = tab,
			id = selectedId;
		debounceTimer = setTimeout(() => {
			if (isCurrent(request, category, id)) void submitHandler();
		}, 500);
	};

	onDestroy(resetValves);

	$: if (tab) {
		selectedId = '';
	}

	$: if (show && selectedId) {
		getUserValves(tab, selectedId);
	} else {
		resetValves();
	}

	$: if (show) {
		init();
	}

	const init = async (): Promise<void> => {
		loading = true;

		if ($functions === null) {
			functions.set(await getFunctions(localStorage.token).catch(() => null));
			if ($functions === null) {
				toast.error($i18n.t('Could not load functions. Close this section and open it again.'));
			}
		}
		if ($tools === null) {
			tools.set(await getTools(localStorage.token).catch(() => null));
			if ($tools === null) {
				toast.error($i18n.t('Could not load tools. Close this section and open it again.'));
			}
		}

		loading = false;
	};
</script>

{#if show && !loading}
	<form
		class="flex flex-col h-full justify-between space-y-2 text-xs"
		on:submit|preventDefault={() => {
			void submitHandler();
		}}
	>
		<div class="flex flex-col">
			<div class="space-y-1">
				<div class="flex gap-2">
					<div class="flex-1">
						<select
							class="w-full rounded-sm py-1 px-1 text-xs bg-transparent outline-hidden"
							bind:value={tab}
							placeholder={$i18n.t('Select')}
						>
							<option value="tools" class="bg-gray-100 dark:bg-gray-800">{$i18n.t('Tools')}</option>
							<option value="functions" class="bg-gray-100 dark:bg-gray-800"
								>{$i18n.t('Functions')}</option
							>
						</select>
					</div>

					<div class="flex-1">
						<select
							class="w-full rounded-sm py-1 px-1 text-xs bg-transparent outline-hidden"
							bind:value={selectedId}
						>
							{#if tab === 'tools'}
								<option value="" selected disabled class="bg-gray-100 dark:bg-gray-800"
									>{$i18n.t('Select a tool')}</option
								>

								{#each ($tools ?? [])
									.filter((tool) => !tool?.id?.startsWith('server:'))
									.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')) as tool}
									<option value={tool.id} class="bg-gray-100 dark:bg-gray-800">{tool.name}</option>
								{/each}
							{:else if tab === 'functions'}
								<option value="" selected disabled class="bg-gray-100 dark:bg-gray-800"
									>{$i18n.t('Select a function')}</option
								>

								{#each [...($functions ?? [])].sort( (a, b) => (a.name ?? '').localeCompare(b.name ?? '') ) as func}
									<option value={func.id} class="bg-gray-100 dark:bg-gray-800">{func.name}</option>
								{/each}
							{/if}
						</select>
					</div>
				</div>
			</div>

			{#if selectedId}
				<div class="my-1 text-xs" aria-busy={detailLoading || saving}>
					{#if detailLoading}
						<Spinner className="size-5" />
					{:else if loadFailed}
						<p role="alert">{$i18n.t('Could not load settings. Try again.')}</p>
						<button
							type="button"
							class="underline py-1"
							on:click={() => getUserValves(tab, selectedId)}>{$i18n.t('Retry')}</button
						>
					{:else}
						<fieldset class="chat-control-valves" disabled={saving}>
							<Valves {valvesSpec} bind:valves on:change={debounceSubmitHandler} />
						</fieldset>
					{/if}
				</div>
			{/if}
		</div>
	</form>
{:else}
	<Spinner className="size-4" />
{/if}

<style>
	.chat-control-valves :global(input),
	.chat-control-valves :global(select),
	.chat-control-valves :global(textarea) {
		font-size: 0.75rem;
		line-height: 1rem;
	}
</style>
