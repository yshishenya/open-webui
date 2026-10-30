<script lang="ts">
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import { getContext, onDestroy, tick } from 'svelte';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Modal from '$lib/components/common/Modal.svelte';
	import AccessButton from '$lib/components/common/AccessButton.svelte';
	import FolderShareModal from './FolderShareModal.svelte';
	import XMark from '../icons/XMark.svelte';

	import { toast } from 'svelte-sonner';
	import { user, config, models } from '$lib/stores';
	import ModelSelector from '$lib/components/chat/ModelSelector/Selector.svelte';

	import Textarea from '$lib/components/common/Textarea.svelte';
	import Knowledge from '$lib/components/workspace/Models/Knowledge.svelte';
	import { getFolderById } from '$lib/apis/folders';
	const i18n = getContext<Readable<I18n>>('i18n');

	export let show = false;
	export let onSubmit: (folder: {
		name: string;
		meta: Record<string, unknown>;
		data: Record<string, unknown>;
		parent_id: string | null | undefined;
	}) => boolean | void | Promise<boolean | void> = () => {};

	export let folderId: string | null = null;
	export let parentId: string | null = null;
	export let edit = false;

	let nameInput: HTMLInputElement | null = null;
	let loadVersion = 0;
	let imageReader: FileReader | null = null;
	let initializing = false;
	let name = '';
	let meta: Record<string, unknown> & { background_image_url?: string | null } = {
		background_image_url: null
	};
	let data: { description: string; model_ids: string[]; system_prompt: string; files: import('$lib/utils/airis/chat_history').ChatAttachment[] } = {
		description: '',
		model_ids: [] as string[],
		system_prompt: '',
		files: []
	};

	let loading = false;
	let showAccessModal = false;
	let folder: Awaited<ReturnType<typeof getFolderById>> | null = null;

	const submitHandler = async (): Promise<void> => {
		if (initializing || loading || !show) return;
		loading = true;

		if (
			Array.isArray(data.files) &&
			data.files.some(
				(file: unknown) =>
					file !== null &&
					typeof file === 'object' &&
					'status' in file &&
					file.status === 'uploading'
			)
		) {
			toast.error($i18n.t('Please wait until all files are uploaded.'));
			loading = false;
			return;
		}

		// Check folder max file count limit
		const maxFileCount = $config?.features?.folder_max_file_count ?? '';
		if (maxFileCount && (Array.isArray(data.files) ? data.files.length : 0) > maxFileCount) {
			toast.error(
				$i18n.t('Maximum number of files per folder is {{max}}.', { max: maxFileCount ?? 0 })
			);
			loading = false;
			return;
		}

		const version = loadVersion;
		try {
			const saved = await onSubmit({
				name,
				meta,
				data: { description: data.description.trim(), model_ids: data.model_ids, system_prompt: data.system_prompt, files: data.files },
				parent_id: edit ? undefined : parentId
			});
			if (saved !== false && version === loadVersion && show) show = false;
		} catch (error) {
			if (version === loadVersion && show) toast.error(`${error}`);
		} finally {
			loading = false;
		}
	};

	const invalidateLoad = (): void => {
		loadVersion += 1;
		initializing = false;
		imageReader?.abort();
		imageReader = null;
	};

	const init = async (id: string | null): Promise<void> => {
		invalidateLoad();
		const version = loadVersion;
		initializing = Boolean(id);
		try {
			if (id) {
				const loadedFolder = await getFolderById(localStorage.token, id);
				if (version !== loadVersion || !show) return;
				if (!loadedFolder) throw new Error($i18n.t('Something went wrong :/'));
				folder = loadedFolder;
				name = folder.name;
				meta = folder.meta || { background_image_url: null };
				data = { description: '', system_prompt: '', files: [], ...folder.data, model_ids: folder.data?.model_ids ?? [] };
			}
			initializing = false;
			await tick();
			if (version === loadVersion && show) {
				nameInput?.focus();
				nameInput?.select();
			}
		} catch (error) {
			if (version !== loadVersion || !show) return;
			toast.error(`${error}`);
			show = false;
		}
	};

	$: if (show) {
		init(folderId);
	} else {
		invalidateLoad();
	}
	$: if (!show) showAccessModal = false;

	onDestroy(invalidateLoad);

	$: if (!show && !edit) {
		name = '';
		meta = {
			background_image_url: null
		};
		data = {
			description: '',
			model_ids: [],
			system_prompt: '',
			files: []
		};
	}
</script>

<Modal size="md" bind:show>
	<div>
		<div class=" flex justify-between dark:text-gray-300 px-4 pt-3 pb-1">
			<div class=" text-sm self-center">
				{#if edit}
					{$i18n.t('Edit Folder')}
				{:else}
					{$i18n.t('Create Folder')}
				{/if}
			</div>
			<div class="flex items-center gap-1">
				{#if edit && folder && ($user?.role === 'admin' || (folder.user_id === $user?.id && $user?.permissions?.sharing?.folders))}
					<AccessButton disabled={loading} on:click={() => (showAccessModal = true)} />
				{/if}
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
		</div>

		<div class="flex flex-col md:flex-row w-full px-4 pb-4 md:space-x-4 dark:text-gray-200">
			<div class=" flex flex-col w-full sm:flex-row sm:justify-center sm:space-x-6">
				{#if initializing}
					<div role="status" class="flex items-center gap-2 text-sm">
						<Spinner />
						{$i18n.t('Loading...')}
					</div>
				{/if}
				<form
					class="flex flex-col w-full"
					inert={initializing}
					aria-busy={initializing}
					on:submit|preventDefault={() => {
						submitHandler();
					}}
				>
					<div class="flex flex-col w-full mt-1">
						<div class=" mb-1 text-xs text-gray-500">{$i18n.t('Folder Name')}</div>

						<div class="flex-1">
							<input
								id="folder-name"
								bind:this={nameInput}
								disabled={initializing || loading}
								class="w-full text-sm bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-700 outline-hidden"
								type="text"
								bind:value={name}
								placeholder={$i18n.t('Enter folder name')}
								autocomplete="off"
							/>
						</div>
					</div>

					<div class="my-2">
						<label for="folder-description" class="mb-1 block text-xs text-gray-500">
							{$i18n.t('Description')}
						</label>
						<Textarea
							id="folder-description"
							ariaLabel={$i18n.t('Description')}
							className="w-full text-sm bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-700 outline-hidden"
							placeholder={$i18n.t('Enter description')}
							maxSize={200}
							bind:value={data.description}
						/>
					</div>

					<input
						id="folder-background-image-input"
						type="file"
						hidden
						accept="image/*"
						on:change={(e) => {
							const input = e.currentTarget;
							const file = input.files?.[0];
							if (!file) return;
							if (!['image/gif', 'image/webp', 'image/jpeg', 'image/png'].includes(file.type)) {
								input.value = '';
								toast.error($i18n.t('Invalid file format.'));
								return;
							}
							imageReader?.abort();
							const reader = new FileReader();
							imageReader = reader;
							const version = loadVersion;
							reader.onload = (): void => {
								if (imageReader !== reader || version !== loadVersion || !show) return;
								imageReader = null;
								if (typeof reader.result !== 'string') {
									toast.error($i18n.t('Failed to upload file.'));
									return;
								}
								meta.background_image_url = reader.result;
							};
							reader.onerror = (): void => {
								if (imageReader !== reader || version !== loadVersion || !show) return;
								imageReader = null;
								toast.error($i18n.t('Failed to upload file.'));
							};
							reader.readAsDataURL(file);
						}}
					/>

					<div class="flex justify-between w-full mt-1 items-center">
						<div id="folder-background-label" class="text-xs text-gray-500">
							{$i18n.t('Folder Background Image')}
						</div>

						<div class="">
							<button
								aria-labelledby="folder-background-label background-image-url-state"
								class="p-1 px-3 text-xs flex rounded-sm transition"
								on:click={() => {
									if ((meta?.background_image_url ?? null) !== null) {
										imageReader?.abort();
										imageReader = null;
										meta.background_image_url = null;
									} else {
										const input = document.getElementById('folder-background-image-input');
										if (input) {
											input.click();
										}
									}
								}}
								type="button"
							>
								<span class="ml-2 self-center" id="background-image-url-state"
									>{(meta?.background_image_url ?? null) === null
										? $i18n.t('Upload')
										: $i18n.t('Reset')}</span
								>
							</button>
						</div>
					</div>

					<hr class=" border-gray-50 dark:border-gray-850/30 my-2.5 w-full" />

					<div class="my-1 flex items-center justify-between gap-4">
						<label
							for="model-selector-folder-default-button"
							class="shrink-0 text-xs text-gray-500"
						>
							{$i18n.t('Default Model')}
						</label>
						<div class="flex min-w-0 max-w-[65%] items-center gap-2">
							<div class="min-w-0">
								<ModelSelector
									id="folder-default"
									placeholder={$i18n.t('Use default')}
									items={$models.map((model) => ({
										value: model.id,
										label: model.name,
										model
									}))}
									triggerClassName="text-xs"
									placement="auto"
									align="end"
									selectionOnly
									value={data.model_ids[0] ?? ''}
									bind:values={data.model_ids}
								/>
							</div>
							{#if data.model_ids.length}
								<button
									type="button"
									aria-label={$i18n.t('Reset')}
									class="shrink-0 p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
									on:click={() => (data.model_ids = [])}
								>
									<XMark className="size-3" />
								</button>
							{/if}
						</div>
					</div>

					{#if $user?.role === 'admin' || ($user?.permissions.chat?.system_prompt ?? true)}
						<div class="my-1">
							<div class="mb-2 text-xs text-gray-500">{$i18n.t('System Prompt')}</div>
							<div>
								<Textarea
									className=" text-sm w-full bg-transparent outline-hidden "
									placeholder={$i18n.t(
										'Write your model system prompt content here\ne.g.) You are Mario from Super Mario Bros, acting as an assistant.'
									)}
									maxSize={200}
									bind:value={(data as { system_prompt: string }).system_prompt}
								/>
							</div>
						</div>
					{/if}

					<div class="my-2">
						<Knowledge bind:selectedItems={data.files}>
							<div slot="label">
								<div class="flex w-full justify-between">
									<div class=" text-xs text-gray-500">
										{$i18n.t('Knowledge')}
									</div>
								</div>
							</div>
						</Knowledge>
					</div>

					<div class="flex justify-end pt-3 text-sm font-normal gap-1.5">
						<button
							class="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-2.5 text-xs font-normal text-white transition hover:bg-black disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white disabled:cursor-not-allowed"
							type="submit"
							disabled={initializing || loading}
						>
							{$i18n.t('Save')}

							{#if loading}
								<div class="shrink-0">
									<Spinner className="size-3" />
								</div>
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</Modal>

{#if show && edit && folder && ($user?.role === 'admin' || folder.user_id === $user?.id)}
	<FolderShareModal bind:show={showAccessModal} {folder} />
{/if}
