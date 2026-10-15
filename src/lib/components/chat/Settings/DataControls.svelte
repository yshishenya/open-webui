<script lang="ts">
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;
	import { user } from '$lib/stores';
	import { refreshChatList } from '$lib/stores/chatList';
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
			await refreshChatList(token, { refreshPinned: true });
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
			if (localStorage.token === token) await refreshChatList(token, { clearPinned: true });
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
			if (localStorage.token === token) await refreshChatList(token);
		} catch (error) {
			if (localStorage.token === token) toast.error(getErrorMessage(error));
		}
	};
</script>

<SharedChatsModal bind:show={showSharedChatsModal} />
<FilesModal bind:show={showFilesModal} />

<ConfirmDialog
	title={$i18n.t('Archive All Chats')}
	message={$i18n.t('Are you sure you want to archive all chats? This action cannot be undone.')}
	bind:show={showArchiveConfirmDialog}
	on:confirm={archiveAllChatsHandler}
	on:cancel={() => {
		showArchiveConfirmDialog = false;
	}}
/>

<ConfirmDialog
	title={$i18n.t('Delete All Chats')}
	message={$i18n.t('Are you sure you want to delete all chats? This action cannot be undone.')}
	bind:show={showDeleteConfirmDialog}
	on:confirm={deleteAllChatsHandler}
	on:cancel={() => {
		showDeleteConfirmDialog = false;
	}}
/>

<div id="tab-chats" class="flex flex-col h-full text-sm">
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
		{$i18n.t('Data Controls')}
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

		<UserSettingSection title={$i18n.t('Chats')} first>
			{#if $user?.role === 'admin' || ($user?.permissions?.chat?.import ?? true)}
				<UserSettingRow
					label={$i18n.t('Import Chats')}
					description={$i18n.t('Import chat history from a JSON export file.')}
				>
					<button
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

			{#if $user?.role === 'admin' || ($user?.permissions?.chat?.export ?? true)}
				<UserSettingRow
					label={$i18n.t('Export Chats')}
					description={$i18n.t('Download your chat history as a JSON export.')}
				>
					<button
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
				label={$i18n.t('Shared Chats')}
				description={$i18n.t('Review and manage chats you have shared.')}
			>
				<button
					class={actionButtonClass}
					on:click={() => {
						showSharedChatsModal = true;
					}}
					type="button"
				>
					{$i18n.t('Manage')}
				</button>
			</UserSettingRow>

			<UserSettingRow
				label={$i18n.t('Archive All Chats')}
				description={$i18n.t('Move every chat into the archive after confirmation.')}
			>
				<button
					class={actionButtonClass}
					on:click={() => {
						showArchiveConfirmDialog = true;
					}}
					type="button"
				>
					{$i18n.t('Archive All')}
				</button>
			</UserSettingRow>

			<UserSettingRow
				label={$i18n.t('Delete All Chats')}
				description={$i18n.t('Permanently delete every chat after confirmation.')}
			>
				<button
					class={actionButtonClass}
					on:click={() => {
						showDeleteConfirmDialog = true;
					}}
					type="button"
				>
					{$i18n.t('Delete All')}
				</button>
			</UserSettingRow>
		</UserSettingSection>

		<UserSettingSection title={$i18n.t('Files')}>
			<UserSettingRow
				label={$i18n.t('Manage Files')}
				description={$i18n.t('Open the file manager for uploaded files.')}
			>
				<button
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
