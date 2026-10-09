<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type {
		ToolServerConnection,
		ToolConnectionSave,
		ConnectionDelete
	} from '$lib/utils/airis/frontend-contracts';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	const i18n = getContext<Readable<I18n>>('i18n');

	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import Cog6 from '$lib/components/icons/Cog6.svelte';
	import AddToolServerModal from '$lib/components/AddToolServerModal.svelte';
	import WrenchAlt from '$lib/components/icons/WrenchAlt.svelte';

	export let onDelete: ConnectionDelete = () => {};
	export let onSubmit: ToolConnectionSave = () => {};

	export let connection: ToolServerConnection;
	export let direct = false;

	let showConfigModal = false;
	let saving = false;
	const submitHandler = async (next: ToolServerConnection): Promise<boolean> => {
		if (saving) return false;
		saving = true;
		try {
			if ((await onSubmit(next)) === false) return false;
			connection = next;
			return true;
		} finally {
			saving = false;
		}
	};
	const toggleHandler = async (): Promise<void> => {
		try {
			await submitHandler({
				...connection,
				config: { ...connection.config, enable: !(connection.config?.enable ?? true) }
			});
		} catch (error) {
			toast.error(getErrorMessage(error));
		}
	};
</script>

<AddToolServerModal
	edit
	{direct}
	bind:show={showConfigModal}
	{connection}
	{onDelete}
	onSubmit={submitHandler}
/>

<div class="flex w-full items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
	<Tooltip className="w-full relative" content={''} placement="top-start">
		<div class="flex w-full">
			<div
				class="flex-1 relative flex gap-1.5 items-center {!(connection?.config?.enable ?? true)
					? 'opacity-50'
					: ''}"
			>
				<Tooltip content={connection?.type === 'mcp' ? $i18n.t('MCP') : $i18n.t('OpenAPI')}>
					<WrenchAlt />
				</Tooltip>

				{#if connection?.info?.name}
					<div class="w-full bg-transparent capitalize outline-hidden">
						{connection?.info?.name ?? connection?.url}
						<span class="text-gray-500">{connection?.info?.id ?? ''}</span>
					</div>
				{:else}
					<div>
						{connection?.url}
					</div>
				{/if}
			</div>
		</div>
	</Tooltip>

	<div class="flex shrink-0 items-center gap-1">
		<Tooltip content={$i18n.t('Configure')} className="self-start">
			<button
				class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-300"
				on:click={() => {
					showConfigModal = true;
				}}
				type="button"
			>
				<Cog6 />
			</button>
		</Tooltip>

		<Tooltip
			content={(connection?.config?.enable ?? true) ? $i18n.t('Enabled') : $i18n.t('Disabled')}
		>
			<Switch
				state={connection?.config?.enable ?? true}
				disabled={saving}
				on:change={toggleHandler}
			/>
		</Tooltip>
	</div>
</div>
