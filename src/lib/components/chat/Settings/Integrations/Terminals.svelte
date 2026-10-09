<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';

	const i18n = getContext<Writable<i18nType>>('i18n');

	import Plus from '$lib/components/icons/Plus.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Connection from './Terminals/Connection.svelte';
	import AddTerminalServerModal from '$lib/components/AddTerminalServerModal.svelte';

	import type { DirectTerminalSettings } from '$lib/utils/airis/frontend-contracts';
	type TerminalServerConfig = DirectTerminalSettings;
	export let servers: TerminalServerConfig[] = [];
	export let onChange: (
		servers: TerminalServerConfig[]
	) => boolean | void | Promise<boolean | void> = () => {};
	let showAddModal = false;
	let saving = false;
	const save = async (next: TerminalServerConfig[]): Promise<boolean> => {
		if (saving) return false;
		saving = true;
		try {
			const snapshot = structuredClone(next);
			if ((await onChange(snapshot)) === false) return false;
			servers = snapshot;
			return true;
		} finally {
			saving = false;
		}
	};
	const addServer = (server: TerminalServerConfig): Promise<boolean> => save([...servers, server]);
	const enableServer = (idx: number): Promise<boolean> =>
		save(servers.map((s, i) => ({ ...s, enabled: i === idx })));
	const disableServer = (idx: number): Promise<boolean> =>
		save(servers.map((s, i) => (i === idx ? { ...s, enabled: false } : s)));
	const updateServer = (idx: number, updated: TerminalServerConfig): Promise<boolean> =>
		save(servers.map((s, i) => (i === idx ? updated : s)));
	const deleteServer = (idx: number): Promise<boolean> => save(servers.filter((_, i) => i !== idx));
</script>

<AddTerminalServerModal
	direct
	bind:show={showAddModal}
	onSubmit={(server: TerminalServerConfig) => addServer(server)}
/>

<div>
	<div class="flex justify-between items-center mb-2">
		<div class="flex items-center gap-2">
			<div class="text-xs text-gray-600 dark:text-gray-400">{$i18n.t('Open Terminal')}</div>
		</div>
		<Tooltip content={$i18n.t('Add Connection')}>
			<button
				class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-900 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-white"
				on:click={() => (showAddModal = true)}
				type="button"
				disabled={saving}
				aria-label={$i18n.t('Add Connection')}
			>
				<Plus />
			</button>
		</Tooltip>
	</div>

	<div class="flex flex-col gap-1.5">
		{#each servers as server, idx}
			<Connection
				connection={server}
				onSubmit={(updated) => updateServer(idx, updated)}
				onDelete={() => deleteServer(idx)}
				onEnable={() => enableServer(idx)}
				onDisable={() => disableServer(idx)}
			/>
		{/each}
	</div>

	{#if servers.length === 0}
		<div class="text-[0.6875rem] text-gray-400 dark:text-gray-600">
			{$i18n.t('No terminal connections configured.')}
		</div>
	{/if}
</div>
