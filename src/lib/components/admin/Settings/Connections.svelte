<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { createEventDispatcher, onMount, onDestroy, getContext } from 'svelte';

	const dispatch = createEventDispatcher();

	import { getOllamaConfig, updateOllamaConfig } from '$lib/apis/ollama';
	import { getOpenAIConfig, updateOpenAIConfig, getOpenAIModels } from '$lib/apis/openai';
	import { getModels as _getModels, getBackendConfig } from '$lib/apis';
	import { getConnectionsConfig, setConnectionsConfig } from '$lib/apis/configs';

	import { config, models, settings, user } from '$lib/stores';

	import Switch from '$lib/components/common/Switch.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import ArrowPath from '$lib/components/icons/ArrowPath.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';

	import OpenAIConnection from './Connections/OpenAIConnection.svelte';
	import AddConnectionModal from '$lib/components/AddConnectionModal.svelte';
	import OllamaConnection from './Connections/OllamaConnection.svelte';
	import AdminSettingRow from './AdminSettingRow.svelte';
	import AdminSettingSection from './AdminSettingSection.svelte';

	import type { Writable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { OpenAIConfig } from '$lib/apis/openai';
	import type { OllamaConfig } from '$lib/apis/ollama';
	import type { ModelConnection, ModelConnectionConfig } from '$lib/utils/airis/frontend-contracts';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	const i18n = getContext<Writable<I18n>>('i18n');

	const getModels = async () => {
		const models = await _getModels(
			localStorage.token,
			$config?.features?.enable_direct_connections ? ($settings?.directConnections ?? null) : null,
			false,
			true
		);
		return models;
	};

	let OLLAMA_BASE_URLS: string[] = [];
	let OLLAMA_API_CONFIGS: Record<string, ModelConnectionConfig | null> = {};
	let OPENAI_API_KEYS: string[] = [];
	let OPENAI_API_BASE_URLS: string[] = [];
	let OPENAI_API_CONFIGS: Record<string, ModelConnectionConfig | null> = {};
	let ENABLE_OPENAI_API: boolean | null = null;
	let ENABLE_OLLAMA_API: boolean | null = null;
	type ConnectionsConfig = {
		ENABLE_DIRECT_CONNECTIONS: boolean;
		ENABLE_BASE_MODELS_CACHE: boolean;
	};
	let connectionsConfig: ConnectionsConfig | null = null;
	let savedConnections: ConnectionsConfig | null = null;
	let savedOpenAI: OpenAIConfig | null = null;
	let savedOllama: OllamaConfig | null = null;
	let savingOpenAI = false;
	let savingOllama = false;
	let savingConnections = false;
	let pipelineUrls: Record<string, boolean> = {};
	let showAddOpenAIConnectionModal = false;
	let showAddOllamaConnectionModal = false;
	const lifetime = new AbortController();
	onDestroy(() => lifetime.abort());
	let modelListRefreshing = false;

	const refreshModels = async (): Promise<void> => {
		try {
			const next = await getModels();
			if (!lifetime.signal.aborted) models.set(next);
		} catch (error) {
			if (!lifetime.signal.aborted) toast.error(getErrorMessage(error));
		}
	};
	const applyOpenAI = (value: OpenAIConfig): void => {
		savedOpenAI = structuredClone(value);
		ENABLE_OPENAI_API = value.ENABLE_OPENAI_API;
		OPENAI_API_BASE_URLS = value.OPENAI_API_BASE_URLS;
		OPENAI_API_KEYS = value.OPENAI_API_KEYS;
		OPENAI_API_CONFIGS = value.OPENAI_API_CONFIGS;
	};
	const applyOllama = (value: OllamaConfig): void => {
		savedOllama = structuredClone(value);
		ENABLE_OLLAMA_API = value.ENABLE_OLLAMA_API;
		OLLAMA_BASE_URLS = value.OLLAMA_BASE_URLS;
		OLLAMA_API_CONFIGS = value.OLLAMA_API_CONFIGS;
	};
	const updateOpenAIHandler = async (
		next: OpenAIConfig = {
			ENABLE_OPENAI_API,
			OPENAI_API_BASE_URLS,
			OPENAI_API_KEYS,
			OPENAI_API_CONFIGS
		}
	): Promise<boolean> => {
		if (savingOpenAI || ENABLE_OPENAI_API === null) return false;
		savingOpenAI = true;
		try {
			const snapshot = structuredClone(next);
			snapshot.OPENAI_API_BASE_URLS = snapshot.OPENAI_API_BASE_URLS.map((url) =>
				url.replace(/\/$/, '')
			);
			snapshot.OPENAI_API_KEYS = snapshot.OPENAI_API_BASE_URLS.map(
				(_, i) => snapshot.OPENAI_API_KEYS[i] ?? ''
			);
			const saved = await updateOpenAIConfig(localStorage.token, snapshot, lifetime.signal);
			if (!saved || lifetime.signal.aborted) return false;
			applyOpenAI(saved);
			toast.success($i18n.t('OpenAI API settings updated'));
			await refreshModels();
			return true;
		} catch (error) {
			if (!lifetime.signal.aborted) {
				ENABLE_OPENAI_API = savedOpenAI?.ENABLE_OPENAI_API ?? ENABLE_OPENAI_API;
				toast.error(getErrorMessage(error));
			}
			return false;
		} finally {
			savingOpenAI = false;
		}
	};
	const updateOllamaHandler = async (
		next: OllamaConfig = {
			ENABLE_OLLAMA_API,
			OLLAMA_BASE_URLS,
			OLLAMA_API_CONFIGS
		}
	): Promise<boolean> => {
		if (savingOllama || ENABLE_OLLAMA_API === null) return false;
		savingOllama = true;
		try {
			const snapshot = structuredClone(next);
			snapshot.OLLAMA_BASE_URLS = snapshot.OLLAMA_BASE_URLS.map((url) => url.replace(/\/$/, ''));
			const saved = await updateOllamaConfig(localStorage.token, snapshot, lifetime.signal);
			if (!saved || lifetime.signal.aborted) return false;
			applyOllama(saved);
			toast.success($i18n.t('Ollama API settings updated'));
			await refreshModels();
			return true;
		} catch (error) {
			if (!lifetime.signal.aborted) {
				ENABLE_OLLAMA_API = savedOllama?.ENABLE_OLLAMA_API ?? ENABLE_OLLAMA_API;
				toast.error(getErrorMessage(error));
			}
			return false;
		} finally {
			savingOllama = false;
		}
	};
	const updateConnectionsHandler = async (): Promise<void> => {
		if (!connectionsConfig || savingConnections) return;
		savingConnections = true;
		try {
			const saved: ConnectionsConfig | null = await setConnectionsConfig(
				localStorage.token,
				structuredClone(connectionsConfig)
			);
			if (!saved) throw new Error('Connections settings could not be saved.');
			if (lifetime.signal.aborted) return;
			connectionsConfig = saved;
			savedConnections = structuredClone(saved);
			toast.success($i18n.t('Connections settings updated'));
			await refreshModels();
			const next = await getBackendConfig();
			if (!lifetime.signal.aborted) config.set(next);
		} catch (error) {
			if (!lifetime.signal.aborted) {
				connectionsConfig = structuredClone(savedConnections);
				toast.error(getErrorMessage(error));
			}
		} finally {
			savingConnections = false;
		}
	};

	const refreshModelListHandler = async () => {
		modelListRefreshing = true;

		try {
			await models.set(await getModels());
			toast.success($i18n.t('Model list refreshed'));
		} catch (error) {
			toast.error(`${error}`);
		} finally {
			modelListRefreshing = false;
		}
	};

	const addOpenAIConnectionHandler = (connection: ModelConnection): Promise<boolean> =>
		updateOpenAIHandler({
			ENABLE_OPENAI_API,
			OPENAI_API_BASE_URLS: [...OPENAI_API_BASE_URLS, connection.url],
			OPENAI_API_KEYS: [...OPENAI_API_KEYS, connection.key],
			OPENAI_API_CONFIGS: {
				...OPENAI_API_CONFIGS,
				[OPENAI_API_BASE_URLS.length]: connection.config
			}
		});
	const addOllamaConnectionHandler = (connection: ModelConnection): Promise<boolean> =>
		updateOllamaHandler({
			ENABLE_OLLAMA_API,
			OLLAMA_BASE_URLS: [...OLLAMA_BASE_URLS, connection.url],
			OLLAMA_API_CONFIGS: {
				...OLLAMA_API_CONFIGS,
				[OLLAMA_BASE_URLS.length]: { ...connection.config, key: connection.key }
			}
		});
	const editOpenAIConnectionHandler = (
		idx: number,
		connection: ModelConnection
	): Promise<boolean> =>
		updateOpenAIHandler({
			ENABLE_OPENAI_API,
			OPENAI_API_BASE_URLS: OPENAI_API_BASE_URLS.map((url, i) =>
				i === idx ? connection.url : url
			),
			OPENAI_API_KEYS: OPENAI_API_KEYS.map((key, i) => (i === idx ? connection.key : key)),
			OPENAI_API_CONFIGS: { ...OPENAI_API_CONFIGS, [idx]: connection.config }
		});
	const editOllamaConnectionHandler = (
		idx: number,
		connection: ModelConnection
	): Promise<boolean> =>
		updateOllamaHandler({
			ENABLE_OLLAMA_API,
			OLLAMA_BASE_URLS: OLLAMA_BASE_URLS.map((url, i) => (i === idx ? connection.url : url)),
			OLLAMA_API_CONFIGS: {
				...OLLAMA_API_CONFIGS,
				[idx]: { ...connection.config, key: connection.key }
			}
		});
	const deleteOpenAIConnectionHandler = (idx: number): Promise<boolean> =>
		updateOpenAIHandler({
			ENABLE_OPENAI_API,
			OPENAI_API_BASE_URLS: OPENAI_API_BASE_URLS.filter((_, i) => i !== idx),
			OPENAI_API_KEYS: OPENAI_API_KEYS.filter((_, i) => i !== idx),
			OPENAI_API_CONFIGS: Object.fromEntries(
				OPENAI_API_BASE_URLS.filter((_, i) => i !== idx).map((_, i) => [
					i,
					OPENAI_API_CONFIGS[i < idx ? i : i + 1] ?? {}
				])
			)
		});
	const deleteOllamaConnectionHandler = (idx: number): Promise<boolean> =>
		updateOllamaHandler({
			ENABLE_OLLAMA_API,
			OLLAMA_BASE_URLS: OLLAMA_BASE_URLS.filter((_, i) => i !== idx),
			OLLAMA_API_CONFIGS: Object.fromEntries(
				OLLAMA_BASE_URLS.filter((_, i) => i !== idx).map((_, i) => [
					i,
					OLLAMA_API_CONFIGS[i < idx ? i : i + 1] ?? {}
				])
			)
		});
	onMount(async () => {
		if ($user?.role !== 'admin') return;
		try {
			const [ollama, openai, connections] = await Promise.all([
				getOllamaConfig(localStorage.token, lifetime.signal),
				getOpenAIConfig(localStorage.token, lifetime.signal),
				getConnectionsConfig(localStorage.token)
			]);
			if (lifetime.signal.aborted) return;
			for (const [i, url] of openai.OPENAI_API_BASE_URLS.entries())
				openai.OPENAI_API_CONFIGS[i] ??= openai.OPENAI_API_CONFIGS[url] ?? {};
			for (const [i, url] of ollama.OLLAMA_BASE_URLS.entries())
				ollama.OLLAMA_API_CONFIGS[i] ??= ollama.OLLAMA_API_CONFIGS[url] ?? {};
			applyOpenAI(openai);
			applyOllama(ollama);
			connectionsConfig = connections;
			savedConnections = structuredClone(connections);
			if (ENABLE_OPENAI_API)
				await Promise.all(
					OPENAI_API_BASE_URLS.map(async (url, idx) => {
						if (OPENAI_API_CONFIGS[idx]?.enable === false) return;
						try {
							const res = await getOpenAIModels(localStorage.token, idx);
							if (!lifetime.signal.aborted && res?.pipelines) pipelineUrls[url] = true;
						} catch (error) {
							if (!lifetime.signal.aborted) toast.error(getErrorMessage(error));
						}
					})
				);
		} catch (error) {
			if (!lifetime.signal.aborted) toast.error(getErrorMessage(error));
		}
	});
	const submitHandler = async (): Promise<void> => {
		if (!(await updateOpenAIHandler()) || !(await updateOllamaHandler())) return;
		try {
			const next = await getBackendConfig();
			if (!lifetime.signal.aborted) {
				config.set(next);
				dispatch('save');
			}
		} catch (error) {
			if (!lifetime.signal.aborted) toast.error(getErrorMessage(error));
		}
	};
</script>

<AddConnectionModal
	bind:show={showAddOpenAIConnectionModal}
	onSubmit={addOpenAIConnectionHandler}
/>

<AddConnectionModal
	ollama
	bind:show={showAddOllamaConnectionModal}
	onSubmit={addOllamaConnectionHandler}
/>

<form class="flex h-full flex-col justify-between text-sm" on:submit|preventDefault={submitHandler}>
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">
		{$i18n.t('settings.admin.connections.title')}
	</h2>

	<div class="flex-1 min-h-0 overflow-y-auto scrollbar-hover pr-1.5">
		{#if ENABLE_OPENAI_API !== null && ENABLE_OLLAMA_API !== null && connectionsConfig !== null}
			<AdminSettingSection first>
				<AdminSettingRow label={$i18n.t('settings.admin.connections.openaiApi.label')} let:labelId>
					<Switch
						bind:state={ENABLE_OPENAI_API}
						disabled={savingOpenAI}
						on:change={async () => {
							void updateOpenAIHandler();
						}}
						ariaLabelledbyId={labelId}
					/>
				</AdminSettingRow>

				{#if ENABLE_OPENAI_API}
					<div>
						<div class="mb-2 flex items-center justify-between gap-4">
							<div class="text-xs text-gray-600 dark:text-gray-400">
								{$i18n.t('settings.admin.connections.manageOpenaiApiConnections.label')}
							</div>

							<Tooltip content={$i18n.t('settings.admin.connections.addConnection.label')}>
								<button
									aria-label={$i18n.t('settings.admin.connections.addConnection.label')}
									class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
									on:click={() => {
										showAddOpenAIConnectionModal = true;
									}}
									type="button"
								>
									<Plus />
								</button>
							</Tooltip>
						</div>

						<div class="flex flex-col gap-1.5">
							{#each OPENAI_API_BASE_URLS as url, idx}
								<OpenAIConnection
									url={OPENAI_API_BASE_URLS[idx]}
									key={OPENAI_API_KEYS[idx]}
									config={OPENAI_API_CONFIGS[idx]}
									pipeline={pipelineUrls[url] ? true : false}
									onSubmit={(connection) => editOpenAIConnectionHandler(idx, connection)}
									onDelete={() => deleteOpenAIConnectionHandler(idx)}
								/>
							{/each}
						</div>
					</div>
				{/if}

				<AdminSettingRow label={$i18n.t('settings.admin.connections.ollamaApi.label')} let:labelId>
					<Switch
						bind:state={ENABLE_OLLAMA_API}
						disabled={savingOllama}
						on:change={async () => {
							void updateOllamaHandler();
						}}
						ariaLabelledbyId={labelId}
					/>
				</AdminSettingRow>

				{#if ENABLE_OLLAMA_API}
					<div>
						<div class="mb-2 flex items-center justify-between gap-4">
							<div class="text-xs text-gray-600 dark:text-gray-400">
								{$i18n.t('settings.admin.connections.manageOllamaApiConnections.label')}
							</div>

							<Tooltip content={$i18n.t('settings.admin.connections.addConnection.label')}>
								<button
									aria-label={$i18n.t('settings.admin.connections.addConnection.label')}
									class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
									on:click={() => {
										showAddOllamaConnectionModal = true;
									}}
									type="button"
								>
									<Plus />
								</button>
							</Tooltip>
						</div>

						<div class="flex flex-col gap-1.5">
							{#each OLLAMA_BASE_URLS as url, idx}
								<OllamaConnection
									url={url}
									config={OLLAMA_API_CONFIGS[idx]}
									{idx}
									onSubmit={(connection) => editOllamaConnectionHandler(idx, connection)}
									onDelete={() => deleteOllamaConnectionHandler(idx)}
								/>
							{/each}
						</div>

						<div class="mt-1 text-[0.6875rem] text-gray-400 dark:text-gray-600">
							{$i18n.t('Trouble accessing Ollama?')}
						</div>
					</div>
				{/if}
			</AdminSettingSection>

			<AdminSettingSection
				title={$i18n.t('settings.admin.connections.sections.userConnections.title')}
			>
				<AdminSettingRow
					label={$i18n.t('settings.admin.connections.directConnections.label')}
					description={$i18n.t('settings.admin.connections.directConnections.description')}
					let:labelId
				>
					<Switch
						disabled={savingConnections}
						bind:state={connectionsConfig.ENABLE_DIRECT_CONNECTIONS}
						on:change={async () => {
							updateConnectionsHandler();
						}}
						ariaLabelledbyId={labelId}
					/>
				</AdminSettingRow>

				<AdminSettingRow
					label={$i18n.t('settings.admin.connections.cacheBaseModelList.label')}
					description={$i18n.t('settings.admin.connections.cacheBaseModelList.description')}
					let:labelId
				>
					<div class="flex items-center gap-1.5">
						{#if connectionsConfig.ENABLE_BASE_MODELS_CACHE}
							<Tooltip content={$i18n.t('settings.admin.connections.refreshModels.label')}>
								<button
									class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
									type="button"
									disabled={modelListRefreshing}
									on:click={refreshModelListHandler}
									aria-label={$i18n.t('settings.admin.connections.refreshModels.label')}
								>
									{#if modelListRefreshing}
										<Spinner className="size-3.5" />
									{:else}
										<ArrowPath className="size-4" />
									{/if}
								</button>
							</Tooltip>
						{/if}

						<Switch
							disabled={savingConnections}
							bind:state={connectionsConfig.ENABLE_BASE_MODELS_CACHE}
							on:change={async () => {
								updateConnectionsHandler();
							}}
							ariaLabelledbyId={labelId}
						/>
					</div>
				</AdminSettingRow>
			</AdminSettingSection>
		{:else}
			<div class="flex h-full justify-center">
				<div class="my-auto">
					<Spinner className="size-6" />
				</div>
			</div>
		{/if}
	</div>

	<div class="flex justify-end pt-6 text-sm font-normal">
		<button
			class="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-2.5 text-xs font-normal text-white transition hover:bg-black disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
			type="submit"
			disabled={savingOpenAI ||
				savingOllama ||
				ENABLE_OPENAI_API === null ||
				ENABLE_OLLAMA_API === null}
		>
			{$i18n.t('Save')}
		</button>
	</div>
</form>
