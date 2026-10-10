<script lang="ts">
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import { toast } from 'svelte-sonner';
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	dayjs.extend(relativeTime);

	import { WEBUI_NAME, config, functions as _functions, models, settings, user } from '$lib/stores';
	import { onMount, getContext, tick, onDestroy } from 'svelte';

	import { goto } from '$app/navigation';
	import {
		createNewFunction,
		deleteFunctionById,
		exportFunctions,
		getFunctionById,
		getFunctionList,
		getFunctions,
		loadFunctionByUrl,
		toggleFunctionById,
		toggleGlobalById
	} from '$lib/apis/functions';

	import Tooltip from '../common/Tooltip.svelte';
	import ConfirmDialog from '../common/ConfirmDialog.svelte';
	import { getModels } from '$lib/apis';
	import FunctionMenu from './Functions/FunctionMenu.svelte';
	import EllipsisHorizontal from '../icons/EllipsisHorizontal.svelte';
	import Switch from '../common/Switch.svelte';
	import ValvesModal from '../workspace/common/ValvesModal.svelte';
	import ManifestModal from '../workspace/common/ManifestModal.svelte';
	import Heart from '../icons/Heart.svelte';
	import DeleteConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import GarbageBin from '../icons/GarbageBin.svelte';
	import Search from '../icons/Search.svelte';
	import XMark from '../icons/XMark.svelte';
	import ImportModal from '../ImportModal.svelte';
	import ViewSelector from '../workspace/common/ViewSelector.svelte';
	import TagSelector from '../workspace/common/TagSelector.svelte';
	import { capitalizeFirstLetter } from '$lib/utils';
	import Spinner from '../common/Spinner.svelte';
	import SplitCreateButton from '../common/SplitCreateButton.svelte';
	import ChevronDown from '../icons/ChevronDown.svelte';
	import ChevronUp from '../icons/ChevronUp.svelte';

	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { FunctionUserItem } from '$lib/apis/functions';
	import { parseFunctionImport } from '$lib/utils/airis/function_import';
	import { getErrorMessage } from '$lib/utils/airis/error_message';

	const i18n = getContext<Readable<I18n>>('i18n');
	const controller = new AbortController();
	let alive = true;
	let pendingIds = new Set<string>();
	let importing = false;
	let refreshVersion = 0;

	let shiftKey = false;

	let functionsImportInputElement: HTMLInputElement;
	let importFiles: FileList | null = null;

	let tagsContainerElement: HTMLDivElement;
	let viewOption = '';
	let sortKey = 'updated_at';
	let sortDirection = 'desc';
	let openFunctionMenuId: string | null = null;

	let query = '';
	let searchDebounceTimer: ReturnType<typeof setTimeout>;
	let selectedType = '';

	let showImportModal = false;

	let showConfirm = false;

	let showManifestModal = false;
	let showValvesModal = false;
	let selectedFunction: FunctionUserItem | null = null;

	let showDeleteConfirm = false;

	let loaded = false;
	let functions: FunctionUserItem[] = [];
	let filteredItems: FunctionUserItem[] = [];

	const handleSearchInput = (): void => {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			setFilteredItems();
		}, 300);
	};

	const downloadFunctions = async (): Promise<void> => {
		const _functions = await exportFunctions(localStorage.token, controller.signal).catch(
			(error) => {
				if (alive) toast.error(getErrorMessage(error));
				return null;
			}
		);

		if (alive && _functions) {
			let blob = new Blob([JSON.stringify(_functions)], {
				type: 'application/json'
			});
			saveAs(blob, `functions-export-${Date.now()}.json`);
		}
	};

	$: if (
		functions &&
		selectedType !== undefined &&
		viewOption !== undefined &&
		sortKey !== undefined &&
		sortDirection !== undefined
	) {
		setFilteredItems();
	}

	const setFilteredItems = (): void => {
		filteredItems = (functions ?? [])
			.filter(
				(f) =>
					(selectedType !== '' ? f.type === selectedType : true) &&
					(query === '' ||
						f.name.toLowerCase().includes(query.toLowerCase()) ||
						f.id.toLowerCase().includes(query.toLowerCase()) ||
						(f.user?.name || '').toLowerCase().includes(query.toLowerCase()) ||
						(f.user?.email || '').toLowerCase().includes(query.toLowerCase()) ||
						(f.user?.username || '').toLowerCase().includes(query.toLowerCase())) &&
					(viewOption === '' ||
						(viewOption === 'created' && f.user_id === $user?.id) ||
						(viewOption === 'shared' && f.user_id !== $user?.id))
			)
			.sort((a, b) => {
				const direction = sortDirection === 'asc' ? 1 : -1;

				if (sortKey === 'name') {
					return direction * (a.name ?? '').localeCompare(b.name ?? '');
				}

				return direction * ((a.updated_at ?? 0) - (b.updated_at ?? 0));
			});
	};

	const setSortKey = (key: string): void => {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = key === 'updated_at' ? 'desc' : 'asc';
		}
	};

	const openFunction = (func: FunctionUserItem): void => {
		goto(`/admin/functions/edit?id=${encodeURIComponent(func.id)}`);
	};

	const shouldIgnoreRowClick = (target: EventTarget | null): boolean => {
		return target instanceof Element && !!target.closest('button, a, input, [role="menu"]');
	};
	const cloneHandler = async (func: FunctionUserItem): Promise<void> => {
		const _function = await getFunctionById(localStorage.token, func.id, controller.signal).catch(
			(error) => {
				if (alive) toast.error(getErrorMessage(error));
				return null;
			}
		);

		if (alive && _function) {
			sessionStorage.function = JSON.stringify({
				..._function,
				id: `${_function.id}_clone`,
				name: `${_function.name} (${$i18n.t('Clone')})`
			});
			goto('/admin/functions/create');
		}
	};

	const exportHandler = async (func: FunctionUserItem): Promise<void> => {
		const _function = await getFunctionById(localStorage.token, func.id, controller.signal).catch(
			(error) => {
				if (alive) toast.error(getErrorMessage(error));
				return null;
			}
		);

		if (alive && _function) {
			let blob = new Blob([JSON.stringify([_function])], {
				type: 'application/json'
			});
			saveAs(blob, `function-${_function.id}-export-${Date.now()}.json`);
		}
	};

	const refreshFunctions = async (): Promise<void> => {
		const version = ++refreshVersion;
		try {
			const [nextFunctions, nextModels] = await Promise.all([
				getFunctions(localStorage.token),
				getModels(
					localStorage.token,
					$config?.features?.enable_direct_connections && ($settings?.directConnections ?? null),
					false,
					true
				)
			]);
			if (!nextFunctions || !nextModels)
				throw new Error($i18n.t('Failed to refresh functions. Reload the page.'));
			if (alive && version === refreshVersion) {
				_functions.set(nextFunctions);
				models.set(nextModels);
			}
		} catch (error) {
			if (alive && version === refreshVersion) toast.error(getErrorMessage(error));
		}
	};

	const mutateFunction = async (
		func: FunctionUserItem,
		action: 'delete' | 'active' | 'global'
	): Promise<void> => {
		if (!alive || pendingIds.has(func.id)) return;
		pendingIds = new Set(pendingIds).add(func.id);
		try {
			if (action === 'delete') {
				if (!(await deleteFunctionById(localStorage.token, func.id, controller.signal)))
					throw new Error($i18n.t('Failed to delete function.'));
				if (!alive) return;
				functions = functions.filter((f) => f.id !== func.id);
				toast.success($i18n.t('Function deleted successfully'));
			} else {
				const res = await (action === 'active' ? toggleFunctionById : toggleGlobalById)(
					localStorage.token,
					func.id,
					controller.signal
				);
				if (!res) throw new Error($i18n.t('Failed to update function.'));
				if (!alive) return;
				functions = functions.map((f) => (f.id === func.id ? { ...f, ...res } : f));
				if (action === 'global')
					toast.success(
						$i18n.t(
							res.is_global
								? 'Function is now globally enabled'
								: 'Function is now globally disabled'
						)
					);
			}
			await refreshFunctions();
		} catch (error) {
			if (alive) toast.error(getErrorMessage(error));
		} finally {
			pendingIds = new Set([...pendingIds].filter((id) => id !== func.id));
			if (alive) functions = [...functions];
		}
	};
	const deleteHandler = (func: FunctionUserItem): Promise<void> => mutateFunction(func, 'delete');
	const toggleActiveHandler = (func: FunctionUserItem): Promise<void> =>
		mutateFunction(func, 'active');
	const toggleGlobalHandler = (func: FunctionUserItem): Promise<void> =>
		mutateFunction(func, 'global');

	const clearImport = (): void => {
		importFiles = null;
		if (functionsImportInputElement) functionsImportInputElement.value = '';
	};
	const importHandler = async (): Promise<void> => {
		const file = importFiles?.[0];
		if (!alive || importing || !file) return;
		importing = true;
		let created = 0;
		try {
			const payloads = parseFunctionImport(await file.text());
			for (const payload of payloads) {
				if (!alive) return;
				const res = await createNewFunction(localStorage.token, payload, controller.signal);
				if (!res) throw new Error($i18n.t('Failed to create function.'));
				created++;
			}
			if (alive) {
				toast.success($i18n.t('Functions imported successfully'));
				clearImport();
			}
		} catch (error) {
			if (alive)
				toast.error(
					created
						? $i18n.t(
								'Imported {{count}} functions before an error. Check the list before retrying.',
								{ count: created }
							) +
								' ' +
								getErrorMessage(error)
						: $i18n.t(getErrorMessage(error))
				);
		} finally {
			if (alive) clearImport();
			if (alive && created) {
				try {
					const next = await getFunctionList(localStorage.token, controller.signal);
					if (alive) functions = next;
				} catch (error) {
					if (alive) toast.error(getErrorMessage(error));
				}
				if (alive) await refreshFunctions();
			}
			importing = false;
		}
	};

	onMount(() => {
		viewOption = localStorage?.workspaceViewOption || '';
		void (async (): Promise<void> => {
			try {
				const next = await getFunctionList(localStorage.token, controller.signal);
				if (alive) functions = next;
			} catch (error) {
				if (alive) toast.error(getErrorMessage(error));
			} finally {
				if (alive) loaded = true;
			}
		})();

		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Shift') {
				shiftKey = true;
			}
		};

		const onKeyUp = (event: KeyboardEvent): void => {
			if (event.key === 'Shift') {
				shiftKey = false;
			}
		};

		const onBlur = (): void => {
			shiftKey = false;
		};

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', onBlur);

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', onBlur);
		};
	});

	onDestroy(() => {
		alive = false;
		controller.abort();
		clearTimeout(searchDebounceTimer);
	});
</script>

<svelte:head>
	<title>
		{$i18n.t('Functions')} / {$WEBUI_NAME}
	</title>
</svelte:head>

<ImportModal
	bind:show={showImportModal}
	loadUrlHandler={async (url: string, signal?: AbortSignal) => {
		return await loadFunctionByUrl(localStorage.token, url, signal);
	}}
	onImport={(func: { name: string; content: string }) => {
		sessionStorage.function = JSON.stringify({
			...func
		});
		return goto('/admin/functions/create');
	}}
/>

{#if loaded}
	<div class="px-2.5 w-full">
		<div class="flex flex-col gap-1 px-1 mt-0.5">
			<div class="flex justify-between items-center mb-1 w-full">
				<input
					id="documents-import-input"
					bind:this={functionsImportInputElement}
					bind:files={importFiles}
					type="file"
					disabled={importing}
					accept=".json"
					hidden
					on:change={() => {
						showConfirm = !!importFiles?.length;
						if (!showConfirm) clearImport();
					}}
				/>

				<div class="flex justify-between items-center w-full">
					<div class="flex items-center md:self-center text-sm font-normal px-0.5 gap-1.5 shrink-0">
						<div>
							{$i18n.t('Functions')}
						</div>

						<div class="text-sm font-normal text-gray-500 dark:text-gray-500 opacity-60">
							{filteredItems.length}
						</div>
					</div>

					<div class="flex w-full justify-end">
						<SplitCreateButton
							actions={[
								{
									id: 'functions-new',
									label: $i18n.t('Create'),
									href: '/admin/functions/create'
								},
								{
									id: 'functions-import-link',
									label: $i18n.t('Import From Link'),
									onClick: () => {
										showImportModal = true;
									}
								},
								{
									id: 'functions-import',
									label: $i18n.t('Import JSON'),
									onClick: () => {
										if (!importing) functionsImportInputElement?.click();
									},
									visible: $user?.role === 'admin'
								},
								{
									id: 'functions-export',
									label: $i18n.t('Export JSON'),
									onClick: downloadFunctions,
									visible: $user?.role === 'admin' && functions.length > 0
								}
							]}
						/>
					</div>
				</div>
			</div>
		</div>

		<div class="space-y-1">
			<div class="flex h-8 flex-1 items-center w-full gap-2">
				<div class="flex min-w-0 flex-1">
					<div class=" self-center ml-1 mr-3">
						<Search className="size-3.5" />
					</div>
					<input
						class=" w-full text-sm pr-4 py-1 rounded-r-xl outline-hidden bg-transparent"
						bind:value={query}
						on:input={handleSearchInput}
						placeholder={$i18n.t('Search Functions')}
					/>

					{#if query}
						<div class="self-center pl-1.5 translate-y-[0.5px] rounded-l-xl bg-transparent">
							<button
								class="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition"
								on:click={() => {
									query = '';
									handleSearchInput();
								}}
							>
								<XMark className="size-3" strokeWidth="2" />
							</button>
						</div>
					{/if}
				</div>

				<div
					class="flex max-w-[55%] shrink-0 overflow-x-auto scrollbar-none"
					bind:this={tagsContainerElement}
					on:wheel={(e) => {
						if (e.deltaY !== 0) {
							e.preventDefault();
							e.currentTarget.scrollLeft += e.deltaY;
						}
					}}
				>
					<div
						class="flex w-fit gap-0.5 text-center text-sm rounded-full bg-transparent whitespace-nowrap"
					>
						<ViewSelector
							bind:value={viewOption}
							align="end"
							onChange={async (value) => {
								localStorage.workspaceViewOption = value;

								await tick();
							}}
						/>

						<TagSelector
							bind:value={selectedType}
							align="end"
							items={[
								{ value: 'pipe', label: $i18n.t('Pipe') },
								{ value: 'filter', label: $i18n.t('Filter') },
								{ value: 'action', label: $i18n.t('Action') },
								{ value: 'event', label: $i18n.t('Event') }
							]}
						/>
					</div>
				</div>
			</div>

			{#if (filteredItems ?? []).length !== 0}
				<div class="my-1">
					<div
						class="flex w-full items-center gap-2 px-1.5 pb-0.5 text-xs text-gray-400 dark:text-gray-600"
					>
						<button
							class="flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left"
							type="button"
							on:click={() => setSortKey('name')}
						>
							{$i18n.t('Title')}
							{#if sortKey === 'name'}
								{#if sortDirection === 'asc'}
									<ChevronUp className="size-2" />
								{:else}
									<ChevronDown className="size-2" />
								{/if}
							{/if}
						</button>

						<div class="hidden w-44 shrink-0 md:block"></div>

						<button
							class="flex w-36 shrink-0 items-center justify-end gap-1 py-0.5 text-right"
							type="button"
							on:click={() => setSortKey('updated_at')}
						>
							{$i18n.t('Updated at')}
							{#if sortKey === 'updated_at'}
								{#if sortDirection === 'asc'}
									<ChevronUp className="size-2" />
								{:else}
									<ChevronDown className="size-2" />
								{/if}
							{/if}
						</button>
					</div>

					<div class="grid gap-y-0.5">
						{#each filteredItems as func (func.id)}
							<div
								class="group flex min-h-8 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-xl px-2 py-1 text-left"
								role="button"
								tabindex="0"
								on:click={(e) => {
									if (shouldIgnoreRowClick(e.target)) return;
									openFunction(func);
								}}
								on:keydown={(e) => {
									if (e.currentTarget !== e.target) return;
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										openFunction(func);
									}
								}}
							>
								<div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
									<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
										<div class="flex min-w-0 items-center gap-2 overflow-hidden">
											<div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
												<div
													class="shrink-0 rounded-sm bg-gray-500/20 px-1 text-[10px] uppercase leading-4 text-gray-700 dark:text-gray-200"
												>
													{func.type}
												</div>

												<Tooltip content={func.id} className="min-w-0" placement="top-start">
													<div
														class="truncate text-[13px] leading-5 text-gray-800 group-hover:underline dark:text-gray-200"
													>
														{func.name}
													</div>
												</Tooltip>

												{#if func?.meta?.manifest?.version}
													<div
														class="min-w-0 max-w-[40%] shrink-0 truncate text-[11px] leading-5 text-gray-500"
													>
														v{func?.meta?.manifest?.version ?? ''}
													</div>
												{/if}

												<Tooltip content={dayjs(func.updated_at * 1000).format('LLLL')}>
													<div
														class="shrink-0 truncate text-[11px] leading-5 text-gray-400 dark:text-gray-600"
													>
														{dayjs(func.updated_at * 1000).fromNow()}
													</div>
												</Tooltip>
											</div>
										</div>

										{#if func?.meta?.description}
											<Tooltip
												content={func?.meta?.description}
												className="min-w-0"
												placement="top-start"
											>
												<div
													class="mt-0.5 truncate text-[0.6875rem] leading-4 text-gray-400 dark:text-gray-600"
												>
													{func?.meta?.description}
												</div>
											</Tooltip>
										{/if}
									</div>
								</div>

								<div
									class="hidden max-w-44 shrink-0 self-center truncate text-right text-[11px] leading-5 text-gray-500 dark:text-gray-500 md:block"
								>
									<Tooltip
										content={func?.user?.email ?? $i18n.t('Deleted User')}
										className="min-w-0"
										placement="top-start"
									>
										<div class="truncate">
											{capitalizeFirstLetter(
												func?.user?.name ?? func?.user?.email ?? $i18n.t('Deleted User')
											)}
										</div>
									</Tooltip>
								</div>

								<div class="ml-2 flex shrink-0 flex-row items-center gap-1.5 self-center">
									{#if shiftKey}
										<Tooltip content={$i18n.t('Delete')}>
											<button
												class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												type="button"
												aria-label={$i18n.t('Delete')}
												on:click={(e) => {
													e.preventDefault();
													e.stopPropagation();
													deleteHandler(func);
												}}
											>
												<GarbageBin className="size-4" />
											</button>
										</Tooltip>
									{:else}
										{#if func?.meta?.manifest?.funding_url ?? false}
											<Tooltip content={$i18n.t('Support')}>
												<button
													class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
													type="button"
													aria-label={$i18n.t('Support')}
													on:click={(e) => {
														e.preventDefault();
														e.stopPropagation();
														selectedFunction = func;
														showManifestModal = true;
													}}
												>
													<Heart className="size-4" />
												</button>
											</Tooltip>
										{/if}

										<Tooltip content={$i18n.t('Valves')}>
											<button
												class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												type="button"
												aria-label={$i18n.t('Valves')}
												on:click={(e) => {
													e.preventDefault();
													e.stopPropagation();
													selectedFunction = func;
													showValvesModal = true;
												}}
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="1.5"
													stroke="currentColor"
													class="size-4"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M9.594 3.94c.09-.542.56-.940 1.11-.940h2.593c.55 0 1.02.398 1.11.940l.213 1.281c.063.374.313.686.645.870.074.040.147.083.220.127.325.196.720.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.370.490l1.296 2.247a1.125 1.125 0 0 1-.260 1.431l-1.003.827c-.293.241-.438.613-.430.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.750.430.991l1.004.827c.424.350.534.955.260 1.430l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.750-.072-1.076.124a6.47 6.47 0 0 1-.220.128c-.331.183-.581.495-.644.869l-.213 1.281c-.090.543-.560.940-1.110.940h-2.594c-.550 0-1.019-.398-1.110-.940l-.213-1.281c-.062-.374-.312-.686-.644-.870a6.52 6.52 0 0 1-.220-.127c-.325-.196-.720-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.490l-1.297-2.247a1.125 1.125 0 0 1 .260-1.431l1.004-.827c.292-.240.437-.613.430-.991a6.932 6.932 0 0 1 0-.255c.007-.380-.138-.751-.430-.992l-1.004-.827a1.125 1.125 0 0 1-.260-1.430l1.297-2.247a1.125 1.125 0 0 1 1.370-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.220-.128.332-.183.582-.495.644-.869l.214-1.280Z"
													/>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
													/>
												</svg>
											</button>
										</Tooltip>

										<FunctionMenu
											{func}
											pending={pendingIds.has(func.id)}
											show={openFunctionMenuId === func.id}
											editHandler={() => {
												goto(`/admin/functions/edit?id=${encodeURIComponent(func.id)}`);
											}}
											cloneHandler={() => {
												cloneHandler(func);
											}}
											exportHandler={() => {
												exportHandler(func);
											}}
											deleteHandler={async () => {
												selectedFunction = func;
												showDeleteConfirm = true;
											}}
											toggleGlobalHandler={() => {
												if (['filter', 'action'].includes(func.type)) {
													toggleGlobalHandler(func);
												}
											}}
											onClose={() => {
												openFunctionMenuId = null;
											}}
										>
											<button
												class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												type="button"
												aria-label={$i18n.t('Function Menu')}
												on:click={(e) => {
													e.preventDefault();
													e.stopPropagation();
													openFunctionMenuId = openFunctionMenuId === func.id ? null : func.id;
												}}
											>
												<EllipsisHorizontal className="size-4" />
											</button>
										</FunctionMenu>

										<button
											class="flex h-6 items-center"
											type="button"
											on:click={(e) => {
												e.stopPropagation();
												e.preventDefault();
											}}
										>
											<Tooltip content={func.is_active ? $i18n.t('Enabled') : $i18n.t('Disabled')}>
												<Switch
													state={func.is_active}
													ariaLabel={`${$i18n.t('Function')} ${func.name}: ${$i18n.t('Enabled')}`}
													disabled={pendingIds.has(func.id)}
													on:change={() => toggleActiveHandler(func)}
												/>
											</Tooltip>
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="flex w-full flex-col items-center justify-center py-16 pb-24">
					<div class="max-w-sm text-center text-gray-900 dark:text-gray-100">
						<div class="mb-1.5 text-sm">{$i18n.t('No functions found')}</div>
						<div class="text-center text-xs leading-5 text-gray-500">
							{$i18n.t('Try adjusting your search or filter to find what you are looking for.')}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- <div class=" text-gray-500 text-xs mt-1 mb-2">
	ⓘ {$i18n.t(
		'Admins have access to all tools at all times; users need tools assigned per model in the workspace.'
	)}
</div> -->
	</div>

	<DeleteConfirmDialog
		bind:show={showDeleteConfirm}
		title={$i18n.t('Delete function?')}
		on:confirm={() => {
			if (selectedFunction) void deleteHandler(selectedFunction);
		}}
	>
		<div class=" text-sm text-gray-500 truncate">
			{$i18n.t('This will delete')}
			<span class="  font-normal">{selectedFunction?.name ?? ''}</span>.
		</div>
	</DeleteConfirmDialog>

	<ManifestModal bind:show={showManifestModal} manifest={selectedFunction?.meta?.manifest ?? {}} />
	<ValvesModal
		bind:show={showValvesModal}
		type="function"
		id={selectedFunction?.id ?? null}
		on:save={async () => {
			await refreshFunctions();
		}}
	/>

	<ConfirmDialog
		bind:show={showConfirm}
		confirmDisabled={importing}
		on:cancel={clearImport}
		on:confirm={importHandler}
	>
		<div class="text-sm text-gray-500">
			<div class=" bg-yellow-500/20 text-yellow-700 dark:text-yellow-200 rounded-lg px-4 py-3">
				<div>{$i18n.t('Please carefully review the following warnings:')}</div>

				<ul class=" mt-1 list-disc pl-4 text-xs">
					<li>{$i18n.t('Functions allow arbitrary code execution.')}</li>
					<li>{$i18n.t('Do not install functions from sources you do not fully trust.')}</li>
				</ul>
			</div>

			<div class="my-3">
				{$i18n.t(
					'I acknowledge that I have read and I understand the implications of my action. I am aware of the risks associated with executing arbitrary code and I have verified the trustworthiness of the source.'
				)}
			</div>
		</div>
	</ConfirmDialog>
{:else}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{/if}
