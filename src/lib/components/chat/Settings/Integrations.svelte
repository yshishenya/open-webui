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

	import AddToolServerModal from '$lib/components/AddToolServerModal.svelte';

	type TerminalServerConfig = DirectTerminalSettings;
	export let saveSettings: (settings: Partial<Settings>) => void | Promise<void>;

	let servers: ToolServerConnection[] | null = null;
	let terminalServerConfigs: TerminalServerConfig[] = [];
	let showConnectionModal = false;

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
		for (const entry of terminalData) {
			if ('error' in entry) continue;
			const source = terminalServerConfigs.find((server) => server.url === entry.url && server.enabled);
			direct.push({ ...entry, key: source?.key ?? '', config: { enable: true } });
		}
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
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
		{$i18n.t('settings.personal.tools.title')}
	</h2>

	<div class="flex flex-1 min-h-0 flex-col overflow-y-auto scrollbar-hover pr-1.5">
		{#if servers !== null}
			<section aria-labelledby="tool-servers-heading">
				<div>
					<div class="mb-3 flex items-start justify-between gap-3">
						<div class="min-w-0">
							<h3 id="tool-servers-heading" class="text-xs text-gray-600 dark:text-gray-400">
								{$i18n.t('settings.personal.tools.sections.externalToolServers.title')}
							</h3>
							<p class="mt-1 text-[0.6875rem] leading-relaxed text-gray-400 dark:text-gray-600">
								{$i18n.t('settings.personal.tools.addConnection.description')}
							</p>
						</div>

						<Tooltip content={$i18n.t('settings.personal.tools.addConnection.label')}>
							<button
								aria-label={$i18n.t('settings.personal.tools.addConnection.label')}
								class="flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-900 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-white"
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
						<div class="text-[0.6875rem] leading-relaxed text-gray-400 dark:text-gray-600">
							{$i18n.t('No tool server connections configured.')}
						</div>
					{/if}

					<a
						class="mt-2 inline-block text-[0.6875rem] text-gray-500 underline decoration-gray-300 underline-offset-4 hover:text-gray-700 dark:text-gray-500 dark:decoration-gray-700 dark:hover:text-gray-300"
						href="https://github.com/open-webui/openapi-servers"
						target="_blank"
						rel="noopener noreferrer">{$i18n.t('Learn more about OpenAPI tool servers.')} ↗</a
					>
				</div>
			</section>

			<section class="mt-6" aria-labelledby="terminal-connections-heading">
				<Terminals servers={terminalServerConfigs} onChange={(next) => saveConnections(servers ?? [], next)} />
			</section>

			<div class="mt-6">
				<div
					class="space-y-3 border-t border-gray-100/50 pt-4 text-[0.6875rem] leading-relaxed text-gray-400 dark:border-white/[0.04] dark:text-gray-600"
				>
					<p>
						{$i18n.t(
							'Connections managed through the Admin Panel are recommended for everyday use. Direct connections provide convenient access to your own endpoints, but rely on your browser session to keep requests running, making them better suited to testing and temporary use.'
						)}
					</p>
					<p>
						<!-- LICENSE covers this Open WebUI wordmark.
							Do not alter, remove, obscure, or replace it except as LICENSE permits:
							https://docs.openwebui.com/license. -->
						{$i18n.t(
							'CORS must be properly configured by the provider to allow requests from Airis.'
						)}
					</p>
				</div>
			</div>
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
			class="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-2.5 text-xs font-normal text-white transition hover:bg-black disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
			type="submit"
			disabled={saving}
		>
			{$i18n.t('Save')}
		</button>
	</div>
</form>
