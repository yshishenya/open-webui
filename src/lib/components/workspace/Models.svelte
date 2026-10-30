<script lang="ts">
	import WorkspaceAccessModal from './common/WorkspaceAccessModal.svelte';
	let accessModal: WorkspaceAccessModal;
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/airis/error_message';

	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	import { onMount, getContext, tick, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	const i18n = getContext<any>('i18n');
	dayjs.extend(relativeTime);

	import {
		WEBUI_NAME,
		config,
		models as _models,
		pinnedModels,
		settings,
		user,
		workspaceActions,
		workspaceCounts
	} from '$lib/stores';
	import { WEBUI_API_BASE_URL } from '$lib/constants';
	import {
		exportModels,
		importModels,
		deleteModelById,
		getModelById,
		getModelItems as getWorkspaceModels,
		getModelTags,
		toggleModelById,
		updateModelById,
		type WorkspaceModel
	} from '$lib/apis/models';

	import { getModels } from '$lib/apis';
	import { updateUserSettings } from '$lib/apis/users';

	import { capitalizeFirstLetter, copyToClipboard } from '$lib/utils';
	import {
		resolveLocalizedModelDescription,
		resolveLocalizedModelName
	} from '$lib/utils/localizedContent';

	import EllipsisHorizontal from '../icons/EllipsisHorizontal.svelte';
	import ArrowRight from '../icons/ArrowRight.svelte';
	import CheckCircle from '../icons/CheckCircle.svelte';
	import Minus from '../icons/Minus.svelte';
	import ModelMenu from './Models/ModelMenu.svelte';
	import ModelDeleteConfirmDialog from '../common/ConfirmDialog.svelte';
	import Tooltip from '../common/Tooltip.svelte';
	import ProfilePreview from '$lib/components/channel/Messages/Message/ProfilePreview.svelte';
	import ProfileImage from '$lib/components/chat/Messages/ProfileImage.svelte';
	import GarbageBin from '../icons/GarbageBin.svelte';
	import Search from '../icons/Search.svelte';
	import Switch from '../common/Switch.svelte';
	import Spinner from '../common/Spinner.svelte';
	import XMark from '../icons/XMark.svelte';
	import EyeSlash from '../icons/EyeSlash.svelte';
	import Eye from '../icons/Eye.svelte';
	import ChevronDown from '../icons/ChevronDown.svelte';
	import ChevronUp from '../icons/ChevronUp.svelte';

	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import DropdownMenu from '$lib/components/common/DropdownMenu.svelte';
	import ViewSelector from './common/ViewSelector.svelte';
	import TagSelector from './common/TagSelector.svelte';
	import Pagination from '../common/Pagination.svelte';
	import Badge from '$lib/components/common/Badge.svelte';
	import CommunityDiscover from './common/CommunityDiscover.svelte';

	let shiftKey = false;

	let importFiles: FileList | null | undefined;
	let modelsImportInputElement: HTMLInputElement;
	let tagsContainerElement: HTMLDivElement;

	let loaded = false;

	let showModelDeleteConfirm = false;

	let selectedModel: WorkspaceModel | null = null;
	let updatingModels: Record<string, boolean> = {};

	let tags: string[] = [];
	let selectedTag = '';

	let query = '';
	let viewOption = '';
	let sortKey = 'updated_at';
	let sortDirection = 'desc';

	let page = 1;
	let models: WorkspaceModel[] | null = null;
	let total: number | null = null;

	let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
	let listRequest: object | null = null;
	const listenerController = new AbortController();
	let searchController: AbortController;

	onDestroy(() => {
		clearTimeout(searchDebounceTimer);
		searchController?.abort();
	});

	$: if (loaded) {
		workspaceActions.set([
			{
				id: 'models-new',
				label: $i18n.t('Create'),
				href: '/workspace/models/create'
			},
			{
				id: 'models-import',
				label: $i18n.t('Import JSON'),
				onClick: () => modelsImportInputElement?.click(),
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.models_import
			},
			{
				id: 'models-export',
				label: $i18n.t('Export JSON'),
				onClick: async () => {
					await downloadModels();
				},
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.models_export
			}
		]);
	}

	$: if (
		loaded &&
		page !== undefined &&
		selectedTag !== undefined &&
		viewOption !== undefined &&
		sortKey !== undefined &&
		sortDirection !== undefined
	) {
		getModelList();
	}

	const setSortKey = (key: string) => {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = key === 'updated_at' ? 'desc' : 'asc';
		}
	};

	const openModel = (model: WorkspaceModel) => {
		if (model.write_access) {
			goto(`/workspace/models/edit?id=${encodeURIComponent(model.id)}`);
		}
	};

	const shouldIgnoreRowClick = (target: EventTarget | null) => {
		return target instanceof Element && !!target.closest('button, a, input, [role="menu"]');
	};

	const confirmDeleteModel = (model: any) => {
		selectedModel = model;
		showModelDeleteConfirm = true;
	};

	const toggleModelHandler = async (model: any) => {
		if (updatingModels[model.id]) return;
		const previousState = !model.is_active;
		updatingModels = { ...updatingModels, [model.id]: true };

		try {
			const updatedModel = await toggleModelById(localStorage.token, model.id);
			model.is_active = updatedModel.is_active;
			models = models;
		} catch (error: any) {
			model.is_active = previousState;
			models = models;
			toast.error(`${error?.detail ?? error}`);
			return;
		} finally {
			updatingModels = { ...updatingModels, [model.id]: false };
		}

		try {
			_models.set(
				await getModels(
					localStorage.token,
					$config?.features?.enable_direct_connections
						? ($settings?.directConnections ?? null)
						: null
				)
			);
		} catch (error: any) {
			toast.error(`${error?.detail ?? error}`);
		}
	};

	const getModelList = async () => {
		if (!loaded) return;
		const request = { query, viewOption, selectedTag, sortKey, sortDirection, page };
		listRequest = request;
		const isCurrent = (): boolean =>
			loaded &&
			listRequest === request &&
			request.query === query &&
			request.viewOption === viewOption &&
			request.selectedTag === selectedTag &&
			request.sortKey === sortKey &&
			request.sortDirection === sortDirection &&
			request.page === page;

		clearTimeout(searchDebounceTimer);
		searchController?.abort();
		searchController = new AbortController();
		const { signal } = searchController;

		try {
			const res = await getWorkspaceModels(
				localStorage.token,
				query,
				viewOption,
				selectedTag,
				sortKey,
				sortDirection,
				page,
				signal
			).catch((error) => {
				if (isCurrent()) toast.error(`${error}`);
				return null;
			});

			if (res && isCurrent()) {
				models = res.items;
				total = res.total;
				workspaceCounts.update((counts) => ({ ...counts, models: total }));

				// get tags
				const nextTags = await getModelTags(localStorage.token).catch((error) => {
					if (isCurrent()) toast.error(`${error}`);
					return [];
				});
				if (isCurrent()) tags = nextTags ?? [];
			}
		} catch (err) {
			console.error(err);
		}
	};

	const deleteModelHandler = async (model: WorkspaceModel | null) => {
		if (!model) return;
		const res = await deleteModelById(localStorage.token, model.id).catch((e) => {
			toast.error(`${e}`);
			return null;
		});

		if (res) {
			toast.success($i18n.t(`Deleted {{name}}`, { name: model.id }));

			page = 1;
			getModelList();
		}

		await _models.set(
			await getModels(
				localStorage.token,
				$config?.features?.enable_direct_connections && ($settings?.directConnections ?? null)
			)
		);
	};

	const getFullModel = async (model: WorkspaceModel): Promise<WorkspaceModel> =>
		(await getModelById(localStorage.token, model.id).catch(() => null)) ?? model;

	const cloneModelHandler = async (model: WorkspaceModel) => {
		model = await getFullModel(model);
		sessionStorage.model = JSON.stringify({
			...model,
			id: `${model.id}-clone`,
			name: `${model.name} (Clone)`
		});
		goto('/workspace/models/create');
	};

	const shareModelHandler = async (model: WorkspaceModel) => {
		// LICENSE covers this Open WebUI Community wordmark.
		// Do not alter, remove, obscure, or replace it except as LICENSE permits:
		// https://docs.openwebui.com/license.
		toast.success($i18n.t('Redirecting you to Open WebUI Community'));

		const url = window.location.origin;
		const fullModel = getFullModel(model);

		const tab = window.open(`${url}/post?type=model`, '_blank');
		if (!tab) return;

		const messageHandler = async (event: MessageEvent) => {
			if (event.origin !== url || event.source !== tab || tab.closed) return;
			if (event.data === 'loaded') {
				window.removeEventListener('message', messageHandler);
				const payload = await fullModel;
				if (!listenerController.signal.aborted && !tab.closed) {
					tab.postMessage(JSON.stringify(payload), url);
				}
			}
		};

		window.addEventListener('message', messageHandler, { signal: listenerController.signal });
	};

	const hideModelHandler = async (model: WorkspaceModel) => {
		const updatedModel = {
			...model,
			meta: {
				...model.meta,
				hidden: !(model?.meta?.hidden ?? false)
			}
		};

		const res = await updateModelById(localStorage.token, updatedModel.id, updatedModel);

		if (res) {
			models =
				models?.map((model) => (model.id === updatedModel.id ? updatedModel : model)) ?? null;
			toast.success(
				$i18n.t(`Model {{name}} is now {{status}}`, {
					name: updatedModel.id,
					status: updatedModel.meta.hidden ? 'hidden' : 'visible'
				})
			);

			page = 1;
			await getModelList();
		}

		await _models.set(
			await getModels(
				localStorage.token,
				$config?.features?.enable_direct_connections && ($settings?.directConnections ?? null)
			)
		);
	};

	const copyLinkHandler = async (model: WorkspaceModel) => {
		const baseUrl = window.location.origin;
		const res = await copyToClipboard(`${baseUrl}/?model=${encodeURIComponent(model.id)}`);

		if (res) {
			toast.success($i18n.t('Copied link to clipboard'));
		} else {
			toast.error($i18n.t('Failed to copy link'));
		}
	};

	const downloadModels = async (models: WorkspaceModel[] | null = null) => {
		try {
			models = await exportModels(
				localStorage.token,
				models ? models.map((model: { id: string }) => model.id) : undefined
			);
		} catch (error: unknown) {
			toast.error(`${getErrorMessage(error)}`);
			return;
		}
		let blob = new Blob([JSON.stringify(models)], {
			type: 'application/json'
		});
		saveAs(blob, `models-export-${Date.now()}.json`);
	};

	const exportModelHandler = async (model: WorkspaceModel) => {
		try {
			[model] = await exportModels(localStorage.token, [model.id]);
		} catch (error: any) {
			toast.error(`${error?.detail ?? error}`);
			return;
		}
		let blob = new Blob([JSON.stringify([model])], {
			type: 'application/json'
		});
		saveAs(blob, `${model.id}-${Date.now()}.json`);
	};

	const pinModelHandler = async (modelId: string) => {
		settings.set({
			...$settings,
			pinnedModels: $pinnedModels.includes(modelId)
				? $pinnedModels.filter((id) => id !== modelId)
				: [...$pinnedModels, modelId]
		});
		await updateUserSettings(localStorage.token, { ui: { pinnedModels: $settings.pinnedModels } });
	};

	const fetchAllWorkspaceModels = async () => {
		// Fetch all workspace models across every page
		const allModels: WorkspaceModel[] = [];
		let currentPage = 1;
		let fetchedTotal = 0;

		for (;;) {
			const res = await getWorkspaceModels(
				localStorage.token,
				query,
				viewOption,
				selectedTag,
				null,
				null,
				currentPage
			);
			if (!res || !res.items || res.items.length === 0) break;
			allModels.push(...res.items);
			fetchedTotal = res.total;
			if (allModels.length >= fetchedTotal) break;
			currentPage++;
		}

		return allModels;
	};

	const enableAllHandler = async () => {
		const allModels = await fetchAllWorkspaceModels();
		const modelsToEnable = allModels.filter((m) => !(m.is_active ?? true));
		if (modelsToEnable.length === 0) return;
		// Optimistic UI update for current page
		(models ?? []).forEach((m) => (m.is_active = true));
		models = models;
		// Sync with server
		await Promise.all(modelsToEnable.map((model) => toggleModelById(localStorage.token, model.id)));
		await getModelList();
	};

	const disableAllHandler = async () => {
		const allModels = await fetchAllWorkspaceModels();
		const modelsToDisable = allModels.filter((m) => m.is_active ?? true);
		if (modelsToDisable.length === 0) return;
		// Optimistic UI update for current page
		(models ?? []).forEach((m) => (m.is_active = false));
		models = models;
		// Sync with server
		await Promise.all(
			modelsToDisable.map((model) => toggleModelById(localStorage.token, model.id))
		);
		await getModelList();
	};

	const showAllHandler = async () => {
		const allModels = await fetchAllWorkspaceModels();
		const modelsToShow = allModels.filter((m) => m?.meta?.hidden === true);
		if (modelsToShow.length === 0) return;
		// Optimistic UI update for current page
		(models ?? []).forEach((m) => {
			m.meta = { ...m.meta, hidden: false };
		});
		models = models;
		// Sync with server
		await Promise.all(
			modelsToShow.map((model) => {
				model.meta = { ...model.meta, hidden: false };
				return updateModelById(localStorage.token, model.id, model);
			})
		);
		await getModelList();
		toast.success($i18n.t('All models are now visible'));
	};

	const hideAllHandler = async () => {
		const allModels = await fetchAllWorkspaceModels();
		const modelsToHide = allModels.filter((m) => !(m?.meta?.hidden ?? false));
		if (modelsToHide.length === 0) return;
		// Optimistic UI update for current page
		(models ?? []).forEach((m) => {
			m.meta = { ...m.meta, hidden: true };
		});
		models = models;
		// Sync with server
		await Promise.all(
			modelsToHide.map((model) => {
				model.meta = { ...model.meta, hidden: true };
				return updateModelById(localStorage.token, model.id, model);
			})
		);
		await getModelList();
		toast.success($i18n.t('All models are now hidden'));
	};

	onMount(() => {
		viewOption = localStorage.workspaceViewOption ?? '';
		page = 1;

		void tick().then(() => {
			if (!listenerController.signal.aborted) loaded = true;
		});

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Shift') {
				shiftKey = true;
			}
		};

		const onKeyUp = (event: KeyboardEvent) => {
			if (event.key === 'Shift') {
				shiftKey = false;
			}
		};

		const onBlur = () => {
			shiftKey = false;
		};

		window.addEventListener('keydown', onKeyDown, { signal: listenerController.signal });
		window.addEventListener('keyup', onKeyUp, { signal: listenerController.signal });
		window.addEventListener('blur', onBlur, { signal: listenerController.signal });

		return () => {
			loaded = false;
			listRequest = null;
			listenerController.abort();
			clearTimeout(searchDebounceTimer);
			workspaceActions.set([]);
		};
	});
</script>

<WorkspaceAccessModal bind:this={accessModal} resourceType="models" onUpdated={getModelList} />

<svelte:head>
	<!-- LICENSE covers this Open WebUI browser-title identifier.
	Do not alter, remove, obscure, or replace it except as LICENSE permits:
	https://docs.openwebui.com/license. -->
	<title>
		{$i18n.t('Models')} / {$WEBUI_NAME}
	</title>
</svelte:head>

<h1 class="sr-only">{$i18n.t('Models')}</h1>

{#if loaded}
	<ModelDeleteConfirmDialog
		bind:show={showModelDeleteConfirm}
		on:confirm={() => {
			deleteModelHandler(selectedModel);
		}}
	/>

	<input
		id="models-import-input"
		bind:this={modelsImportInputElement}
		bind:files={importFiles}
		type="file"
		accept=".json"
		hidden
		on:change={() => {
			if (!importFiles?.length) return;

			let reader = new FileReader();
			reader.onload = async (event) => {
				let savedModels: Record<string, unknown>[] = [];
				try {
					const result = event.target?.result;
					if (typeof result !== 'string') throw new Error('Invalid JSON file');
					const parsed: unknown = JSON.parse(result);
					if (
						!Array.isArray(parsed) ||
						!parsed.every(
							(model: unknown) =>
								typeof model === 'object' && model !== null && !Array.isArray(model)
						)
					) {
						throw new Error('Invalid JSON file');
					}
					savedModels = parsed as Record<string, unknown>[];
				} catch {
					toast.error($i18n.t('Invalid JSON file'));
					return;
				}

				if (!Array.isArray(savedModels)) {
					toast.error($i18n.t('Invalid JSON file'));
					return;
				}
				try {
					await importModels(
						localStorage.token,
						savedModels.map((model) => model.info ?? model)
					);
				} catch (error: unknown) {
					toast.error(`${getErrorMessage(error)}`);
					return;
				}

				await _models.set(
					await getModels(
						localStorage.token,
						$config?.features?.enable_direct_connections && ($settings?.directConnections ?? null)
					)
				);

				page = 1;
				getModelList();
			};

			reader.readAsText(importFiles[0]);
		}}
	/>

	<div class="space-y-1">
		<div class="flex h-8 flex-1 items-center w-full gap-2">
			<div class="flex min-w-0 flex-1 items-center">
				<div class=" self-center ml-1 mr-3">
					<Search className="size-3.5" />
				</div>
				<input
					class=" w-full text-sm py-1 rounded-r-xl outline-hidden bg-transparent"
					bind:value={query}
					aria-label={$i18n.t('Search Models')}
					placeholder={$i18n.t('Search Models')}
					maxlength="500"
					on:input={() => {
						searchController?.abort();
						clearTimeout(searchDebounceTimer);
						searchDebounceTimer = setTimeout(() => {
							page = 1;
							getModelList();
						}, 300);
					}}
				/>

				{#if query}
					<div class="self-center pl-1.5 translate-y-[0.5px] rounded-l-xl bg-transparent">
						<button
							class="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition"
							aria-label={$i18n.t('Clear search')}
							on:click={() => {
								query = '';
								page = 1;
								getModelList();
							}}
						>
							<XMark className="size-3" strokeWidth="2" />
						</button>
					</div>
				{/if}
			</div>

			<div
				class="flex max-w-[60%] shrink-0 items-center gap-1 overflow-x-auto scrollbar-none"
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
							page = 1;
							await tick();
						}}
					/>

					{#if (tags ?? []).length > 0}
						<TagSelector
							bind:value={selectedTag}
							align="end"
							items={tags.map((tag) => {
								return { value: tag, label: tag };
							})}
							onChange={async () => {
								page = 1;
								await tick();
							}}
						/>
					{/if}
				</div>

				<Dropdown align="end">
					<Tooltip content={$i18n.t('Actions')}>
						<button
							class="flex h-8 min-w-0 max-w-28 items-center gap-1.5 rounded-xl bg-transparent px-1.5 text-[0.8125rem] font-normal text-gray-700 transition hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100"
							type="button"
						>
							<span class="min-w-0 truncate">{$i18n.t('Actions')}</span>
							<ChevronDown className="size-3" strokeWidth="2.5" />
						</button>
					</Tooltip>

					<div slot="content">
						<DropdownMenu className="min-w-[10.625rem] shadow-sm">
							<button
								class="flex h-[1.6875rem] w-full cursor-pointer select-none items-center gap-2 rounded-xl bg-transparent px-2 text-[0.8125rem] hover:text-gray-900 dark:hover:text-gray-100"
								type="button"
								on:click={() => {
									enableAllHandler();
								}}
							>
								<CheckCircle className="size-3.5" />
								<div class="flex items-center">{$i18n.t('Enable All')}</div>
							</button>

							<button
								class="flex h-[1.6875rem] w-full cursor-pointer select-none items-center gap-2 rounded-xl bg-transparent px-2 text-[0.8125rem] hover:text-gray-900 dark:hover:text-gray-100"
								type="button"
								on:click={() => {
									disableAllHandler();
								}}
							>
								<Minus className="size-3.5" />
								<div class="flex items-center">{$i18n.t('Disable All')}</div>
							</button>

							<hr class="mx-1 my-0.5 border-gray-100 dark:border-gray-800" />

							<button
								class="flex h-[1.6875rem] w-full cursor-pointer select-none items-center gap-2 rounded-xl bg-transparent px-2 text-[0.8125rem] hover:text-gray-900 dark:hover:text-gray-100"
								type="button"
								on:click={() => {
									showAllHandler();
								}}
							>
								<Eye className="size-3.5" />
								<div class="flex items-center">{$i18n.t('Show All')}</div>
							</button>

							<button
								class="flex h-[1.6875rem] w-full cursor-pointer select-none items-center gap-2 rounded-xl bg-transparent px-2 text-[0.8125rem] hover:text-gray-900 dark:hover:text-gray-100"
								type="button"
								on:click={() => {
									hideAllHandler();
								}}
							>
								<EyeSlash className="size-3.5" />
								<div class="flex items-center">{$i18n.t('Hide All')}</div>
							</button>
						</DropdownMenu>
					</div>
				</Dropdown>
			</div>
		</div>

		{#if models !== null}
			{#if (models ?? []).length !== 0}
				<!-- Previous labels retained for i18n extraction: {$i18n.t('Sort by')} -->
				<div class="my-1" id="model-list">
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
						{#each models as model (model.id)}
							{@const localizedModelName = resolveLocalizedModelName(model, $i18n.language)}
							<div
								class="group flex min-h-8 w-full items-center gap-1.5 overflow-hidden rounded-xl px-2 py-0.5 text-left {model.write_access
									? 'cursor-pointer'
									: ''} {model?.meta?.hidden ? 'opacity-50 dark:opacity-50' : ''}"
								id="model-item-{model.id}"
								role="presentation"
								on:click={(e) => {
									if (shouldIgnoreRowClick(e.target)) return;
									openModel(model);
								}}
							>
								<div class="shrink-0 self-center">
									<div class="{model.is_active ? '' : 'opacity-50 dark:opacity-50'} bg-transparent">
										<img
											src={`${WEBUI_API_BASE_URL}/models/model/profile/image?id=${model.id}&lang=${$i18n.language}`}
											alt=""
											class="size-7 rounded-lg object-cover"
											loading="lazy"
											decoding="async"
											on:error={(e) => {
												(e.currentTarget as HTMLImageElement).src = '/favicon.png';
											}}
										/>
									</div>
								</div>

								<div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
									<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
										<div class="flex min-w-0 items-center gap-2 overflow-hidden">
											<div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
												<Tooltip
													content={localizedModelName}
													className="min-w-0"
													placement="top-start"
												>
													{#if model.write_access}
														<a
															href={`/workspace/models/edit?id=${encodeURIComponent(model.id)}`}
															class="focus-ring block truncate rounded text-[0.8125rem] leading-5 text-gray-800 group-hover:underline focus-visible:underline dark:text-gray-200"
															>{localizedModelName}</a
														>
													{:else}
														<span
															class="block truncate text-[0.8125rem] leading-5 text-gray-800 dark:text-gray-200"
															>{localizedModelName}</span
														>
													{/if}
												</Tooltip>
												<Tooltip
													content={$i18n.t('Try in chat')}
													className="-ml-0.5 h-5 w-4 shrink-0"
													tippyOptions={{ trigger: 'mouseenter focusin' }}
												>
													<a
														href={`/?model=${encodeURIComponent(model.id)}`}
														aria-label={`${$i18n.t('Try in chat')}: ${localizedModelName}`}
														class="focus-ring flex h-5 w-4 items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
														><ArrowRight className="size-3 -rotate-45" strokeWidth="2" /></a
													>
												</Tooltip>

												<div
													class="hidden min-w-0 max-w-[40%] shrink-0 truncate text-[0.6875rem] leading-5 text-gray-500 sm:block"
												>
													{model.id}
												</div>

												<Tooltip
													content={dayjs(model.updated_at * 1000)
														.locale($i18n.language)
														.format('LLLL')}
													className="hidden shrink-0 sm:flex"
												>
													<span class="text-[0.6875rem] leading-5 text-gray-400 dark:text-gray-500"
														>{dayjs(model.updated_at * 1000)
															.locale($i18n.language)
															.fromNow()}</span
													>
												</Tooltip>

												{#if !model.write_access}
													<Badge type="muted" content={$i18n.t('Read Only')} />
												{/if}
											</div>
										</div>

										<Tooltip
											content={(
												resolveLocalizedModelDescription(model, $i18n.language) ?? ''
											).trim() ||
												model.base_model_id ||
												$i18n.t('No description')}
											className="min-w-0"
											placement="top-start"
										>
											<div
												class="truncate text-[0.6875rem] leading-4 text-gray-400 dark:text-gray-600"
											>
												{(resolveLocalizedModelDescription(model, $i18n.language) ?? '').trim() ||
													model.base_model_id ||
													$i18n.t('No description')}
											</div>
										</Tooltip>
									</div>
								</div>

								<div
									class="hidden max-w-44 shrink-0 self-center truncate text-right text-[0.6875rem] leading-5 text-gray-500 dark:text-gray-500 md:block"
								>
									<ProfilePreview user={model?.user ?? null} side="left">
										<span class="flex max-w-44 items-center gap-1.75">
											<ProfileImage
												src={model?.user?.id
													? `/api/v1/users/${model.user.id}/profile/image`
													: '/user.png'}
												className="size-4 shrink-0 rounded-full!"
											/>
											<span class="min-w-0 max-w-24 truncate">
												{capitalizeFirstLetter(
													model?.user?.name ?? model?.user?.email ?? $i18n.t('Deleted User')
												)}
											</span>
										</span>
									</ProfilePreview>
								</div>

								<div class="ml-1 flex shrink-0 flex-row items-center self-center">
									{#if shiftKey && model.write_access}
										<Tooltip content={model?.meta?.hidden ? $i18n.t('Show') : $i18n.t('Hide')}>
											<button
												class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												type="button"
												aria-label={model?.meta?.hidden ? $i18n.t('Show') : $i18n.t('Hide')}
												on:click={(e) => {
													e.preventDefault();
													e.stopPropagation();
													hideModelHandler(model);
												}}
											>
												{#if model?.meta?.hidden}
													<EyeSlash className="size-4" />
												{:else}
													<Eye className="size-4" />
												{/if}
											</button>
										</Tooltip>

										<Tooltip content={$i18n.t('Delete')}>
											<button
												class="ml-0.5 flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												type="button"
												aria-label={$i18n.t('Delete')}
												on:click={(e) => {
													e.preventDefault();
													e.stopPropagation();
													confirmDeleteModel(model);
												}}
											>
												<GarbageBin className="size-4" />
											</button>
										</Tooltip>
									{:else}
										<div class="flex shrink-0 flex-row items-center gap-1 self-center">
											<ModelMenu
												accessHandler={$user?.permissions?.sharing?.models ||
												$user?.role === 'admin'
													? () => accessModal.open(model.id)
													: null}

												{model}
												writeAccess={model.write_access ?? false}
												editHandler={() => {
													goto(`/workspace/models/edit?id=${encodeURIComponent(model.id)}`);
												}}
												shareHandler={() => {
													shareModelHandler(model);
												}}
												cloneHandler={() => {
													cloneModelHandler(model);
												}}
												exportHandler={() => {
													exportModelHandler(model);
												}}
												hideHandler={() => {
													hideModelHandler(model);
												}}
												pinModelHandler={() => {
													pinModelHandler(model.id);
												}}
												copyLinkHandler={() => {
													copyLinkHandler(model);
												}}
												deleteHandler={() => {
													confirmDeleteModel(model);
												}}
												onClose={() => {}}
											>
												<div
													class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												>
													<EllipsisHorizontal className="size-4" />
												</div>
											</ModelMenu>

											{#if model.write_access}
												<Tooltip
													content={updatingModels[model.id]
														? $i18n.t('Saving...')
														: model.is_active
															? $i18n.t('Enabled')
															: $i18n.t('Disabled')}
												>
													<Switch
														bind:state={model.is_active}
														disabled={updatingModels[model.id] ?? false}
														ariaLabel={`${$i18n.t('Enabled')}: ${localizedModelName}`}
														on:change={() => toggleModelHandler(model)}
													/>
												</Tooltip>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>

				{#if (total ?? 0) > 30}
					<Pagination bind:page count={total ?? 0} perPage={30} />
				{/if}
			{:else}
				<div class="flex w-full flex-col items-center justify-center py-16 pb-24">
					<div class="max-w-sm text-center text-gray-900 dark:text-gray-100">
						<div class="mb-1.5 text-sm">{$i18n.t('No models found')}</div>
						<div class="text-center text-xs leading-5 text-gray-500">
							{$i18n.t('Try adjusting your search or filter to find what you are looking for.')}
						</div>
					</div>
				</div>
			{/if}
		{:else}
			<div class="w-full h-full flex justify-center items-center py-10">
				<Spinner className="size-4" />
			</div>
		{/if}
	</div>

	{#if $config?.features.enable_community_sharing}
		<CommunityDiscover
			href="https://openwebui.com/search?type=model"
			title={$i18n.t('Discover a model')}
			description={$i18n.t('Discover, download, and explore model presets')}
		/>
	{/if}
{:else}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{/if}
