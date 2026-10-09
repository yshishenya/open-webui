<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { onMount, onDestroy, getContext } from 'svelte';
	import type {
		ToolServerConnection,
		TerminalServerConnection
	} from '$lib/utils/airis/frontend-contracts';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';

	const i18n = getContext<Writable<i18nType>>('i18n');

	import { terminalServers } from '$lib/stores';
	import { getTerminalServers } from '$lib/apis/terminal';
	import { WEBUI_API_BASE_URL } from '$lib/constants';

	import Switch from '$lib/components/common/Switch.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Cog6 from '$lib/components/icons/Cog6.svelte';
	import Cloud from '$lib/components/icons/Cloud.svelte';
	import Connection from '$lib/components/chat/Settings/Tools/Connection.svelte';

	import AddToolServerModal from '$lib/components/AddToolServerModal.svelte';
	import AddTerminalServerModal from '$lib/components/AddTerminalServerModal.svelte';
	import ExternalKnowledge from './ExternalKnowledge.svelte';
	import AdminSettingSection from './AdminSettingSection.svelte';

	import {
		getToolServerConnections,
		setToolServerConnections,
		getTerminalServerConnections,
		setTerminalServerConnections
	} from '$lib/apis/configs';

	export let saveSettings: (settings: Record<string, unknown>) => void | Promise<void>;
	type TerminalConnection = TerminalServerConnection;

	let servers: ToolServerConnection[] | null = null;
	let showConnectionModal = false;

	// Terminal server admin connections
	let terminalConnections: TerminalConnection[] = [];
	let showAddTerminalModal = false;
	let editTerminalIdx: number | null = null;

	let saving = false;
	let loadError = false;
	let destroyed = false;
	const loadAbort = new AbortController();
	onDestroy(() => {
		destroyed = true;
		loadAbort.abort();
	});
	const loadConnections = async (): Promise<void> => {
		loadError = false;
		try {
			const res = await getToolServerConnections(localStorage.token, loadAbort.signal);
			if (!destroyed) servers = structuredClone(res.TOOL_SERVER_CONNECTIONS);
		} catch {
			if (!destroyed) {
				loadError = true;
				toast.error($i18n.t('Connection failed'));
			}
		}
	};
	const saveConnections = async (next: ToolServerConnection[]): Promise<boolean> => {
		if (saving || destroyed || servers === null) return false;
		saving = true;
		try {
			const res = await setToolServerConnections(localStorage.token, {
				TOOL_SERVER_CONNECTIONS: structuredClone(next)
			});
			if (!res || !Array.isArray(res.TOOL_SERVER_CONNECTIONS))
				throw new Error('Failed to save connections');
			if (!destroyed) {
				servers = res.TOOL_SERVER_CONNECTIONS;
				toast.success($i18n.t('Connections saved successfully'));
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

	let savingTerminals = false;
	let terminalLoaded = false;
	let terminalLoadError = false;
	const loadTerminalConnections = async (): Promise<void> => {
		terminalLoadError = false;
		try {
			const res = await getTerminalServerConnections(localStorage.token, loadAbort.signal);
			if (!destroyed) {
				terminalConnections = structuredClone(res.TERMINAL_SERVER_CONNECTIONS);
				terminalLoaded = true;
			}
		} catch {
			if (!destroyed) {
				terminalLoadError = true;
				toast.error($i18n.t('Connection failed'));
			}
		}
	};
	const saveTerminalServers = async (
		next: TerminalConnection[] = terminalConnections
	): Promise<boolean> => {
		if (savingTerminals || destroyed || !terminalLoaded) return false;
		savingTerminals = true;
		try {
			const res = await setTerminalServerConnections(localStorage.token, {
				TERMINAL_SERVER_CONNECTIONS: structuredClone(next)
			});
			if (!res || !Array.isArray(res.TERMINAL_SERVER_CONNECTIONS))
				throw new Error('Failed to save terminals');
			if (!destroyed) {
				terminalConnections = res.TERMINAL_SERVER_CONNECTIONS;
				toast.success($i18n.t('Terminal servers saved'));
			}
			try {
				const system = await getTerminalServers(localStorage.token, loadAbort.signal, true);
				if (!destroyed)
					terminalServers.set([
						...($terminalServers ?? []).filter((t) => !t.id),
						...system.map((t) => ({
							id: t.id,
							url: `${WEBUI_API_BASE_URL}/terminals/${t.id}`,
							name: t.name,
							key: localStorage.token
						}))
					]);
			} catch {
				if (!destroyed) toast.error($i18n.t('Connection failed'));
			}
			return true;
		} catch {
			if (!destroyed) toast.error($i18n.t('Failed to save terminal servers'));
			return false;
		} finally {
			savingTerminals = false;
		}
	};
	const addTerminalConnection = (server: TerminalConnection): Promise<boolean> =>
		saveTerminalServers([
			...terminalConnections,
			{ ...server, id: server.id ?? crypto.randomUUID() }
		]);
	const updateTerminalConnection = (idx: number, updated: TerminalConnection): Promise<boolean> =>
		saveTerminalServers(
			terminalConnections.map((c, i) =>
				i === idx ? { ...c, ...updated, id: updated.id ?? c.id } : c
			)
		);
	const removeTerminalConnection = (idx: number): Promise<boolean> =>
		saveTerminalServers(terminalConnections.filter((_, i) => i !== idx));
	const toggleTerminalConnection = (idx: number): Promise<boolean> =>
		saveTerminalServers(
			terminalConnections.map((c, i) => (i === idx ? { ...c, enabled: c.enabled === false } : c))
		);
	const submitTerminalConnection = async (
		c: TerminalConnection & { enabled: boolean }
	): Promise<boolean> => {
		const idx = editTerminalIdx;
		const saved = await (idx === null
			? addTerminalConnection(c)
			: updateTerminalConnection(idx, c));
		return saved;
	};
	const deleteTerminalConnection = async (): Promise<boolean> => {
		const idx = editTerminalIdx;
		if (idx === null) return false;
		const saved = await removeTerminalConnection(idx);
		return saved;
	};
	onMount(async () => {
		await loadConnections();
		await loadTerminalConnections();
	});
</script>

<AddToolServerModal bind:show={showConnectionModal} onSubmit={addConnectionHandler} />

<AddTerminalServerModal
	bind:show={showAddTerminalModal}
	edit={editTerminalIdx !== null}
	connection={editTerminalIdx !== null ? terminalConnections[editTerminalIdx] : null}
	onSubmit={submitTerminalConnection}
	onDelete={deleteTerminalConnection}
/>

<form
	class="flex h-full flex-col justify-between text-sm"
	on:submit|preventDefault={() => {
		updateHandler();
	}}
>
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">{$i18n.t('Integrations')}</h2>

	<div class="flex-1 min-h-0 overflow-y-auto scrollbar-hover pr-1.5">
		{#if servers !== null}
			<AdminSettingSection title={$i18n.t('Tools')} first>
				<div>
					<div class="mb-2 flex items-center justify-between">
						<div class="text-xs text-gray-600 dark:text-gray-400">
							{$i18n.t('External Tool Servers')}
						</div>

						<Tooltip content={$i18n.t(`Add Connection`)}>
							<button
								class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-900 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-white"
								on:click={() => {
									showConnectionModal = true;
								}}
								type="button"
							>
								<Plus />
							</button>
						</Tooltip>
					</div>

					<div class="flex flex-col gap-1">
						{#each servers ?? [] as server, idx}
							<Connection
								bind:connection={server}
								onSubmit={(next) => editConnectionHandler(idx, next)}
								onDelete={() => deleteConnectionHandler(idx)}
							/>
						{/each}
					</div>

					{#if (servers ?? []).length === 0}
						<div class="text-[0.6875rem] text-gray-400 dark:text-gray-600">
							{$i18n.t('No tool server connections configured.')}
						</div>
					{/if}

					<div class="mt-1 text-[0.6875rem] text-gray-400 dark:text-gray-600">
						{$i18n.t('Connect to your own OpenAPI compatible external tool servers.')}
					</div>
				</div>
			</AdminSettingSection>

			<AdminSettingSection title={$i18n.t('Terminal')}>
				{#if terminalLoadError}
					<button type="button" disabled={savingTerminals} on:click={loadTerminalConnections}
						>{$i18n.t('Retry')}</button
					>
				{/if}
				<div>
					<div class="mb-2 flex items-center justify-between">
						<div class="text-xs text-gray-600 dark:text-gray-400">{$i18n.t('Open Terminal')}</div>

						<Tooltip content={$i18n.t('Add Connection')}>
							<button
								class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-900 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-white"
								on:click={() => {
									editTerminalIdx = null;
									showAddTerminalModal = true;
								}}
								type="button"
								disabled={savingTerminals || !terminalLoaded}
							>
								<Plus />
							</button>
						</Tooltip>
					</div>

					<div class="flex flex-col gap-1.5">
						{#each terminalConnections as connection, idx}
							<div class="flex w-full gap-2 items-center">
								<Tooltip className="w-full relative" content={''} placement="top-start">
									<div class="flex w-full">
										<div
											class="flex-1 relative flex gap-1.5 items-center {connection?.enabled ===
											false
												? 'opacity-50'
												: ''}"
										>
											<Tooltip content={$i18n.t('Terminal')}>
												<Cloud className="size-4" strokeWidth="1.5" />
											</Tooltip>

											<div
												class="outline-hidden w-full bg-transparent text-xs text-gray-700 dark:text-gray-300"
											>
												{connection.name || connection.url || $i18n.t('New Terminal')}
											</div>
										</div>
									</div>
								</Tooltip>

								<div class="flex gap-1 items-center">
									<Tooltip content={$i18n.t('Configure')}>
										<button
											class="self-center p-1 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition"
											on:click={() => {
												editTerminalIdx = idx;
												showAddTerminalModal = true;
											}}
											type="button"
										>
											<Cog6 />
										</button>
									</Tooltip>

									<Tooltip
										content={connection?.enabled !== false
											? $i18n.t('Enabled')
											: $i18n.t('Disabled')}
									>
										{#key savingTerminals}
											<Switch
												state={connection?.enabled !== false}
												on:change={() => toggleTerminalConnection(idx)}
												disabled={savingTerminals}
											/>
										{/key}
									</Tooltip>
								</div>
							</div>
						{/each}
					</div>

					{#if terminalConnections.length === 0}
						<div class="text-[0.6875rem] text-gray-400 dark:text-gray-600">
							{$i18n.t('No terminal connections configured.')}
						</div>
					{/if}

					<div class="mt-1 text-[0.6875rem] text-gray-400 dark:text-gray-600">
						{$i18n.t(
							'Connect to Open Terminal instances. Admins and users granted access can use file browsing and terminal tools through these servers.'
						)}
					</div>
				</div>
			</AdminSettingSection>

			<AdminSettingSection title={$i18n.t('Knowledge')}>
				<ExternalKnowledge />
			</AdminSettingSection>
		{:else}
			<div class="flex h-full justify-center">
				<div class="my-auto">
					{#if loadError}
						<button type="button" on:click={loadConnections}>{$i18n.t('Retry')}</button>
					{:else}<Spinner className="size-6" />{/if}
				</div>
			</div>
		{/if}
	</div>

	<div class="flex justify-end pt-6 text-sm font-normal">
		<button
			class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
			type="submit"
			disabled={saving || servers === null}
		>
			{$i18n.t('Save')}
		</button>
	</div>
</form>
