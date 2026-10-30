<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	const settingId = `connection-${uuidv4()}`;
	import { getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';

	const i18n = getContext<Writable<i18nType>>('i18n');

	import Switch from '$lib/components/common/Switch.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Cog6 from '$lib/components/icons/Cog6.svelte';
	import AddTerminalServerModal from '$lib/components/AddTerminalServerModal.svelte';
	import Cloud from '$lib/components/icons/Cloud.svelte';

	import type {
		DirectTerminalSettings,
		ConnectionDelete
	} from '$lib/utils/airis/frontend-contracts';
	type TerminalServerConfig = DirectTerminalSettings;
	export let connection: TerminalServerConfig = { url: '', enabled: false };
	export let onSubmit: (
		c: TerminalServerConfig
	) => boolean | void | Promise<boolean | void> = () => {};
	export let onDelete: ConnectionDelete = () => {};
	export let onEnable: ConnectionDelete = () => {};
	export let onDisable: ConnectionDelete = () => {};
	let showConfigModal = false;
	let saving = false;
	const saveConnection = async (next: TerminalServerConfig): Promise<boolean> => {
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
	const toggle = async (): Promise<void> => {
		if (saving) return;
		saving = true;
		try {
			await (connection.enabled ? onDisable() : onEnable());
		} catch {
			toast.error($i18n.t('Failed to save connections'));
		} finally {
			saving = false;
		}
	};
</script>

<AddTerminalServerModal
	direct
	edit
	bind:show={showConfigModal}
	{connection}
	{onDelete}
	onSubmit={saveConnection}
/>

<div class="group/setting-row flex w-full gap-2 items-center">
	<Tooltip className="w-full relative" content={''} placement="top-start">
		<div class="flex w-full">
			<div
				class="flex-1 relative flex gap-1.5 items-center {!connection?.enabled ? 'opacity-50' : ''}"
			>
				<Tooltip content={$i18n.t('Terminal')}>
					<Cloud className="size-4" strokeWidth="1.5" />
				</Tooltip>

				<label
					for={`${settingId}-control`}
					class="outline-hidden w-full bg-transparent text-xs text-gray-600 dark:text-gray-400 transition-colors duration-150 group-hover/setting-row:text-gray-900 group-focus-within/setting-row:text-gray-900 dark:group-hover/setting-row:text-white dark:group-focus-within/setting-row:text-white group-has-[button[id$=-control]:enabled]/setting-row:cursor-pointer group-has-[button[id$=-control]:disabled]/setting-row:cursor-not-allowed"
				>
					{connection.name || connection.url || $i18n.t('New Terminal')}
				</label>
			</div>
		</div>
	</Tooltip>

	<div class="flex gap-1 items-center">
		<Tooltip content={$i18n.t('Configure')}>
			<button
				class="self-center p-1 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition"
				on:click={() => {
					showConfigModal = true;
				}}
				type="button"
			>
				<Cog6 />
			</button>
		</Tooltip>

		<Tooltip content={connection?.enabled ? $i18n.t('Enabled') : $i18n.t('Disabled')}>
			{#key saving}
				<Switch id={`${settingId}-control`} state={connection?.enabled} on:change={toggle} disabled={saving} />
			{/key}
		</Tooltip>
	</div>
</div>
