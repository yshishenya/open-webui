<script lang="ts">
	import { canManageChats } from '$lib/utils/settings-access';
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	import { user, visibleControls } from '$lib/stores';
	import { refreshSidebar } from '$lib/stores/chatList';

	import { archiveAllChats, deleteAllChats, getAllChats, importChats } from '$lib/apis/chats';
	import { parseChatImport } from '$lib/utils/airis/chat_import';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	import { getContext, onDestroy } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import SharedChatsModal from '$lib/components/layout/SharedChatsModal.svelte';
	import FilesModal from '$lib/components/layout/FilesModal.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import UserSettingRow from './UserSettingRow.svelte';
	import UserSettingSection from './UserSettingSection.svelte';

	const i18n = getContext<Readable<I18n>>('i18n');
	let importing = false;
	let active = true;
	onDestroy((): void => {
		active = false;
	});
	let showArchiveConfirmDialog = false;
	let showDeleteConfirmDialog = false;
	let showSharedChatsModal = false;
	let showFilesModal = false;
	let chatImportInputElement: HTMLInputElement | undefined;
	const actionButtonClass =
		'text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-500 dark:hover:text-white';

	const importFileHandler = async (event: Event): Promise<void> => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || importing) return;
		const token = localStorage.token;
		const current = (): boolean => active && localStorage.token === token;
		importing = true;
		try {
			let text: string;
			try {
				text = await file.text();
			} catch {
				throw new Error($i18n.t('Failed to upload file.'));
			}
			if (!current()) return;
			const result = await importChats(token, parseChatImport(text));
			if (!current()) return;
			toast.success(`Successfully imported ${result.length} chats.`);
			await refreshSidebar(token);
		} catch (error) {
			if (current()) toast.error($i18n.t(getErrorMessage(error)));
		} finally {
			importing = false;
		}
	};

	const exportChats = async (): Promise<void> => {
		const token = localStorage.token;
		try {
			const rows = await getAllChats(token);
			if (localStorage.token !== token) return;
			const blob = new Blob([JSON.stringify(rows)], { type: 'application/json' });
			saveAs(blob, `chat-export-${Date.now()}.json`);
		} catch (error) {
			if (localStorage.token === token) toast.error(getErrorMessage(error));
		}
	};

	const archiveAllChatsHandler = async (): Promise<void> => {
		const token = localStorage.token;
		try {
			await goto('/');
			if (localStorage.token !== token) return;
			await archiveAllChats(token);
			if (localStorage.token === token) await refreshSidebar(token);
		} catch (error) {
			if (localStorage.token === token) toast.error(getErrorMessage(error));
		}
	};

	const deleteAllChatsHandler = async (): Promise<void> => {
		const token = localStorage.token;
		try {
			await goto('/');
			if (localStorage.token !== token) return;
			await deleteAllChats(token);
			if (localStorage.token === token) await refreshSidebar(token);
		} catch (error) {
			if (localStorage.token === token) toast.error(getErrorMessage(error));
		}
	};
</script>

<SharedChatsModal bind:show={showSharedChatsModal} />
<FilesModal bind:show={showFilesModal} />

<ConfirmDialog
	title={$i18n.t('settings.personal.dataControls.archiveAllChats.label')}
	message={$i18n.t('Are you sure you want to archive all chats? This action cannot be undone.')}
	bind:show={showArchiveConfirmDialog}
	on:confirm={archiveAllChatsHandler}
	on:cancel={() => {
		showArchiveConfirmDialog = false;
	}}
/>

<ConfirmDialog
	title={$i18n.t('settings.personal.dataControls.deleteAllChats.label')}
	message={$i18n.t('Are you sure you want to delete all chats? This action cannot be undone.')}
	bind:show={showDeleteConfirmDialog}
	on:confirm={deleteAllChatsHandler}
	on:cancel={() => {
		showDeleteConfirmDialog = false;
	}}
/>

<div id="tab-data-controls" class="flex flex-col h-full text-sm">
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
		{$i18n.t('settings.personal.dataControls.title')}
	</h2>

	<div class="flex-1 min-h-0 overflow-y-auto scrollbar-hover pr-1.5">
		<input
			id="chat-import-input"
			bind:this={chatImportInputElement}
			disabled={importing}
			on:change={importFileHandler}
			type="file"
			accept=".json"
			hidden
		/>

		<UserSettingSection
			title={$i18n.t('settings.personal.dataControls.sections.chats.title')}
			first
		>
			{#if canManageChats({ user: $user, config: null }, 'import')}
				<UserSettingRow
					let:labelId
					label={$i18n.t('settings.personal.dataControls.importChats.label')}
					description={$i18n.t('settings.personal.dataControls.importChats.description')}
				>
					<button
						id={`${labelId}-control`}
						class={actionButtonClass}
						disabled={importing}
						on:click={() => {
							chatImportInputElement?.click();
						}}
						type="button"
					>
						{$i18n.t('Import')}
					</button>
				</UserSettingRow>
			{/if}

			{#if canManageChats({ user: $user, config: null }, 'export')}
				<UserSettingRow
					let:labelId
					label={$i18n.t('settings.personal.dataControls.exportChats.label')}
					description={$i18n.t('settings.personal.dataControls.exportChats.description')}
				>
					<button
						id={`${labelId}-control`}
						class={actionButtonClass}
						on:click={() => {
							exportChats();
						}}
						type="button"
					>
						{$i18n.t('Export')}
					</button>
				</UserSettingRow>
			{/if}

			<UserSettingRow
				let:labelId
				label={$i18n.t('settings.personal.dataControls.sharedChats.label')}
				description={$i18n.t('settings.personal.dataControls.sharedChats.description')}
			>
				<button
					id={`${labelId}-control`}
					class={actionButtonClass}
					on:click={() => {
						showSharedChatsModal = true;
					}}
					type="button"
				>
					{$i18n.t('Manage')}
				</button>
			</UserSettingRow>

			{#if $visibleControls['chat.archive']}
				<UserSettingRow
					let:labelId
					label={$i18n.t('settings.personal.dataControls.archiveAllChats.label')}
					description={$i18n.t('settings.personal.dataControls.archiveAllChats.description')}
				>
					<button
						id={`${labelId}-control`}
						class={actionButtonClass}
						on:click={() => {
							showArchiveConfirmDialog = true;
						}}
						type="button"
					>
						{$i18n.t('settings.personal.dataControls.archiveAll.label')}
					</button>
				</UserSettingRow>
			{/if}

			{#if canManageChats({ user: $user, config: null }, 'delete')}
				<UserSettingRow
					let:labelId
					label={$i18n.t('settings.personal.dataControls.deleteAllChats.label')}
					description={$i18n.t('settings.personal.dataControls.deleteAllChats.description')}
				>
					<button
						id={`${labelId}-control`}
						class={actionButtonClass}
						on:click={() => {
							showDeleteConfirmDialog = true;
						}}
						type="button"
					>
						{$i18n.t('Delete All')}
					</button>
				</UserSettingRow>
			{/if}
		</UserSettingSection>

		<UserSettingSection title={$i18n.t('settings.personal.dataControls.sections.files.title')}>
			<UserSettingRow
				let:labelId
				label={$i18n.t('settings.personal.dataControls.manageFiles.label')}
				description={$i18n.t('settings.personal.dataControls.manageFiles.description')}
			>
				<button
					id={`${labelId}-control`}
					class={actionButtonClass}
					on:click={() => {
						showFilesModal = true;
					}}
					type="button"
				>
					{$i18n.t('Manage')}
				</button>
			</UserSettingRow>
		</UserSettingSection>
	</div>
</div>
