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
	import Cog6 from '$lib/components/icons/Cog6.svelte';
	import AddConnectionModal from '$lib/components/AddConnectionModal.svelte';

	export let onDelete: ConnectionDelete = () => {};
	export let onSubmit: ConnectionSave = () => {};

	export let pipeline = false;

	export let url = '';
	export let key = '';
	export let config: ModelConnectionConfig | null = {};

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
			key = connection.key;
			config = connection.config;
			return true;
		} finally {
			saving = false;
		}
	};
	const toggleConnection = async (): Promise<void> => {
		try {
			await submitConnection({ url, key: key, config: { ...config, enable: enabled } });
		} catch (error) {
			toast.error(getErrorMessage(error));
		} finally {
			enabled = config?.enable ?? true;
		}
	};
</script>

<AddConnectionModal
	edit
	direct
	bind:show={showConfigModal}
	connection={{
		url,
		key,
		config
	}}
	{onDelete}
	onSubmit={submitConnection}
/>

<div class="flex w-full items-center gap-3">
	<Tooltip
		className="w-full relative"
		content={$i18n.t(`Airis will make requests to "{{url}}/chat/completions"`, {
			url
		})}
		placement="top-start"
	>
		{#if !(config?.enable ?? true)}
			<div
				class="absolute top-0 bottom-0 left-0 right-0 opacity-60 bg-white dark:bg-gray-900 z-10"
			></div>
		{/if}
		<div class="flex w-full gap-2">
			<div class="flex-1 relative">
				<input
					class={`h-7 w-full rounded-lg border border-gray-100/50 bg-gray-50/40 px-2 text-xs text-gray-700 outline-hidden transition-colors placeholder:text-gray-300 focus:border-blue-400 dark:border-white/[0.04] dark:bg-white/[0.03] dark:text-gray-300 dark:placeholder:text-gray-700 dark:focus:border-blue-500 ${pipeline ? 'pr-8' : ''}`}
					placeholder={$i18n.t('API Base URL')}
					bind:value={url}
					autocomplete="off"
				/>
			</div>
		</div>
	</Tooltip>

	<div class="flex shrink-0 items-center gap-1">
		<Tooltip content={$i18n.t('Configure')} className="self-start">
			<button
				aria-label={$i18n.t('Open modal to configure connection')}
				class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-300"
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
