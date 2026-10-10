<script lang="ts">
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import { toast } from 'svelte-sonner';
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	dayjs.extend(relativeTime);

	import { onMount, getContext, tick, onDestroy } from 'svelte';
	const i18n = getContext<Readable<I18n>>('i18n');

	import { WEBUI_NAME, tools as _tools, user, workspaceActions } from '$lib/stores';

	import { goto } from '$app/navigation';
	import {
		createNewTool,
		loadToolByUrl,
		deleteToolById,
		exportTools,
		getToolById,
		getToolList,
		getTools
	} from '$lib/apis/tools';
	import { capitalizeFirstLetter } from '$lib/utils';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { ToolUserItem } from '$lib/apis/tools';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	import { parseCodeImport } from '$lib/utils/airis/function_import';

	import Tooltip from '../common/Tooltip.svelte';
	import ConfirmDialog from '../common/ConfirmDialog.svelte';
	import ToolMenu from './Tools/ToolMenu.svelte';
	import EllipsisHorizontal from '../icons/EllipsisHorizontal.svelte';
	import ValvesModal from './common/ValvesModal.svelte';
	import ManifestModal from './common/ManifestModal.svelte';
	import Heart from '../icons/Heart.svelte';
	import DeleteConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import GarbageBin from '../icons/GarbageBin.svelte';
	import Search from '../icons/Search.svelte';
	import Spinner from '../common/Spinner.svelte';
	import XMark from '../icons/XMark.svelte';
	import ImportModal from '../ImportModal.svelte';
	import ViewSelector from './common/ViewSelector.svelte';
	import Badge from '$lib/components/common/Badge.svelte';
	import ChevronDown from '../icons/ChevronDown.svelte';
	import ChevronUp from '../icons/ChevronUp.svelte';

	let shiftKey = false;
	let loaded = false;

	let toolsImportInputElement: HTMLInputElement;
	let importFiles: FileList | null = null;
	let alive = true;
	const controller = new AbortController();
	let importing = false;
	let loading = false;
	let loadFailed = false;
	let listVersion = 0;
	let pendingIds = new Set<string>();

	let showConfirm = false;
	let query = '';
	let searchDebounceTimer: ReturnType<typeof setTimeout>;

	let showManifestModal = false;
	let showValvesModal = false;
	let selectedTool: ToolUserItem | null = null;

	let showDeleteConfirm = false;

	let tools: ToolUserItem[] = [];
	let filteredItems: ToolUserItem[] = [];

	let tagsContainerElement: HTMLDivElement;
	let viewOption = '';
	let sortKey = 'updated_at';
	let sortDirection = 'desc';
	let openToolMenuId: string | null = null;

	let showImportModal = false;

	$: if (loaded) {
		workspaceActions.set([
			{
				id: 'tools-new',
				label: $i18n.t('Create'),
				href: '/workspace/tools/create'
			},
			{
				id: 'tools-import-link',
				label: $i18n.t('Import From Link'),
				onClick: () => {
					showImportModal = true;
				},
				visible: $user?.role === 'admin'
			},
			{
				id: 'tools-import',
				label: $i18n.t('Import JSON'),
				onClick: () => {
					if (!importing) toolsImportInputElement?.click();
				},
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.tools_import
			},
			{
				id: 'tools-export',
				label: $i18n.t('Export JSON'),
				onClick: async () => {
					const _tools = await exportTools(localStorage.token, controller.signal).catch((error) => {
						if (alive) toast.error(getErrorMessage(error));
						return null;
					});

					if (alive && _tools) {
						let blob = new Blob([JSON.stringify(_tools)], {
							type: 'application/json'
						});
						saveAs(blob, `tools-export-${Date.now()}.json`);
					}
				},
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.tools_export
			}
		]);
	}

	const handleSearchInput = (): void => {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			setFilteredItems();
		}, 300);
	};

	$: if (
		tools &&
		viewOption !== undefined &&
		sortKey !== undefined &&
		sortDirection !== undefined
	) {
		setFilteredItems();
	}

	const setFilteredItems = (): void => {
		const filtered = tools.filter((t) => {
			if (query === '' && viewOption === '') return true;
			const lowerQuery = query.toLowerCase();
			return (
				((t.name || '').toLowerCase().includes(lowerQuery) ||
					(t.id || '').toLowerCase().includes(lowerQuery) ||
					(t.user?.name || '').toLowerCase().includes(lowerQuery) || // Search by user name
					(t.user?.email || '').toLowerCase().includes(lowerQuery)) && // Search by user email
				(viewOption === '' ||
					(viewOption === 'created' && t.user_id === $user?.id) ||
					(viewOption === 'shared' && t.user_id !== $user?.id))
			);
		});

		filteredItems = [...filtered].sort((a, b) => {
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

	const openTool = (tool: ToolUserItem): void => {
		goto(`/workspace/tools/edit?id=${encodeURIComponent(tool.id)}`);
	};

	const shouldIgnoreRowClick = (target: EventTarget | null): boolean => {
		return target instanceof Element && !!target.closest('button, a, input, [role="menu"]');
	};

	const cloneHandler = async (tool: ToolUserItem): Promise<void> => {
		const _tool = await getToolById(localStorage.token, tool.id, controller.signal).catch(
			(error) => {
				if (alive) toast.error(getErrorMessage(error));
				return null;
			}
		);

		if (alive && _tool) {
			sessionStorage.tool = JSON.stringify({
				..._tool,
				id: `${_tool.id}_clone`,
				name: `${_tool.name} (Clone)`
			});
			goto('/workspace/tools/create');
		}
	};

	const exportHandler = async (tool: ToolUserItem): Promise<void> => {
		const _tool = await getToolById(localStorage.token, tool.id, controller.signal).catch(
			(error) => {
				if (alive) toast.error(getErrorMessage(error));
				return null;
			}
		);

		if (alive && _tool) {
			let blob = new Blob([JSON.stringify([_tool])], {
				type: 'application/json'
			});
			saveAs(blob, `tool-${_tool.id}-export-${Date.now()}.json`);
		}
	};

	const deleteHandler = async (tool: ToolUserItem | null): Promise<void> => {
		if (!alive || !tool || pendingIds.has(tool.id)) return;
		pendingIds = new Set(pendingIds).add(tool.id);
		try {
			if (!(await deleteToolById(localStorage.token, tool.id, controller.signal)))
				throw new Error($i18n.t('Failed to delete tool.'));
			if (!alive) return;
			tools = tools.filter((t) => t.id !== tool.id);
			toast.success($i18n.t('Tool deleted successfully'));
			await init();
		} catch (error) {
			if (alive) toast.error(getErrorMessage(error));
		} finally {
			pendingIds = new Set([...pendingIds].filter((id) => id !== tool.id));
		}
	};
	const init = async (): Promise<void> => {
		if (!alive) return;
		const version = ++listVersion;
		loading = true;
		loadFailed = false;
		try {
			const [next, catalog] = await Promise.all([
				getToolList(localStorage.token, controller.signal),
				getTools(localStorage.token, controller.signal)
			]);
			if (alive && version === listVersion) {
				tools = next;
				_tools.set(catalog);
			}
		} catch (error) {
			if (alive && version === listVersion) {
				loadFailed = true;
				toast.error(getErrorMessage(error));
			}
		} finally {
			if (alive && version === listVersion) {
				loading = false;
				loaded = true;
			}
		}
	};
	const clearImport = (): void => {
		importFiles = null;
		if (toolsImportInputElement) toolsImportInputElement.value = '';
	};
	const importHandler = async (): Promise<void> => {
		const file = importFiles?.[0];
		if (!alive || importing || !file) return;
		importing = true;
		let created = 0;
		try {
			const payloads = parseCodeImport(await file.text(), 'tool');
			for (const payload of payloads) {
				if (!alive) return;
				const res = await createNewTool(localStorage.token, payload, controller.signal);
				if (!res) throw new Error($i18n.t('Failed to create tool.'));
				created++;
			}
			if (alive) toast.success($i18n.t('Tool imported successfully'));
		} catch (error) {
			if (alive)
				toast.error(
					created
						? $i18n.t('Imported {{count}} tools before an error. Check the list before retrying.', {
								count: created
							}) +
								' ' +
								getErrorMessage(error)
						: $i18n.t(getErrorMessage(error))
				);
		} finally {
			if (alive) {
				clearImport();
				if (created) await init();
			}
			importing = false;
		}
	};

	onMount(() => {
		viewOption = localStorage?.workspaceViewOption || '';
		void init();
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Shift') shiftKey = true;
		};
		const onKeyUp = (event: KeyboardEvent): void => {
			if (event.key === 'Shift') shiftKey = false;
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
		{$i18n.t('Tools')} / {$WEBUI_NAME}
	</title>
</svelte:head>

<ImportModal
	bind:show={showImportModal}
	onImport={(tool) => {
		sessionStorage.tool = JSON.stringify({
			...tool
		});
		return goto('/workspace/tools/create');
	}}
	loadUrlHandler={async (url: string, signal?: AbortSignal) => {
		return await loadToolByUrl(localStorage.token, url, signal);
	}}
	successMessage={$i18n.t('Source loaded for review in the editor')}
/>

{#if loaded}
	{#if loadFailed}
		<div role="alert" class="py-2 text-sm">
			{$i18n.t('Could not load tools. Try again.')}
			<button type="button" class="underline" disabled={loading} on:click={init}
				>{$i18n.t('Retry')}</button
			>
		</div>
	{/if}
	<input
		id="documents-import-input"
		bind:this={toolsImportInputElement}
		bind:files={importFiles}
		type="file"
		accept=".json"
		hidden
		on:change={() => {
			showConfirm = true;
		}}
	/>

	<div class="space-y-1">
		<div class="flex h-8 w-full items-center gap-2">
			<div class="flex min-w-0 flex-1">
				<div class=" self-center ml-1 mr-3">
					<Search className="size-3.5" />
				</div>
				<input
					class=" w-full text-sm pr-4 py-1 rounded-r-xl outline-hidden bg-transparent"
					bind:value={query}
					on:input={handleSearchInput}
					aria-label={$i18n.t('Search Tools')}
					placeholder={$i18n.t('Search Tools')}
				/>
				{#if query}
					<div class="self-center pl-1.5 translate-y-[0.5px] rounded-l-xl bg-transparent">
						<button
							class="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition"
							aria-label={$i18n.t('Clear search')}
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
					{#each filteredItems as tool}
						<div
							class="group flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-xl px-2 py-1 text-left {tool.write_access
								? 'cursor-pointer'
								: 'cursor-not-allowed opacity-60'}"
							role="button"
							tabindex={tool.write_access ? 0 : -1}
							on:click={(e) => {
								if (!tool.write_access || shouldIgnoreRowClick(e.target)) return;
								openTool(tool);
							}}
							on:keydown={(e) => {
								if (!tool.write_access || e.currentTarget !== e.target) return;
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									openTool(tool);
								}
							}}
						>
							<div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
								<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
									<div class="flex min-w-0 items-center gap-2 overflow-hidden">
										<div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
											<Tooltip content={tool.id} className="min-w-0" placement="top-start">
												<div
													class="truncate text-[13px] leading-5 text-gray-800 group-hover:underline dark:text-gray-200"
												>
													{tool.name}
												</div>
											</Tooltip>

											{#if tool?.meta?.manifest?.version}
												<div
													class="min-w-0 max-w-[40%] shrink-0 truncate text-[11px] leading-5 text-gray-500"
												>
													v{tool?.meta?.manifest?.version ?? ''}
												</div>
											{/if}

											<Tooltip content={dayjs(tool.updated_at * 1000).format('LLLL')}>
												<div
													class="shrink-0 truncate text-[11px] leading-5 text-gray-400 dark:text-gray-600"
												>
													{dayjs(tool.updated_at * 1000).fromNow()}
												</div>
											</Tooltip>

											{#if !tool.write_access}
												<Badge type="muted" content={$i18n.t('Read Only')} />
											{/if}
										</div>
									</div>

									{#if tool?.meta?.description}
										<Tooltip
											content={tool?.meta?.description}
											className="min-w-0"
											placement="top-start"
										>
											<div
												class="mt-0.5 truncate text-[0.6875rem] leading-4 text-gray-400 dark:text-gray-600"
											>
												{tool?.meta?.description}
											</div>
										</Tooltip>
									{/if}
								</div>
							</div>

							<div
								class="hidden max-w-44 shrink-0 self-center truncate text-right text-[11px] leading-5 text-gray-500 dark:text-gray-500 md:block"
							>
								<Tooltip
									content={tool?.user?.email ?? $i18n.t('Deleted User')}
									className="min-w-0"
									placement="top-start"
								>
									<div class="truncate">
										{capitalizeFirstLetter(
											tool?.user?.name ?? tool?.user?.email ?? $i18n.t('Deleted User')
										)}
									</div>
								</Tooltip>
							</div>

							{#if tool.write_access}
								<div class="ml-2 flex shrink-0 flex-row items-center gap-1.5 self-center">
									{#if shiftKey}
										<Tooltip content={$i18n.t('Delete')}>
											<button
												class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												type="button"
												aria-label={$i18n.t('Delete')}
												disabled={pendingIds.has(tool.id)}
												on:click={(e) => {
													e.preventDefault();
													e.stopPropagation();
													deleteHandler(tool);
												}}
											>
												<GarbageBin className="size-4" />
											</button>
										</Tooltip>
									{:else}
										{#if tool?.meta?.manifest?.funding_url ?? false}
											<Tooltip content="Support">
												<button
													class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
													type="button"
													aria-label={$i18n.t('Support')}
													on:click={(e) => {
														e.preventDefault();
														e.stopPropagation();
														selectedTool = tool;
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
													selectedTool = tool;
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
														d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
													/>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
													/>
												</svg>
											</button>
										</Tooltip>

										<ToolMenu
											show={openToolMenuId === tool.id}
											editHandler={() => {
												goto(`/workspace/tools/edit?id=${encodeURIComponent(tool.id)}`);
											}}
											cloneHandler={() => {
												cloneHandler(tool);
											}}
											exportHandler={() => {
												exportHandler(tool);
											}}
											deleteHandler={async () => {
												selectedTool = tool;
												showDeleteConfirm = true;
											}}
											onClose={() => {
												openToolMenuId = null;
											}}
										>
											<button
												class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												type="button"
												aria-label={$i18n.t('Tool Menu')}
												on:click={(e) => {
													e.preventDefault();
													e.stopPropagation();
													openToolMenuId = openToolMenuId === tool.id ? null : tool.id;
												}}
											>
												<EllipsisHorizontal className="size-4" />
											</button>
										</ToolMenu>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{:else if !loadFailed}
			<div class="flex w-full flex-col items-center justify-center py-16 pb-24">
				<div class="max-w-sm text-center text-gray-900 dark:text-gray-100">
					<div class="mb-1.5 text-sm">{$i18n.t('No tools found')}</div>
					<div class="text-center text-xs leading-5 text-gray-500">
						{$i18n.t('Try adjusting your search or filter to find what you are looking for.')}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<DeleteConfirmDialog
		bind:show={showDeleteConfirm}
		title={$i18n.t('Delete tool?')}
		on:confirm={() => {
			deleteHandler(selectedTool);
		}}
	>
		<div class=" text-sm text-gray-500 truncate">
			{$i18n.t('This will delete')} <span class="  font-normal">{selectedTool?.name ?? ''}</span>.
		</div>
	</DeleteConfirmDialog>

	<ValvesModal bind:show={showValvesModal} type="tool" id={selectedTool?.id ?? null} />
	<ManifestModal bind:show={showManifestModal} manifest={selectedTool?.meta?.manifest ?? {}} />

	<ConfirmDialog bind:show={showConfirm} on:confirm={importHandler}>
		<div class="text-sm text-gray-500">
			<div class=" bg-yellow-500/20 text-yellow-700 dark:text-yellow-200 rounded-lg px-4 py-3">
				<div>{$i18n.t('Please carefully review the following warnings:')}</div>

				<ul class=" mt-1 list-disc pl-4 text-xs">
					<li>
						{$i18n.t('Tools have a function calling system that allows arbitrary code execution.')}.
					</li>
					<li>{$i18n.t('Do not install tools from sources you do not fully trust.')}</li>
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
