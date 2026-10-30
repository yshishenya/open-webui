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
	<div class="flex justify-between items-start gap-3 mb-3">
		<div class="min-w-0">
			<h3 id="terminal-connections-heading" class="text-xs text-gray-600 dark:text-gray-400">
				{$i18n.t('settings.personal.tools.terminals.sections.openTerminal.title')}
			</h3>
			<p class="mt-1 text-[0.6875rem] leading-relaxed text-gray-400 dark:text-gray-600">
				{$i18n.t('settings.personal.tools.terminals.addConnection.description')}
			</p>
		</div>
		<Tooltip content={$i18n.t('settings.personal.tools.terminals.addConnection.label')}>
			<button
				class="flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-900 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-white"
				on:click={() => (showAddModal = true)}
				type="button"
				disabled={saving}
				aria-label={$i18n.t('settings.personal.tools.terminals.addConnection.label')}
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
		<div class="text-[0.6875rem] leading-relaxed text-gray-400 dark:text-gray-600">
			{$i18n.t('No terminal connections configured.')}
		</div>
	{/if}
	<a
		class="mt-2 inline-block text-[0.6875rem] text-gray-500 underline decoration-gray-300 underline-offset-4 hover:text-gray-700 dark:text-gray-500 dark:decoration-gray-700 dark:hover:text-gray-300"
		href="https://github.com/open-webui/open-terminal"
		target="_blank"
		rel="noopener noreferrer">{$i18n.t('Learn more about Open Terminal')} ↗</a
	>
</div>
