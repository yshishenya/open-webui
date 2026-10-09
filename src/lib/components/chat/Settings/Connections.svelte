<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type {
		DirectModelConnections,
		ModelConnection
	} from '$lib/utils/airis/frontend-contracts';
	import type { Settings } from '$lib/stores';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/airis/error_message';

	const i18n = getContext<Writable<I18n>>('i18n');

	import { settings } from '$lib/stores';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Connection from './Connections/Connection.svelte';
	import UserSettingSection from './UserSettingSection.svelte';

	import AddConnectionModal from '$lib/components/AddConnectionModal.svelte';

	export let saveSettings: (updated: Partial<Settings>) => void | Promise<void>;
	let config: DirectModelConnections | null = null;
	let saving = false;
	let showConnectionModal = false;

	const updateHandler = async (next = config): Promise<boolean> => {
		if (!next || saving) return false;
		saving = true;
		try {
			const snapshot: DirectModelConnections = {
				...structuredClone(next),
				OPENAI_API_BASE_URLS: next.OPENAI_API_BASE_URLS.map((url) => url.replace(/\/$/, '')),
				OPENAI_API_KEYS: next.OPENAI_API_BASE_URLS.map((_, idx) => next.OPENAI_API_KEYS[idx] ?? '')
			};
			await saveSettings({ directConnections: snapshot });
			config = snapshot;
			return true;
		} catch (error) {
			toast.error(getErrorMessage(error));
			return false;
		} finally {
			saving = false;
		}
	};
	const addConnectionHandler = (connection: ModelConnection): Promise<boolean> => {
		if (!config) return Promise.resolve(false);
		return updateHandler({
			OPENAI_API_BASE_URLS: [...config.OPENAI_API_BASE_URLS, connection.url],
			OPENAI_API_KEYS: [...config.OPENAI_API_KEYS, connection.key],
			OPENAI_API_CONFIGS: {
				...config.OPENAI_API_CONFIGS,
				[config.OPENAI_API_BASE_URLS.length]: connection.config
			}
		});
	};
	const editConnectionHandler = (idx: number, connection: ModelConnection): Promise<boolean> => {
		if (!config) return Promise.resolve(false);
		return updateHandler({
			OPENAI_API_BASE_URLS: config.OPENAI_API_BASE_URLS.map((url, i) =>
				i === idx ? connection.url : url
			),
			OPENAI_API_KEYS: config.OPENAI_API_KEYS.map((key, i) => (i === idx ? connection.key : key)),
			OPENAI_API_CONFIGS: { ...config.OPENAI_API_CONFIGS, [idx]: connection.config }
		});
	};
	const deleteConnectionHandler = (idx: number): Promise<boolean> => {
		if (!config) return Promise.resolve(false);
		const next = structuredClone(config);
		next.OPENAI_API_BASE_URLS.splice(idx, 1);
		next.OPENAI_API_KEYS.splice(idx, 1);
		next.OPENAI_API_CONFIGS = Object.fromEntries(
			next.OPENAI_API_BASE_URLS.map((_, i) => [
				i,
				config?.OPENAI_API_CONFIGS[i < idx ? i : i + 1] ?? {}
			])
		);
		return updateHandler(next);
	};

	onMount(async () => {
		config = structuredClone(
			$settings?.directConnections ?? {
				OPENAI_API_BASE_URLS: [],
				OPENAI_API_KEYS: [],
				OPENAI_API_CONFIGS: {}
			}
		);
	});
</script>

<AddConnectionModal direct bind:show={showConnectionModal} onSubmit={addConnectionHandler} />

<form
	id="tab-connections"
	class="flex flex-col h-full justify-between text-sm"
	on:submit|preventDefault={() => {
		void updateHandler();
	}}
>
	<h2 class="text-sm font-medium text-gray-900 dark:text-white mb-4">{$i18n.t('Connections')}</h2>

	<div class="flex-1 min-h-0 overflow-y-auto scrollbar-hover pr-1.5">
		{#if config !== null}
			<UserSettingSection title={$i18n.t('Manage Direct Connections')} first>
				<div class="flex items-center justify-between gap-2.5">
					<div class="min-w-0 text-[0.6875rem] text-gray-400 dark:text-gray-600">
						{$i18n.t('Connect to your own OpenAI compatible API endpoints.')}
					</div>

					<Tooltip content={$i18n.t(`Add Connection`)}>
						<button
							class="flex size-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-300"
							aria-label={$i18n.t('Add Connection')}
							on:click={() => {
								showConnectionModal = true;
							}}
							type="button"
						>
							<Plus />
						</button>
					</Tooltip>
				</div>

				<div class="flex flex-col gap-2">
					{#each config?.OPENAI_API_BASE_URLS ?? [] as url, idx}
						<Connection
							bind:url
							bind:key={config.OPENAI_API_KEYS[idx]}
							config={config.OPENAI_API_CONFIGS[idx]}
							onSubmit={(connection) => editConnectionHandler(idx, connection)}
							onDelete={() => deleteConnectionHandler(idx)}
						/>
					{/each}
				</div>

				<div class="text-[0.6875rem] text-gray-400 dark:text-gray-600">
					{$i18n.t(
						'CORS must be properly configured by the provider to allow requests from Airis.'
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
