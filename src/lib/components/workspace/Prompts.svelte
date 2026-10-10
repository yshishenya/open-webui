<script lang="ts">
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import { toast } from 'svelte-sonner';
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	dayjs.extend(relativeTime);

	import { goto } from '$app/navigation';
	import { onMount, getContext, tick, onDestroy } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import { WEBUI_NAME, user, workspaceActions } from '$lib/stores';

	import {
		createNewPrompt,
		deletePromptById,
		togglePromptById,
		getPromptItems,
		getPromptTags
	} from '$lib/apis/prompts';
	import { capitalizeFirstLetter, slugify, copyToClipboard } from '$lib/utils';

	import PromptMenu from './Prompts/PromptMenu.svelte';
	import EllipsisHorizontal from '../icons/EllipsisHorizontal.svelte';
	import Clipboard from '../icons/Clipboard.svelte';
	import Check from '../icons/Check.svelte';
	import DeleteConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import Modal from '../common/Modal.svelte';
	import PromptEditor from './Prompts/PromptEditor.svelte';
	import Search from '../icons/Search.svelte';
	import Spinner from '../common/Spinner.svelte';
	import Tooltip from '../common/Tooltip.svelte';
	import XMark from '../icons/XMark.svelte';
	import GarbageBin from '../icons/GarbageBin.svelte';
	import ViewSelector from './common/ViewSelector.svelte';
	import TagSelector from './common/TagSelector.svelte';
	import Badge from '$lib/components/common/Badge.svelte';
	import Switch from '../common/Switch.svelte';
	import Pagination from '../common/Pagination.svelte';
	import ChevronDown from '../icons/ChevronDown.svelte';
	import ChevronUp from '../icons/ChevronUp.svelte';

	import type { PromptForm, PromptRecord } from '$lib/apis/prompts';
	import { parsePromptImport } from '$lib/utils/airis/prompt_import';
	type PromptDraft = PromptForm;
	type PromptRow = PromptRecord & { is_active: boolean };

	export let showCreateOnMount = false;
	export let createModalCloseHref = '';

	let shiftKey = false;

	const i18n = getContext<Writable<i18nType>>('i18n');
	let promptsImportInputElement: HTMLInputElement;
	let loaded = false;

	let importFiles: FileList | null = null;
	let query = '';
	let searchDebounceTimer: ReturnType<typeof setTimeout>;

	let prompts: PromptRow[] | null = null;
	let loadError = '';
	let tags: string[] = [];
	let total = 0;
	let loading = false;
	let alive = true;
	const controller = new AbortController();
	let listController: AbortController | null = null;
	let listVersion = 0;
	let pendingIds = new Set<string>();
	let importing = false;
	let creating = false;
	let copyTimer: ReturnType<typeof setTimeout>;
	const invalidateList = (): void => {
		listController?.abort();
		++listVersion;
	};

	let showDeleteConfirm = false;
	let showCreateModal = false;
	let createPrompt: PromptDraft | null = null;
	let deletePrompt: PromptRecord | null = null;

	let tagsContainerElement: HTMLDivElement;
	let viewOption = '';
	let selectedTag = '';
	let copiedId: string | null = null;
	let sortKey = 'updated_at';
	let sortDirection = 'desc';
	let openPromptMenuId: string | null = null;

	let page = 1;

	$: if (loaded) {
		workspaceActions.set([
			{
				id: 'prompts-new',
				label: $i18n.t('Create'),
				onClick: () => {
					createPrompt = null;
					showCreateModal = true;
				}
			},
			{
				id: 'prompts-import',
				label: $i18n.t('Import JSON'),
				onClick: () => promptsImportInputElement?.click(),
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.prompts_import
			},
			{
				id: 'prompts-export',
				label: $i18n.t('Export JSON'),
				onClick: async () => {
					let blob = new Blob([JSON.stringify(prompts)], {
						type: 'application/json'
					});
					saveAs(blob, `prompts-export-${Date.now()}.json`);
				},
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.prompts_export
			}
		]);
	}

	const handleSearchInput = (): void => {
		invalidateList();
		loading = true;
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			if (page !== 1) {
				page = 1;
			} else {
				getPromptList();
			}
		}, 300);
	};

	// Immediate response to page/filter changes
	$: if (
		loaded &&
		page &&
		selectedTag !== undefined &&
		viewOption !== undefined &&
		sortKey !== undefined &&
		sortDirection !== undefined
	) {
		getPromptList();
	}

	const setSortKey = (key: string): void => {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = key === 'updated_at' ? 'desc' : 'asc';
		}
	};

	const openPrompt = (prompt: PromptRecord): void => {
		if (!prompt.id) return;
		goto(`/workspace/prompts/${prompt.id}`);
	};

	const shouldIgnoreRowClick = (target: EventTarget | null): boolean => {
		return target instanceof Element && !!target.closest('button, a, input, [role="menu"]');
	};

	const getPromptList = async (): Promise<void> => {
		if (!alive || !loaded) return;
		invalidateList();
		listController = new AbortController();
		const version = listVersion;
		loadError = '';
		loading = true;
		try {
			const res = await getPromptItems(
				localStorage.token,
				query,
				viewOption,
				selectedTag,
				sortKey,
				sortDirection,
				page,
				listController.signal
			);
			if (!alive || version !== listVersion) return;
			prompts = res.items.map((item) => ({ ...item, is_active: item.is_active ?? true }));
			total = res.total;
			try {
				const nextTags = await getPromptTags(localStorage.token, listController.signal);
				if (alive && version === listVersion) tags = nextTags;
			} catch (error) {
				if (alive && version === listVersion) toast.error(`${error}`);
			}
		} catch (error) {
			if (alive && version === listVersion) {
				loadError = `${error}`;
				toast.error(loadError);
			}
		} finally {
			if (alive && version === listVersion) loading = false;
		}
	};

	const toPromptDraft = (prompt: PromptRecord): PromptDraft => ({
		name: prompt.name,
		command: prompt.command,
		content: prompt.content,
		data: prompt.data,
		meta: prompt.meta,
		tags: prompt.tags,
		access_grants: prompt.access_grants
	});

	const openCreateModal = (prompt: PromptDraft | null = null): void => {
		createPrompt = prompt;
		showCreateModal = true;
	};

	const closeCreateModal = async (): Promise<void> => {
		showCreateModal = false;
		createPrompt = null;

		if (createModalCloseHref) {
			await goto(createModalCloseHref);
		}
	};

	const createPromptHandler = async (prompt: PromptDraft): Promise<boolean> => {
		if (!alive || creating || importing) return false;
		creating = true;
		try {
			const res = await createNewPrompt(localStorage.token, prompt, controller.signal);
			if (!res) throw new Error('Failed to create prompt.');
			if (!alive) return false;
			toast.success($i18n.t('Prompt created successfully'));
			page = 1;
			await getPromptList();
			if (alive) await closeCreateModal();
			return true;
		} catch (error) {
			if (alive) toast.error(`${error}`);
			return false;
		} finally {
			if (alive) creating = false;
		}
	};

	const cloneHandler = (prompt: PromptRecord): void => {
		const clonedPrompt = { ...prompt };

		clonedPrompt.name = `${clonedPrompt.name} (Clone)`;
		const baseCommand = clonedPrompt.command.startsWith('/')
			? clonedPrompt.command.substring(1)
			: clonedPrompt.command;
		clonedPrompt.command = slugify(`${baseCommand} clone`);

		openCreateModal(toPromptDraft(clonedPrompt));
	};

	const exportHandler = (prompt: PromptRecord): void => {
		let blob = new Blob([JSON.stringify([prompt])], {
			type: 'application/json'
		});
		saveAs(blob, `prompt-export-${Date.now()}.json`);
	};

	const copyHandler = async (prompt: PromptRecord): Promise<void> => {
		const res = await copyToClipboard(prompt.content);
		if (alive && res) {
			copiedId = prompt.command;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copiedId = null;
			}, 2000);
		}
	};

	const deleteHandler = async (prompt: PromptRecord | null): Promise<void> => {
		const id = prompt?.id;
		if (!alive || !id || pendingIds.has(id)) return;
		pendingIds = new Set(pendingIds).add(id);
		try {
			const result = await deletePromptById(localStorage.token, id, controller.signal);
			if (result !== true) throw new Error('Failed to delete prompt.');
			if (!alive) return;
			invalidateList();
			prompts = (prompts ?? []).filter((item) => item.id !== id);
			total = Math.max(0, total - 1);
			toast.success($i18n.t('Deleted {{name}}', { name: prompt.command }));
			page = 1;
			await getPromptList();
		} catch (error) {
			if (alive) toast.error(`${error}`);
		} finally {
			if (alive) {
				pendingIds.delete(id);
				pendingIds = new Set(pendingIds);
			}
		}
	};

	const toggleHandler = async (prompt: PromptRecord): Promise<void> => {
		const id = prompt.id;
		if (!alive || !id || pendingIds.has(id)) return;
		pendingIds = new Set(pendingIds).add(id);
		const previous = prompt.is_active ?? true;
		try {
			const result = await togglePromptById(localStorage.token, id, controller.signal);
			if (!result) throw new Error('Failed to update prompt.');
			if (!alive) return;
			invalidateList();
			prompts = (prompts ?? []).map((item) =>
				item.id === id ? { ...item, is_active: result.is_active ?? true } : item
			);
			await getPromptList();
		} catch (error) {
			if (alive) {
				prompts = (prompts ?? []).map((item) =>
					item.id === id ? { ...item, is_active: previous } : item
				);
				toast.error(`${error}`);
			}
		} finally {
			if (alive) {
				pendingIds.delete(id);
				pendingIds = new Set(pendingIds);
			}
		}
	};

	const importHandler = async (): Promise<void> => {
		const file = importFiles?.[0];
		if (!alive || !file || importing || creating) return;
		importing = true;
		let accepted = 0;
		try {
			const text = await file.text();
			if (!alive) return;
			const drafts = parsePromptImport(text);
			for (const draft of drafts) {
				if (!alive) return;
				const result = await createNewPrompt(localStorage.token, draft, controller.signal);
				if (!result) throw new Error('Failed to import prompt.');
				accepted++;
			}
			if (alive) toast.success($i18n.t('Imported {{count}} prompts', { count: accepted }));
		} catch (error) {
			if (alive)
				toast.error(
					`${error} (${$i18n.t('Imported {{count}} prompts before an error. Check the list before retrying.', { count: accepted })})`
				);
		} finally {
			if (alive) {
				importing = false;
				importFiles = null;
				promptsImportInputElement.value = '';
				if (accepted) {
					page = 1;
					await getPromptList();
				}
			}
		}
	};

	onMount(() => {
		viewOption = localStorage?.workspaceViewOption || '';
		loaded = true;

		const receivePrompt = (text: string): void => {
			try {
				openCreateModal(parsePromptImport(text)[0]);
			} catch (error) {
				toast.error(`${error}`);
			}
		};
		const onMessage = (event: MessageEvent): void => {
			if (
				![window.location.origin, 'http://localhost:9999'].includes(event.origin) ||
				typeof event.data !== 'string'
			)
				return;
			receivePrompt(event.data);
		};

		window.addEventListener('message', onMessage);

		if (window.opener ?? false) {
			window.opener.postMessage('loaded', '*');
		}

		if (sessionStorage.prompt) {
			const text = sessionStorage.prompt;
			sessionStorage.removeItem('prompt');
			receivePrompt(text);
		} else if (showCreateOnMount) {
			openCreateModal();
		}

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

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', onBlur);

		return () => {
			clearTimeout(searchDebounceTimer);
			window.removeEventListener('message', onMessage);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', onBlur);
		};
	});

	onDestroy(() => {
		alive = false;
		controller.abort();
		invalidateList();
		clearTimeout(searchDebounceTimer);
		clearTimeout(copyTimer);
	});
</script>

<svelte:head>
	<title>
		{$i18n.t('Prompts')} / {$WEBUI_NAME}
	</title>
</svelte:head>

{#if loaded}
	<DeleteConfirmDialog
		bind:show={showDeleteConfirm}
		title={$i18n.t('Delete prompt?')}
		on:confirm={() => {
			deleteHandler(deletePrompt);
		}}
	>
		<div class=" text-sm text-gray-500 truncate">
			{$i18n.t('This will delete')}
			<span class="  font-normal">{deletePrompt?.command ?? ''}</span>.
		</div>
	</DeleteConfirmDialog>

	<Modal
		bind:show={showCreateModal}
		size="full"
		className="!w-[calc(100vw-2rem)] sm:!w-[calc(100vw-3rem)] lg:!w-[calc(100vw-4rem)] !max-w-[80rem] h-[min(54rem,calc(100dvh-4rem))] max-h-[calc(100dvh-4rem)] flex flex-col bg-white dark:bg-gray-900 rounded-4xl"
	>
		{#key createPrompt}
			<PromptEditor
				modal={true}
				prompt={createPrompt}
				clone={createPrompt !== null}
				onSubmit={createPromptHandler}
				onCancel={() => {
					closeCreateModal();
				}}
			/>
		{/key}
	</Modal>

	<input
		id="prompts-import-input"
		bind:this={promptsImportInputElement}
		bind:files={importFiles}
		type="file"
		accept=".json"
		hidden
		disabled={importing}
		on:change={importHandler}
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
					aria-label={$i18n.t('Search Prompts')}
					placeholder={$i18n.t('Search Prompts')}
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
							page = 1;
							await tick();
						}}
					/>

					{#if (tags ?? []).length > 0}
						<TagSelector
							bind:value={selectedTag}
							align="end"
							items={tags.map((tag) => ({ value: tag, label: tag }))}
						/>
					{/if}
				</div>
			</div>
		</div>

		{#if loadError}
			<div role="alert" class="my-3 text-sm text-gray-500">
				{loadError}
				<button type="button" class="ml-2 underline" on:click={getPromptList}
					>{$i18n.t('Retry')}</button
				>
			</div>
		{/if}
		{#if (prompts === null && !loadError) || loading}
			<div class="w-full h-full flex justify-center items-center my-16 mb-24">
				<Spinner className="size-5" />
			</div>
		{:else if (prompts ?? []).length !== 0}
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
					{#each prompts as prompt (prompt.id)}
						<div
							class="group flex min-h-8 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-xl px-2 py-1 text-left"
							role="button"
							tabindex="0"
							on:click={(e) => {
								if (shouldIgnoreRowClick(e.target)) return;
								openPrompt(prompt);
							}}
							on:keydown={(e) => {
								if (e.currentTarget !== e.target) return;
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									openPrompt(prompt);
								}
							}}
						>
							<div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
								<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
									<div class="flex min-w-0 items-center gap-2 overflow-hidden">
										<div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
											<Tooltip content={prompt.name} className="min-w-0" placement="top-start">
												<div
													class="truncate text-[13px] leading-5 text-gray-800 group-hover:underline dark:text-gray-200"
												>
													{prompt.name}
												</div>
											</Tooltip>

											<div
												class="min-w-0 max-w-[40%] shrink-0 truncate text-[11px] leading-5 text-gray-500"
											>
												/{prompt.command}
											</div>

											<Tooltip
												content={dayjs((prompt.updated_at ?? prompt.created_at ?? 0) * 1000).format(
													'LLLL'
												)}
											>
												<div
													class="shrink-0 truncate text-[11px] leading-5 text-gray-400 dark:text-gray-600"
												>
													{dayjs((prompt.updated_at ?? prompt.created_at ?? 0) * 1000).fromNow()}
												</div>
											</Tooltip>

											{#if !prompt.write_access}
												<Badge type="muted" content={$i18n.t('Read Only')} />
											{/if}
										</div>
									</div>

									{#if prompt.content}
										<Tooltip content={prompt.content} className="min-w-0" placement="top-start">
											<div
												class="mt-0.5 truncate text-[0.6875rem] leading-4 text-gray-400 dark:text-gray-600"
											>
												{prompt.content}
											</div>
										</Tooltip>
									{/if}
								</div>
							</div>

							<div
								class="hidden max-w-44 shrink-0 self-center truncate text-right text-[11px] leading-5 text-gray-500 dark:text-gray-500 md:block"
							>
								<Tooltip
									content={prompt?.user?.email ?? $i18n.t('Deleted User')}
									className="min-w-0"
									placement="top-start"
								>
									<div class="truncate">
										{capitalizeFirstLetter(
											prompt?.user?.name ?? prompt?.user?.email ?? $i18n.t('Deleted User')
										)}
									</div>
								</Tooltip>
							</div>

							<div class="ml-2 flex shrink-0 flex-row items-center self-center">
								{#if shiftKey}
									<Tooltip content={$i18n.t('Delete')}>
										<button
											class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
											type="button"
											aria-label={$i18n.t('Delete')}
											disabled={!prompt.write_access || !prompt.id || pendingIds.has(prompt.id)}
											on:click={(e) => {
												e.preventDefault();
												e.stopPropagation();
												deleteHandler(prompt);
											}}
										>
											<GarbageBin className="size-4" />
										</button>
									</Tooltip>
								{:else}
									<Tooltip content={$i18n.t('Copy Prompt')}>
										<button
											class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
											type="button"
											aria-label={$i18n.t('Copy Prompt')}
											on:click={(e) => {
												e.preventDefault();
												e.stopPropagation();
												copyHandler(prompt);
											}}
										>
											{#if copiedId === prompt.command}
												<Check className="size-4" strokeWidth="1.5" />
											{:else}
												<Clipboard className="size-4" strokeWidth="1.5" />
											{/if}
										</button>
									</Tooltip>

									<div class="ml-0.5 flex shrink-0 flex-row items-center gap-1.5 self-center">
										<PromptMenu
											show={openPromptMenuId === prompt.id}
											editHandler={() => {
												goto(`/workspace/prompts/${prompt.id}`);
											}}
											cloneHandler={() => {
												cloneHandler(prompt);
											}}
											exportHandler={() => {
												exportHandler(prompt);
											}}
											disabled={!prompt.write_access || !prompt.id || pendingIds.has(prompt.id)}
											deleteHandler={async () => {
												deletePrompt = prompt;
												showDeleteConfirm = true;
											}}
											onClose={() => {
												openPromptMenuId = null;
											}}
										>
											<button
												class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												type="button"
												aria-label={$i18n.t('Prompt Menu')}
												on:click={(e) => {
													e.preventDefault();
													e.stopPropagation();
													openPromptMenuId = openPromptMenuId === prompt.id ? null : prompt.id;
												}}
											>
												<EllipsisHorizontal className="size-4" />
											</button>
										</PromptMenu>

										<button
											class="flex h-6 items-center"
											type="button"
											on:click={(e) => {
												e.stopPropagation();
												e.preventDefault();
											}}
										>
											<Tooltip
												content={prompt.is_active !== false
													? $i18n.t('Enabled')
													: $i18n.t('Disabled')}
											>
												<Switch
													state={prompt.is_active}
													ariaLabel={$i18n.t('Enabled')}
													disabled={!prompt.write_access || !prompt.id || pendingIds.has(prompt.id)}
													on:change={() => toggleHandler(prompt)}
												/>
											</Tooltip>
										</button>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			{#if total > 30}
				<div class="flex justify-center mt-4 mb-2">
					<Pagination bind:page count={total} perPage={30} />
				</div>
			{/if}
		{:else if !loadError}
			<div class="flex w-full flex-col items-center justify-center py-16 pb-24">
				<div class="max-w-sm text-center text-gray-900 dark:text-gray-100">
					<div class="mb-1.5 text-sm">{$i18n.t('No prompts found')}</div>
					<div class="text-center text-xs leading-5 text-gray-500">
						{$i18n.t('Try adjusting your search or filter to find what you are looking for.')}
					</div>
				</div>
			</div>
		{/if}
	</div>
{:else}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{/if}
