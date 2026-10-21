<script lang="ts">
	import { getContext } from 'svelte';

	import { settings, showSettings, terminalServers, selectedTerminalId, user } from '$lib/stores';
	import { getToolServersData } from '$lib/apis';

	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Cloud from '$lib/components/icons/Cloud.svelte';
	import ChatBubble from '$lib/components/icons/ChatBubble.svelte';
	import Check from '$lib/components/icons/Check.svelte';
	import ChevronDown from '$lib/components/icons/ChevronDown.svelte';

	const i18n = getContext('i18n');

	export let show = false;

	$: systemTerminals = ($terminalServers ?? []).filter((t) => t.id);
	$: directTerminals = ($settings?.terminalServers ?? []).filter((s) => s.url);

	const refreshTerminalServersStore = async (servers: typeof directTerminals) => {
		// Preserve system terminals (those with an `id`) — only refresh direct ones
		const existingSystemTerminals = ($terminalServers ?? []).filter((t) => t.id);

		const activeTerminals = servers.filter((s) => s.enabled);
		if (activeTerminals.length > 0) {
			let data = await getToolServersData(
				activeTerminals.map((t) => ({
					url: t.url,
					auth_type: t.auth_type ?? 'bearer',
					key: t.key ?? '',
					path: t.path ?? '/openapi.json',
					config: { enable: true }
				}))
			);
			data = data.filter((d) => d && !d.error);
			terminalServers.set([...data, ...existingSystemTerminals]);
		} else {
			terminalServers.set(existingSystemTerminals);
		}
	};

	const selectDirect = async (terminal: (typeof directTerminals)[0]) => {
		const newId = $selectedTerminalId === terminal.url ? null : terminal.url;
		selectedTerminalId.set(newId);

		// Enable the selected direct terminal, disable all others
		const updatedServers = ($settings?.terminalServers ?? []).map((s) => ({
			...s,
			enabled: newId !== null && s.url === terminal.url
		}));

		settings.set({
			...$settings,
			terminalServers: updatedServers
		});

		show = false;

		// Refresh the store so Chat.svelte can inject it as a tool
		await refreshTerminalServersStore(updatedServers);
	};

	const selectSystem = async (terminal: (typeof systemTerminals)[0] | null): Promise<void> => {
		if (terminal && !terminal.id) return;
		selectedTerminalId.set(terminal?.id ?? null);

		// Disable all direct terminals when switching to a system terminal
		if ($settings?.terminalServers?.some((s) => s.enabled)) {
			const updatedServers = ($settings.terminalServers ?? []).map((s) => ({
				...s,
				enabled: false
			}));
			settings.set({
				...$settings,
				terminalServers: updatedServers
			});
			await refreshTerminalServersStore(updatedServers);
		}

		show = false;
	};

	$: selectedSystemTerminal = systemTerminals.find((t) => t.id === $selectedTerminalId);
	$: selectedDirectTerminal = directTerminals.find((t) => t.url === $selectedTerminalId);

	$: selectedLabel =
		selectedSystemTerminal?.name ||
		selectedSystemTerminal?.id ||
		selectedDirectTerminal?.name ||
		selectedDirectTerminal?.url?.replace(/^https?:\/\//, '') ||
		$i18n.t('Terminal');
</script>

<div class="flex items-center translate-x-0.5">
	<Dropdown bind:show align="start">
		<Tooltip content={$i18n.t('Choose mode')} placement="top">
			<button
				type="button"
				data-testid="chat-work-mode"
				aria-label={$i18n.t($selectedTerminalId ? 'Work' : 'Chat')}
				class="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 transition rounded-full border border-gray-200 dark:border-gray-700 cursor-pointer"
			>
				{#if $selectedTerminalId}
					<Cloud className="size-3.5" strokeWidth="2" />
				{:else}
					<ChatBubble className="size-3.5" />
				{/if}
				<span class="truncate text-[13px] max-w-[100px] sm:max-w-[150px]"
					>{$selectedTerminalId ? selectedLabel : $i18n.t('Chat')}</span
				>
				<ChevronDown className="size-3.5 text-gray-400" />
			</button>
		</Tooltip>

		<div slot="content">
			<div
				class="w-72 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto overflow-x-hidden scrollbar-thin rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 text-gray-900 dark:text-gray-100 p-1.5 shadow-lg"
			>
				<button
					type="button"
					data-testid="chat-mode"
					aria-pressed={!$selectedTerminalId}
					class="flex w-full justify-between gap-3 items-center p-3 text-start text-sm rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
					on:click={() => selectSystem(null)}
				>
					<div class="flex flex-1 gap-3 items-center">
						<ChatBubble className="size-4 shrink-0" />
						<div>
							<div class="font-medium">{$i18n.t('Chat')}</div>
							<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{$i18n.t('Answers, ideas and discussion')}
							</div>
						</div>
					</div>
					{#if !$selectedTerminalId}
						<Check className="size-4 shrink-0" />
					{/if}
				</button>
				<!-- Direct terminals (gated by permission) -->
				{#if directTerminals.length > 0 && ($user?.role === 'admin' || ($user?.permissions?.features?.direct_tool_servers ?? true))}
					<div class="flex items-center justify-between px-3 py-1">
						<span
							class="text-[10px] font-normal text-gray-400 dark:text-gray-500 uppercase tracking-wider"
						>
							{$i18n.t('Direct')}
						</span>
						<Tooltip content={$i18n.t('Add Terminal')} placement="top">
							<button
								type="button"
								aria-label={$i18n.t('Add Terminal')}
								class="p-0.5 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
								on:click|stopPropagation={() => {
									show = false;
									showSettings.set('tools');
								}}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 20 20"
									fill="currentColor"
									class="size-3.5"
								>
									<path
										d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"
									/>
								</svg>
							</button>
						</Tooltip>
					</div>

					{#each directTerminals as terminal}
						<button
							type="button"
							class="flex w-full justify-between gap-2 items-center h-[1.6875rem] px-2 text-[13px] font-normal cursor-pointer rounded-xl {$selectedTerminalId ===
							terminal.url
								? 'bg-gray-50/40 dark:bg-gray-800/40'
								: 'hover:bg-gray-50/40 dark:hover:bg-gray-800/40'}"
							on:click={() => selectDirect(terminal)}
						>
							<div class="flex flex-1 gap-2 items-center truncate">
								<Cloud className="size-3.5 shrink-0" strokeWidth="2" />
								<span class="truncate"
									>{terminal.name || terminal.url.replace(/^https?:\/\//, '')}</span
								>
							</div>
							{#if $selectedTerminalId === terminal.url}
								<div class="shrink-0 text-emerald-600 dark:text-emerald-400">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 20 20"
										fill="currentColor"
										class="size-3.5"
									>
										<path
											fill-rule="evenodd"
											d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
							{/if}
						</button>
					{/each}
				{/if}

				<!-- System terminals -->
				{#if systemTerminals.length > 0}
					{#if systemTerminals.length > 1 || directTerminals.length > 0}
						<div class="flex items-center justify-between px-3 py-1">
							<span
								class="text-[10px] font-normal text-gray-400 dark:text-gray-500 uppercase tracking-wider"
							>
								{$i18n.t('System')}
							</span>
							{#if $user?.role === 'admin'}
								<Tooltip content={$i18n.t('Add Terminal')} placement="top">
									<button
										type="button"
										aria-label={$i18n.t('Add Terminal')}
										class="p-0.5 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
										on:click|stopPropagation={() => {
											show = false;
											showSettings.set('admin:integrations');
										}}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="size-3.5"
										>
											<path
												d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"
											/>
										</svg>
									</button>
								</Tooltip>
							{/if}
						</div>
					{/if}

					{#each systemTerminals as terminal}
						<button
							type="button"
							aria-pressed={$selectedTerminalId === terminal.id}
							class="flex w-full justify-between gap-3 items-center p-3 text-start text-sm cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
							on:click={() => selectSystem(terminal)}
						>
							<div class="flex flex-1 gap-3 items-center min-w-0">
								<Cloud className="size-4 shrink-0" strokeWidth="2" />
								<div class="min-w-0">
									<div class="truncate font-medium">{terminal.name || $i18n.t('Work')}</div>
									<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
										{$i18n.t('Complete tasks and create files')}
									</div>
								</div>
							</div>
							{#if $selectedTerminalId === terminal.id}
								<Check className="size-4 shrink-0" />
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</Dropdown>
</div>
