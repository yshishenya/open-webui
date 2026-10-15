<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { Readable } from 'svelte/store';
	import {
		convertValveArrays,
		type ValveValues,
		type ValveSpec
	} from '$lib/utils/airis/userValves';
	import { getContext } from 'svelte';

	import Modal from '../../common/Modal.svelte';
	import {
		getFunctionValvesById,
		getFunctionValvesSpecById,
		updateFunctionValvesById
	} from '$lib/apis/functions';
	import { getToolValvesById, getToolValvesSpecById, updateToolValvesById } from '$lib/apis/tools';

	import {
		getUserValvesSpecById as getToolUserValvesSpecById,
		getUserValvesById as getToolUserValvesById,
		updateUserValvesById as updateToolUserValvesById
	} from '$lib/apis/tools';
	import {
		getUserValvesSpecById as getFunctionUserValvesSpecById,
		getUserValvesById as getFunctionUserValvesById,
		updateUserValvesById as updateFunctionUserValvesById
	} from '$lib/apis/functions';

	import Spinner from '../../common/Spinner.svelte';
	import Valves from '$lib/components/common/Valves.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';

	const i18n = getContext<Readable<{ t: (key: string) => string }>>('i18n');
	const dispatch = createEventDispatcher<{ save: void; close: void }>();

	export let show = false;

	export let type = 'tool';
	export let id: string | null = null;
	export let userValves = false;

	let saving = false;
	let loading = false;
	let loadFailed = false;
	let valvesSpec: ValveSpec | null = null;
	let valves: ValveValues = {};
	let controller: AbortController | null = null;
	let alive = true;
	let wasOpen = show;
	const apis = {
		tool: {
			shared: {
				values: getToolValvesById,
				spec: getToolValvesSpecById,
				save: updateToolValvesById
			},
			user: {
				values: getToolUserValvesById,
				spec: getToolUserValvesSpecById,
				save: updateToolUserValvesById
			}
		},
		function: {
			shared: {
				values: getFunctionValvesById,
				spec: getFunctionValvesSpecById,
				save: updateFunctionValvesById
			},
			user: {
				values: getFunctionUserValvesById,
				spec: getFunctionUserValvesSpecById,
				save: updateFunctionUserValvesById
			}
		}
	};
	const getAPI = (category: string, personal: boolean): typeof apis.tool.shared => {
		if (category !== 'tool' && category !== 'function')
			throw new Error('Invalid settings category');
		return apis[category][personal ? 'user' : 'shared'];
	};
	const reset = (): void => {
		controller?.abort();
		controller = null;
		valves = {};
		valvesSpec = null;
		loading = false;
		saving = false;
		loadFailed = false;
	};
	const current = (
		request: AbortController,
		category: string,
		record: string,
		personal: boolean
	): boolean =>
		alive &&
		show &&
		controller === request &&
		!request.signal.aborted &&
		type === category &&
		id === record &&
		userValves === personal;

	const initHandler = async (
		category: string = type,
		record: string | null = id,
		personal: boolean = userValves
	): Promise<void> => {
		reset();
		if (!alive || !show || !record) return;
		const request = new AbortController();
		controller = request;
		loading = true;
		try {
			const api = getAPI(category, personal);
			const values = await api.values(localStorage.token, record, request.signal);
			if (!current(request, category, record, personal)) return;
			const spec = await api.spec(localStorage.token, record, request.signal);
			if (!current(request, category, record, personal)) return;
			const editor = convertValveArrays(values, spec, true);
			valves = editor;
			valvesSpec = spec;
		} catch {
			if (current(request, category, record, personal)) {
				loadFailed = true;
				toast.error($i18n.t('Could not load settings. Try again.'));
			}
		} finally {
			if (current(request, category, record, personal)) loading = false;
		}
	};
	const submitHandler = async (): Promise<void> => {
		if (!alive || !show || !id || !controller || !valvesSpec || loading || loadFailed || saving)
			return;
		const request = controller,
			category = type,
			record = id,
			personal = userValves;
		saving = true;
		try {
			const payload = convertValveArrays(valves, valvesSpec, false);
			const res = await getAPI(category, personal).save(
				localStorage.token,
				record,
				payload,
				request.signal
			);
			if (!current(request, category, record, personal)) return;
			if (res === null) throw new Error('Missing settings save response');
			valves = convertValveArrays(res, valvesSpec, true);
			toast.success($i18n.t('Valves updated successfully'));
			dispatch('save');
		} catch {
			if (current(request, category, record, personal))
				toast.error($i18n.t('Could not save settings. Try again.'));
		} finally {
			if (current(request, category, record, personal)) saving = false;
		}
	};
	onDestroy(() => {
		alive = false;
		reset();
	});
	$: if (show && id) {
		void initHandler(type, id, userValves);
	} else {
		reset();
	}
	$: if (show !== wasOpen) {
		wasOpen = show;
		if (!show) dispatch('close');
	}
</script>

<Modal size="sm" bind:show>
	<div>
		<div class="flex justify-between dark:text-gray-100 px-4 pt-3 pb-1">
			<div class="self-center text-sm font-medium">{$i18n.t('Valves')}</div>
			<button
				aria-label={$i18n.t('Close')}
				class="self-center rounded-lg p-1 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
				on:click={() => {
					show = false;
				}}
			>
				<XMark className={'size-4'} />
			</button>
		</div>

		<div class="flex flex-col md:flex-row w-full px-4 pb-3 md:space-x-4 dark:text-gray-200">
			<div class=" flex flex-col w-full sm:flex-row sm:justify-center sm:space-x-6">
				<form
					class="flex flex-col w-full"
					on:submit|preventDefault={() => {
						submitHandler();
					}}
				>
					<div>
						{#if loading}
							<Spinner className="size-5" />
						{:else if loadFailed}
							<p role="alert">{$i18n.t('Could not load settings. Try again.')}</p>
							<button type="button" class="underline py-1" on:click={() => initHandler()}
								>{$i18n.t('Retry')}</button
							>
						{:else}
							<fieldset disabled={saving} aria-busy={saving}>
								<Valves {valvesSpec} bind:valves />
							</fieldset>
						{/if}
					</div>

					<div class="flex justify-end pt-2.5 text-sm font-normal">
						<button
							class="px-3 py-1.5 text-sm font-normal bg-black hover:bg-gray-950 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full flex items-center gap-2 whitespace-nowrap {saving
								? ' cursor-not-allowed'
								: ''}"
							type="submit"
							disabled={saving || loading || loadFailed || !valvesSpec || !id}
						>
							{$i18n.t('Save')}

							{#if saving}
								<span class="shrink-0">
									<Spinner />
								</span>
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</Modal>
