<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type {
		ModelConnection,
		ModelConnectionConfig,
		ConnectionSave,
		ConnectionDelete
	} from '$lib/utils/airis/frontend-contracts';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	const i18n = getContext<Writable<I18n>>('i18n');

	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import AddConnectionModal from '$lib/components/AddConnectionModal.svelte';

	import Cog6 from '$lib/components/icons/Cog6.svelte';
	import ManageOllamaModal from './ManageOllamaModal.svelte';
	import Download from '$lib/components/icons/Download.svelte';

	export let onDelete: ConnectionDelete = () => {};
	export let onSubmit: ConnectionSave = () => {};

	export let url = '';
	export let idx = 0;
	export let config: ModelConnectionConfig | null = {};

	let showManageModal = false;
	let showConfigModal = false;
	let saving = false;
	let enabled = true;
	$: enabled = config?.enable ?? true;
	const submitConnection = async (connection: ModelConnection): Promise<boolean> => {
		if (saving) return false;
		saving = true;
		try {
			if ((await onSubmit(connection)) === false) return false;
			url = connection.url;
			config = { ...connection.config, key: connection.key };
			return true;
		} finally {
			saving = false;
		}
	};
	const toggleConnection = async (): Promise<void> => {
		try {
			await submitConnection({
				url,
				key: config?.key ?? '',
				config: { ...config, enable: enabled }
			});
		} catch (error) {
			toast.error(getErrorMessage(error));
		} finally {
			enabled = config?.enable ?? true;
		}
	};
</script>

<AddConnectionModal
	ollama
	edit
	bind:show={showConfigModal}
	connection={{
		url,
		key: config?.key ?? '',
		config: config
	}}
	{onDelete}
	onSubmit={submitConnection}
/>

<ManageOllamaModal bind:show={showManageModal} urlIdx={idx} />

<div class="flex gap-1.5">
	<Tooltip
		className="w-full relative"
		content={$i18n.t(`Airis will make requests to "{{url}}/api/chat"`, {
			url
		})}
		placement="top-start"
	>
		{#if !(config?.enable ?? true)}
			<div
				class="absolute top-0 bottom-0 left-0 right-0 opacity-60 bg-white dark:bg-gray-900 z-10"
			></div>
		{/if}

		<input
			class="w-full text-sm bg-transparent outline-hidden"
			placeholder={$i18n.t('Enter URL (e.g. http://localhost:11434)')}
			bind:value={url}
			readonly={true}
		/>
	</Tooltip>

	<div class="flex gap-1 items-center">
		<Tooltip content={$i18n.t('Manage')} className="self-start">
			<button
				class="self-center p-1 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-850 rounded-lg transition"
				on:click={() => {
					showManageModal = true;
				}}
				type="button"
			>
				<Download />
			</button>
		</Tooltip>

		<Tooltip content={$i18n.t('Configure')} className="self-start">
			<button
				class="self-center p-1 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-850 rounded-lg transition"
				on:click={() => {
					showConfigModal = true;
				}}
				type="button"
			>
				<Cog6 />
			</button>
		</Tooltip>

		<Tooltip content={(config?.enable ?? true) ? $i18n.t('Enabled') : $i18n.t('Disabled')}>
			<Switch bind:state={enabled} disabled={saving} on:change={toggleConnection} />
		</Tooltip>
	</div>
</div>
