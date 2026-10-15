<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { onMount, onDestroy, getContext } from 'svelte';
	import type { Settings } from '$lib/stores';
	import type {
		ToolServerConnection,
		StoredTerminalServer,
		DirectTerminalSettings
	} from '$lib/utils/airis/frontend-contracts';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import { getToolServersData } from '$lib/apis';

	const i18n = getContext<Writable<i18nType>>('i18n');

	import { settings, toolServers, terminalServers } from '$lib/stores';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Connection from './Tools/Connection.svelte';
	import Terminals from './Integrations/Terminals.svelte';
	import UserSettingSection from './UserSettingSection.svelte';

	import AddToolServerModal from '$lib/components/AddToolServerModal.svelte';

	type TerminalServerConfig = DirectTerminalSettings;
	export let saveSettings: (settings: Partial<Settings>) => void | Promise<void>;

	let servers: ToolServerConnection[] | null = null;
	let terminalServerConfigs: TerminalServerConfig[] = [];
	let showConnectionModal = false;
	const helpTextClass = 'text-[0.6875rem] text-gray-400 dark:text-gray-600';

	let saving = false;
	let destroyed = false;
	onDestroy(() => {
		destroyed = true;
	});

	const refreshConnections = async (): Promise<void> => {
		const data = await getToolServersData(servers ?? []);
		const active: StoredTerminalServer[] = [];
		for (const entry of data) {
			if ('error' in entry)
				toast.error(
					$i18n.t('Failed to connect to {{URL}} OpenAPI tool server', { URL: entry.url })
				);
			else active.push(entry);
		}
		if (destroyed) return;
		toolServers.set(active);
		const system = ($terminalServers ?? []).filter((t) => t.id);
		const terminalData = await getToolServersData(
			terminalServerConfigs
				.filter((s) => s.enabled)
				.map((t) => ({
					url: t.url,
					auth_type: t.auth_type ?? 'bearer',
					key: t.key ?? '',
					path: t.path ?? '/openapi.json',
					config: { enable: true }
				}))
		);
		if (destroyed) return;
		const direct: StoredTerminalServer[] = [];
		for (const entry of terminalData) if (!('error' in entry)) direct.push(entry);
		terminalServers.set([...direct, ...system]);
	};

	const saveConnections = async (
		next: ToolServerConnection[],
		nextTerminals: TerminalServerConfig[] = terminalServerConfigs
	): Promise<boolean> => {
		if (saving || destroyed) return false;
		saving = true;
		try {
			const snapshot = structuredClone(next);
			const terminalSnapshot = structuredClone(nextTerminals);
			await saveSettings({
				toolServers: snapshot,
				terminalServers: terminalSnapshot
			});
			if (!destroyed) {
				servers = snapshot;
				terminalServerConfigs = terminalSnapshot;
			}
			// The connection is already saved even if catalog refresh fails.
			try {
				if (!destroyed) await refreshConnections();
			} catch {
				if (!destroyed) toast.error($i18n.t('Connection failed'));
			}
			return true;
		} catch {
			if (!destroyed) toast.error($i18n.t('Failed to save connections'));
			return false;
		} finally {
			saving = false;
		}
	};
	const updateHandler = (): Promise<boolean> => saveConnections(servers ?? []);
	const addConnectionHandler = (server: ToolServerConnection): Promise<boolean> =>
		saveConnections([...(servers ?? []), server]);
	const editConnectionHandler = (idx: number, server: ToolServerConnection): Promise<boolean> =>
		saveConnections((servers ?? []).map((c, i) => (i === idx ? server : c)));
	const deleteConnectionHandler = (idx: number): Promise<boolean> =>
		saveConnections((servers ?? []).filter((_, i) => i !== idx));

	onMount(() => {
		servers = structuredClone($settings?.toolServers ?? []);
		terminalServerConfigs = structuredClone($settings?.terminalServers ?? []);
	});
</script>

<AddToolServerModal bind:show={showConnectionModal} onSubmit={addConnectionHandler} direct />

<form
	id="tab-tools"
	class="flex flex-col h-full justify-between text-sm"
	on:submit|preventDefault={() => {
		updateHandler();
	}}
>
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">{$i18n.t('Integrations')}</h2>

	<div class="flex-1 min-h-0 overflow-y-auto scrollbar-hover pr-1.5">
		{#if servers !== null}
			<UserSettingSection title={$i18n.t('Tools')} first>
				<div>
					<div class="mb-2 flex items-center justify-between">
						<div class="text-xs text-gray-600 dark:text-gray-400">
							{$i18n.t('External Tool Servers')}
						</div>

						<Tooltip content={$i18n.t('Add Connection')}>
							<button
								aria-label={$i18n.t('Add Connection')}
								class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-900 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-white"
								on:click={() => (showConnectionModal = true)}
								type="button"
							>
								<Plus />
							</button>
						</Tooltip>
					</div>

					<div class="flex flex-col gap-1">
						{#each servers as server, idx}
							<Connection
								bind:connection={server}
								direct
								onSubmit={(next) => editConnectionHandler(idx, next)}
								onDelete={() => deleteConnectionHandler(idx)}
							/>
						{/each}
					</div>

					{#if (servers ?? []).length === 0}
						<div class={helpTextClass}>
							{$i18n.t('No tool server connections configured.')}
						</div>
					{/if}

					<div class="mt-1 {helpTextClass}">
						{$i18n.t('Connect to your own OpenAPI compatible external tool servers.')}
					</div>
					<div class={helpTextClass}>
						{$i18n.t(
							'CORS must be properly configured by the provider to allow requests from Airis.'
						)}
					</div>
				</div>
			</UserSettingSection>

			<UserSettingSection title={$i18n.t('Terminal')}>
				<Terminals
					servers={terminalServerConfigs}
					onChange={(next) => saveConnections(servers ?? [], next)}
				/>

				<div class="mt-1 {helpTextClass}">
					{$i18n.t(
						'Connect to Open Terminal instances to browse files and use them as always-on tools. Only one can be active at a time.'
					)}
				</div>
			</UserSettingSection>
		{:else}
			<div class="flex h-full justify-center">
				<div class="my-auto">
					<Spinner className="size-6" />
				</div>
			</div>
		{/if}
	</div>

	<div class="shrink-0 flex justify-end pt-3 text-sm font-normal">
		<button
			class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
			type="submit"
			disabled={saving}
		>
			{$i18n.t('Save')}
		</button>
	</div>
</form>
