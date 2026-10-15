<script lang="ts">
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	import { downloadDatabase } from '$lib/apis/utils';
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import { config } from '$lib/stores';
	import { toast } from 'svelte-sonner';
	import { getAllUserChats } from '$lib/apis/chats';
	import { getAllUsers, type UserInfoResponse } from '$lib/apis/users';
	import { exportConfig, importConfig } from '$lib/apis/configs';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	import AdminSettingRow from './AdminSettingRow.svelte';
	import AdminSettingSection from './AdminSettingSection.svelte';

	const i18n = getContext<Readable<I18n>>('i18n');

	let configImportInputElement: HTMLInputElement;
	let importing = false;
	const actionButtonClass =
		'text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-500 dark:hover:text-white';

	const exportAllUserChats = async (): Promise<void> => {
		let blob = new Blob([JSON.stringify(await getAllUserChats(localStorage.token))], {
			type: 'application/json'
		});
		saveAs(blob, `all-chats-export-${Date.now()}.json`);
	};

	const exportUsers = async (): Promise<void> => {
		const users = await getAllUsers(localStorage.token);

		const headers = ['id', 'name', 'email', 'role'] as const;

		const csv = [
			headers.join(','),
			...users.users.map((user: UserInfoResponse) => {
				return headers
					.map((header) => {
						if (user[header] === null || user[header] === undefined) {
							return '';
						}
						return `"${String(user[header]).replace(/"/g, '""')}"`;
					})
					.join(',');
			})
		].join('\n');

		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		saveAs(blob, 'users.csv');
	};

	const importConfigHandler = async (event: Event): Promise<void> => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || importing) return;
		importing = true;
		try {
			const text = await file.text();
			let configuration: unknown;
			try {
				configuration = JSON.parse(text);
			} catch {
				throw new Error($i18n.t('Invalid JSON file'));
			}
			if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
				throw new Error($i18n.t('Invalid JSON file'));
			}
			await importConfig(localStorage.token, configuration);
			toast.success($i18n.t('Config imported successfully'));
		} catch (error) {
			toast.error(getErrorMessage(error));
		} finally {
			importing = false;
		}
	};
</script>

<div class="flex flex-col h-full justify-between text-sm">
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">{$i18n.t('Database')}</h2>

	<div class="flex-1 min-h-0 overflow-y-auto scrollbar-hover pr-1.5">
		<input
			id="config-json-input"
			bind:this={configImportInputElement}
			hidden
			type="file"
			accept=".json"
			disabled={importing}
			on:change={importConfigHandler}
		/>

		<AdminSettingSection title={$i18n.t('Config')} first>
			<AdminSettingRow
				label={$i18n.t('Import Config')}
				description={$i18n.t('Import admin configuration from a JSON export file.')}
			>
				<button
					class={actionButtonClass}
					disabled={importing}
					aria-busy={importing}
					on:click={() => {
						configImportInputElement.click();
					}}
					type="button"
				>
					{$i18n.t('Import')}
				</button>
			</AdminSettingRow>

			<AdminSettingRow
				label={$i18n.t('Export Config')}
				description={$i18n.t('Download the current admin configuration as JSON.')}
			>
				<button
					class={actionButtonClass}
					on:click={async () => {
						const config = await exportConfig(localStorage.token);
						const blob = new Blob([JSON.stringify(config)], {
							type: 'application/json'
						});
						saveAs(blob, `config-${Date.now()}.json`);
					}}
					type="button"
				>
					{$i18n.t('Export')}
				</button>
			</AdminSettingRow>
		</AdminSettingSection>

		{#if $config?.features.enable_admin_export ?? true}
			<AdminSettingSection title={$i18n.t('Export')}>
				<AdminSettingRow
					label={$i18n.t('Database')}
					description={$i18n.t('Download the application database when supported.')}
				>
					<button
						class={actionButtonClass}
						on:click={() => {
							downloadDatabase(localStorage.token).catch((error) => {
								toast.error(`${error}`);
							});
						}}
						type="button"
					>
						{$i18n.t('Database')}
					</button>
				</AdminSettingRow>

				<AdminSettingRow
					label={$i18n.t('All Chats')}
					description={$i18n.t("Download every user's chat history as JSON.")}
				>
					<button class={actionButtonClass} on:click={exportAllUserChats} type="button">
						{$i18n.t('Export')}
					</button>
				</AdminSettingRow>

				<AdminSettingRow
					label={$i18n.t('Users')}
					description={$i18n.t('Download all users as CSV.')}
				>
					<button class={actionButtonClass} on:click={exportUsers} type="button">
						{$i18n.t('Export')}
					</button>
				</AdminSettingRow>
			</AdminSettingSection>
		{/if}
	</div>
</div>
