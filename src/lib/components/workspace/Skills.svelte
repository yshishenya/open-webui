<script lang="ts">
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import { toast } from 'svelte-sonner';
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	dayjs.extend(relativeTime);

	import { onMount, getContext, tick, onDestroy } from 'svelte';
	const i18n = getContext<Readable<I18n>>('i18n');
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { SkillUserItem } from '$lib/apis/skills';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	import { parseSkillImport } from '$lib/utils/airis/skill_import';

	import { WEBUI_NAME, user, skills as _skills, workspaceActions } from '$lib/stores';
	import { goto } from '$app/navigation';
	import {
		getSkills,
		getSkillById,
		getSkillItems,
		exportSkills,
		createNewSkill,
		deleteSkillById,
		toggleSkillById
	} from '$lib/apis/skills';
	import { capitalizeFirstLetter, parseFrontmatter, formatSkillName } from '$lib/utils';

	import Tooltip from '../common/Tooltip.svelte';
	import DeleteConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import EllipsisHorizontal from '../icons/EllipsisHorizontal.svelte';
	import GarbageBin from '../icons/GarbageBin.svelte';
	import Search from '../icons/Search.svelte';
	import XMark from '../icons/XMark.svelte';
	import Spinner from '../common/Spinner.svelte';
	import ViewSelector from './common/ViewSelector.svelte';
	import Badge from '$lib/components/common/Badge.svelte';
	import Switch from '../common/Switch.svelte';
	import SkillMenu from './Skills/SkillMenu.svelte';
	import Pagination from '../common/Pagination.svelte';
	import ChevronDown from '../icons/ChevronDown.svelte';
	import ChevronUp from '../icons/ChevronUp.svelte';

	let shiftKey = false;
	let loaded = false;

	let importFiles: FileList | null = null;
	let importInputElement: HTMLInputElement;

	let query = '';
	let searchDebounceTimer: ReturnType<typeof setTimeout>;

	let selectedSkill: SkillUserItem | null = null;
	let showDeleteConfirm = false;

	let filteredItems: SkillUserItem[] = [];
	let total = 0;
	let loading = false;
	let loadFailed = false;
	let alive = true;
	const controller = new AbortController();
	let listVersion = 0;
	let importing = false;
	let pendingIds = new Set<string>();

	let tagsContainerElement: HTMLDivElement;
	let viewOption = '';
	let sortKey = 'updated_at';
	let sortDirection = 'desc';
	let openSkillMenuId: string | null = null;
	let page = 1;

	$: if (loaded) {
		workspaceActions.set([
			{
				id: 'skills-new',
				label: $i18n.t('Create'),
				href: '/workspace/skills/create',
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.skills
			},
			{
				id: 'skills-import',
				label: $i18n.t('Import JSON'),
				onClick: () => {
					if (!importing) importInputElement?.click();
				},
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.skills_import
			},
			{
				id: 'skills-export',
				label: $i18n.t('Export JSON'),
				onClick: async () => {
					const _skills = await exportSkills(localStorage.token, controller.signal).catch(
						(error) => {
							if (alive) toast.error(getErrorMessage(error));
							return null;
						}
					);
					if (alive && _skills) {
						let blob = new Blob([JSON.stringify(_skills)], {
							type: 'application/json'
						});
						saveAs(blob, `skills-export-${Date.now()}.json`);
					}
				},
				visible: $user?.role === 'admin' || $user?.permissions?.workspace?.skills_export
			}
		]);
	}

	const loadSkillItems = async (): Promise<void> => {
		if (!alive || !loaded) return;
		const version = ++listVersion;
		loading = true;
		loadFailed = false;
		try {
			const res = await getSkillItems(
				localStorage.token,
				query,
				viewOption,
				page,
				sortKey,
				sortDirection,
				controller.signal
			);
			if (alive && version === listVersion) {
				filteredItems = res.items;
				total = res.total;
			}
		} catch (error) {
			if (alive && version === listVersion) {
				loadFailed = true;
				toast.error(getErrorMessage(error));
			}
		} finally {
			if (alive && version === listVersion) loading = false;
		}
	};
	const refreshSkills = async (): Promise<void> => {
		if (!alive) return;
		await getSkills(localStorage.token, controller.signal)
			.then((items) => {
				if (alive) _skills.set(items);
			})
			.catch(() => {
				if (alive) toast.error($i18n.t('Could not load skills. Try again.'));
			});
	};

	const handleSearchInput = (): void => {
		loading = true;
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			if (page !== 1) {
				page = 1;
			} else {
				loadSkillItems();
			}
		}, 300);
	};

	// Immediate response to page/filter changes
	$: if (
		loaded &&
		page &&
		viewOption !== undefined &&
		sortKey !== undefined &&
		sortDirection !== undefined
	) {
		loadSkillItems();
	}

	const setSortKey = (key: string): void => {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = key === 'updated_at' ? 'desc' : 'asc';
		}
	};

	const openSkill = (skill: SkillUserItem): void => {
		goto(`/workspace/skills/edit?id=${encodeURIComponent(skill.id)}`);
	};

	const shouldIgnoreRowClick = (target: EventTarget | null): boolean => {
		return target instanceof Element && !!target.closest('button, a, input, [role="menu"]');
	};

	const cloneHandler = async (skill: SkillUserItem): Promise<void> => {
		const _skill = await getSkillById(localStorage.token, skill.id, controller.signal).catch(
			(error) => {
				if (alive) toast.error(getErrorMessage(error));
				return null;
			}
		);

		if (alive && _skill) {
			sessionStorage.skill = JSON.stringify({
				..._skill,
				id: `${_skill.id}_clone`,
				name: `${_skill.name} (Clone)`
			});
			goto('/workspace/skills/create');
		}
	};

	const exportHandler = async (skill: SkillUserItem): Promise<void> => {
		const _skill = await getSkillById(localStorage.token, skill.id, controller.signal).catch(
			(error) => {
				if (alive) toast.error(getErrorMessage(error));
				return null;
			}
		);

		if (alive && _skill) {
			let blob = new Blob([JSON.stringify([_skill])], {
				type: 'application/json'
			});
			saveAs(blob, `skill-${_skill.id}-export-${Date.now()}.json`);
		}
	};

	const deleteHandler = async (skill: SkillUserItem | null): Promise<void> => {
		if (!alive || !skill || pendingIds.has(skill.id)) return;
		pendingIds = new Set(pendingIds).add(skill.id);
		try {
			await deleteSkillById(localStorage.token, skill.id, controller.signal);
			if (!alive) return;
			++listVersion;
			loading = false;
			filteredItems = filteredItems.filter((item) => item.id !== skill.id);
			total = Math.max(0, total - 1);
			_skills.update((items) => items?.filter((item) => item.id !== skill.id) ?? null);
			toast.success($i18n.t('Skill deleted successfully'));
			if (page !== 1) page = 1;
			else await loadSkillItems();
			await refreshSkills();
		} catch (error) {
			if (alive) toast.error(getErrorMessage(error));
		} finally {
			pendingIds = new Set([...pendingIds].filter((id) => id !== skill.id));
		}
	};
	const toggleHandler = async (skill: SkillUserItem): Promise<void> => {
		if (!alive || pendingIds.has(skill.id)) return;
		pendingIds = new Set(pendingIds).add(skill.id);
		const previous = skill.is_active;
		try {
			const result = await toggleSkillById(localStorage.token, skill.id, controller.signal);
			if (!result) throw new Error($i18n.t('Failed to update skill.'));
			if (!alive) return;
			++listVersion;
			loading = false;
			filteredItems = filteredItems.map((item) =>
				item.id === skill.id ? { ...item, is_active: result.is_active } : item
			);
			_skills.update(
				(items) =>
					items?.map((item) =>
						item.id === skill.id ? { ...item, is_active: result.is_active } : item
					) ?? null
			);
			await refreshSkills();
		} catch (error) {
			if (alive) {
				filteredItems = filteredItems.map((item) =>
					item.id === skill.id ? { ...item, is_active: previous } : item
				);
				toast.error(getErrorMessage(error));
			}
		} finally {
			pendingIds = new Set([...pendingIds].filter((id) => id !== skill.id));
		}
	};
	const importHandler = async (): Promise<void> => {
		const file = importFiles?.[0];
		if (!alive || importing || !file) return;
		importing = true;
		let created = 0;
		try {
			const text = await file.text();
			if (!alive) return;
			if (file.name.split('.').pop()?.toLowerCase() !== 'json') {
				const fm = parseFrontmatter(text);
				const fileName = file.name.replace(/\.md$/, '');
				sessionStorage.skill = JSON.stringify({
					name: formatSkillName(fm.name || fileName),
					id: fm.name || '',
					description: fm.description || '',
					content: text,
					is_active: true,
					access_grants: []
				});
				await goto('/workspace/skills/create');
			} else {
				for (const skill of parseSkillImport(text)) {
					if (!alive) return;
					const result = await createNewSkill(localStorage.token, skill, controller.signal);
					if (!result) throw new Error($i18n.t('Failed to create skill.'));
					created++;
				}
				if (alive) toast.success($i18n.t('Skill imported successfully'));
			}
		} catch (error) {
			if (alive)
				toast.error(
					created
						? $i18n.t(
								'Imported {{count}} skills before an error. Check the list before retrying.',
								{ count: created }
							) +
								' ' +
								getErrorMessage(error)
						: $i18n.t(getErrorMessage(error))
				);
		} finally {
			if (alive) {
				importFiles = null;
				if (importInputElement) importInputElement.value = '';
				if (created) {
					if (page !== 1) page = 1;
					else await loadSkillItems();
					await refreshSkills();
				}
			}
			importing = false;
		}
	};

	onMount(() => {
		viewOption = localStorage?.workspaceViewOption || '';
		loaded = true;

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
			clearTimeout(searchDebounceTimer);
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
		{$i18n.t('Skills')} / {$WEBUI_NAME}
	</title>
</svelte:head>

{#if loaded}
	{#if loadFailed}<div role="alert">
			{$i18n.t('Could not load skills. Try again.')}
			<button type="button" disabled={loading} on:click={loadSkillItems}>{$i18n.t('Retry')}</button>
		</div>{/if}
	<input
		bind:this={importInputElement}
		bind:files={importFiles}
		type="file"
		accept=".md,.json"
		hidden
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
					aria-label={$i18n.t('Search Skills')}
					placeholder={$i18n.t('Search Skills')}
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
				</div>
			</div>
		</div>

		{#if loading}
			<div class="w-full h-full flex justify-center items-center my-16 mb-24">
				<Spinner className="size-5" />
			</div>
		{:else if (filteredItems ?? []).length !== 0}
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
					{#each filteredItems as skill (skill.id)}
						<div
							class="group flex min-h-8 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-xl px-2 py-1 text-left"
							role="button"
							tabindex="0"
							on:click={(e) => {
								if (shouldIgnoreRowClick(e.target)) return;
								openSkill(skill);
							}}
							on:keydown={(e) => {
								if (e.currentTarget !== e.target) return;
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									openSkill(skill);
								}
							}}
						>
							<div class="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
								<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
									<div class="flex min-w-0 items-center gap-2 overflow-hidden">
										<div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
											<Tooltip content={skill.id} className="min-w-0" placement="top-start">
												<div
													class="truncate text-[13px] leading-5 text-gray-800 group-hover:underline dark:text-gray-200"
												>
													{skill.name}
												</div>
											</Tooltip>

											<div
												class="min-w-0 max-w-[40%] shrink-0 truncate text-[11px] leading-5 text-gray-500"
											>
												/{skill.id}
											</div>

											<Tooltip
												content={dayjs((skill.updated_at ?? skill.created_at) * 1000).format(
													'LLLL'
												)}
											>
												<div
													class="shrink-0 truncate text-[11px] leading-5 text-gray-400 dark:text-gray-600"
												>
													{dayjs((skill.updated_at ?? skill.created_at) * 1000).fromNow()}
												</div>
											</Tooltip>

											{#if !skill.is_active}
												<Badge type="muted" content={$i18n.t('Inactive')} />
											{/if}

											{#if !skill.write_access}
												<Badge type="muted" content={$i18n.t('Read Only')} />
											{/if}
										</div>
									</div>

									{#if skill.description}
										<Tooltip content={skill.description} className="min-w-0" placement="top-start">
											<div
												class="mt-0.5 truncate text-[0.6875rem] leading-4 text-gray-400 dark:text-gray-600"
											>
												{skill.description}
											</div>
										</Tooltip>
									{/if}
								</div>
							</div>

							<div
								class="hidden max-w-44 shrink-0 self-center truncate text-right text-[11px] leading-5 text-gray-500 dark:text-gray-500 md:block"
							>
								<Tooltip
									content={skill?.user?.email ?? $i18n.t('Deleted User')}
									className="min-w-0"
									placement="top-start"
								>
									<div class="truncate">
										{capitalizeFirstLetter(
											skill?.user?.name ?? skill?.user?.email ?? $i18n.t('Deleted User')
										)}
									</div>
								</Tooltip>
							</div>

							{#if skill.write_access}
								<div class="ml-2 flex shrink-0 flex-row items-center self-center">
									{#if shiftKey}
										<Tooltip content={$i18n.t('Delete')}>
											<button
												class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
												type="button"
												aria-label={$i18n.t('Delete')}
												disabled={pendingIds.has(skill.id)}
												on:click={(e) => {
													e.preventDefault();
													e.stopPropagation();
													deleteHandler(skill);
												}}
											>
												<GarbageBin className="size-4" />
											</button>
										</Tooltip>
									{:else}
										<div class="flex shrink-0 flex-row items-center gap-1.5 self-center">
											<SkillMenu
												show={openSkillMenuId === skill.id}
												editHandler={() => {
													goto(`/workspace/skills/edit?id=${encodeURIComponent(skill.id)}`);
												}}
												cloneHandler={() => {
													cloneHandler(skill);
												}}
												exportHandler={() => {
													exportHandler(skill);
												}}
												deleteHandler={async () => {
													selectedSkill = skill;
													showDeleteConfirm = true;
												}}
												onClose={() => {
													openSkillMenuId = null;
												}}
											>
												<button
													class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition dark:text-gray-500"
													type="button"
													aria-label={$i18n.t('Skill Menu')}
													on:click={(e) => {
														e.preventDefault();
														e.stopPropagation();
														openSkillMenuId = openSkillMenuId === skill.id ? null : skill.id;
													}}
												>
													<EllipsisHorizontal className="size-4" />
												</button>
											</SkillMenu>

											<button
												class="flex h-6 items-center"
												type="button"
												on:click={(e) => {
													e.stopPropagation();
													e.preventDefault();
												}}
											>
												<Tooltip
													content={skill.is_active ? $i18n.t('Enabled') : $i18n.t('Disabled')}
												>
													<Switch
														state={skill.is_active}
														disabled={pendingIds.has(skill.id)}
														on:change={() => toggleHandler(skill)}
													/>
												</Tooltip>
											</button>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			{#if total > 30}
				<div class="flex justify-center mt-4 mb-2">
					<Pagination bind:page count={total} perPage={30} />
				</div>
			{/if}
		{:else if !loadFailed}
			<div class="flex w-full flex-col items-center justify-center py-16 pb-24">
				<div class="max-w-sm text-center text-gray-900 dark:text-gray-100">
					<div class="mb-1.5 text-sm">{$i18n.t('No skills found')}</div>
					<div class="text-center text-xs leading-5 text-gray-500">
						{$i18n.t('Try adjusting your search or filter to find what you are looking for.')}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<DeleteConfirmDialog
		bind:show={showDeleteConfirm}
		title={$i18n.t('Delete skill?')}
		on:confirm={() => {
			deleteHandler(selectedSkill);
		}}
	>
		<div class=" text-sm text-gray-500 truncate">
			{$i18n.t('This will delete')} <span class="  font-normal">{selectedSkill?.name ?? ''}</span>.
		</div>
	</DeleteConfirmDialog>
{:else}
	<div class="w-full h-full flex justify-center items-center">
		<Spinner className="size-5" />
	</div>
{/if}
