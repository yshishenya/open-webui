<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { onMount, onDestroy, tick, getContext } from 'svelte';
	import { openDB, deleteDB, type IDBPDatabase } from 'idb';
	import type { i18n as I18n } from 'i18next';
	import type { Readable } from 'svelte/store';
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';

	import { getBackendConfig, getModels, getToolServersData, getVersionUpdates } from '$lib/apis';
	import { getTools } from '$lib/apis/tools';
	import { getSkills } from '$lib/apis/skills';
	import { getSessionUser } from '$lib/apis/auths';
	import { getBanners } from '$lib/apis/configs';
	import { getTerminalServers } from '$lib/apis/terminal';
	import { getUserSettings } from '$lib/apis/users';
	import {
		getLegalRequirements,
		getLegalStatus,
		LegalApiError,
		type LegalStatusResponse
	} from '$lib/apis/legal';
	import { setAppFontFamily, setTextScale } from '$lib/utils/text-scale';

	import { WEBUI_VERSION, WEBUI_API_BASE_URL, WEBUI_BUILD_CHANNEL } from '$lib/constants';
	import { compareVersion } from '$lib/utils';

	import { config, user, settings, models, tools, skills, socket, banners, showSettings, showChangelog, temporaryChatEnabled, toolServers, terminalServers, selectedTerminalId, showSearch, showSidebar, showControls, mobile, chatId, chats } from '$lib/stores';

	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import SettingsModal from '$lib/components/chat/SettingsModal.svelte';
	import ChangelogModal from '$lib/components/ChangelogModal.svelte';
	import AccountPending from '$lib/components/layout/Overlay/AccountPending.svelte';
	import LegalAcceptanceGate from '$lib/components/layout/Overlay/LegalAcceptanceGate.svelte';
	import UpdateInfoToast from '$lib/components/layout/UpdateInfoToast.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import { loadKeybindings, matchKeybinding, Shortcut } from '$lib/shortcuts';
	import { canUseTemporaryChats } from '$lib/utils/settings-access';

	const i18n = getContext<Readable<I18n>>('i18n');

	let loaded = false;
	let appDestroyed = false;
	const bootstrapCleanup: (() => void)[] = [];
	let DB: IDBPDatabase<unknown> | null = null;
	let localDBChats: unknown[] = [];

	onDestroy(() => {
		appDestroyed = true;
		bootstrapCleanup.forEach((cleanup) => cleanup());
		DB?.close();
	});

	let legalStatus: LegalStatusResponse | null = null;
	let legalGateOpen = false;

	type EnabledTerminal = {
		config?: import('$lib/utils/airis/frontend-contracts').TerminalServerConnection['config'];
		enabled?: boolean;
		url?: string;
		auth_type?: string;
		key?: string;
		path?: string;
	};
	type SettingsWithTerminals = { terminalServers?: EnabledTerminal[] };

	let version: { current: string; latest: string | null } | null = null;
	let handledSettingsUrl = '';

	const clearChatInputStorage = () => {
		const chatInputKeys = Object.keys(localStorage).filter((key) => key.startsWith('chat-input'));
		if (chatInputKeys.length > 0) {
			chatInputKeys.forEach((key) => {
				localStorage.removeItem(key);
			});
		}
	};

	const checkLocalDBChats = async () => {
		try {
			// Check if IndexedDB exists
			DB = await openDB('Chats', 1);
			if (appDestroyed) {
				DB.close();
				return;
			}

			if (!DB) {
				return;
			}

			const chats = await DB.getAllFromIndex('chats', 'timestamp');
			if (appDestroyed) return;
			localDBChats = chats.map((item, idx) => chats[chats.length - 1 - idx]);

			if (localDBChats.length === 0) {
				await deleteDB('Chats');
			}
		} catch {
			// IndexedDB Not Found
		}
	};

	const setUserSettings = async (cb?: () => Promise<void>) => {
		const token = localStorage.token;
		const userId = $user?.id;
		const userSettings = await getUserSettings(token);
		if (appDestroyed || localStorage.token !== token || $user?.id !== userId) return;

		if (userSettings?.ui) {
			settings.set(userSettings.ui);
		}
		loadKeybindings(userSettings?.keybindings);

		setTextScale($settings?.textScale ?? 1);
		setAppFontFamily($settings?.fontFamily ?? null);

		if (cb) {
			await cb();
		}
	};

	const setModels = async () => {
		const modelData = await getModels(
			localStorage.token,
			$config?.features?.enable_direct_connections ? ($settings?.directConnections ?? null) : null
		);
		if (!appDestroyed) models.set(modelData);
	};

	const setToolServers = async () => {
		if (!$config?.features?.enable_tool_servers) {
			toolServers.set([]);
			terminalServers.set([]);
			return;
		}
		let toolServersData = await getToolServersData(
			$config?.features?.enable_direct_integrations ? ($settings?.toolServers ?? []) : []
		);
		if (appDestroyed) return;
		toolServersData = toolServersData.filter((data) => {
			if (!data || data.error) {
				toast.error(
					$i18n.t(`Failed to connect to {{URL}} OpenAPI tool server`, {
						URL: data?.url
					})
				);
				return false;
			}
			return true;
		});
		toolServers.set(toolServersData);

		// Inject enabled terminal servers as always-on tool servers
		const terminalSettings = $settings as SettingsWithTerminals | null;
		const enabledTerminals = (
			$config?.features?.enable_direct_integrations ? (terminalSettings?.terminalServers ?? []) : []
		).filter((s) => s.enabled || s.url === $selectedTerminalId);

		// Fetch terminal servers the user has access to (for FileNav + terminal_id)
		const systemTerminals = await getTerminalServers(localStorage.token);
		if (appDestroyed) return;
		const terminalData = [
			...(enabledTerminals.length > 0
				? (
						await getToolServersData(
							enabledTerminals.map((t) => ({
								url: t.url,
								auth_type: t.auth_type ?? 'bearer',
								key: t.key ?? '',
								path: t.path ?? '/openapi.json',
								config: { enable: true }
							}))
						)
					)
						.map((data, i) =>
							data
								? {
										...data,
										key: enabledTerminals[i]?.key ?? '',
										config: enabledTerminals[i]?.config ?? {}
									}
								: null
						)
						.filter((data): data is NonNullable<typeof data> => {
							if (appDestroyed) return false;
							if (!data || data.error) {
								toast.error(
									$i18n.t(`Failed to connect to {{URL}} terminal server`, {
										URL: data?.url
									})
								);
								return false;
							}
							return true;
						})
				: []),
			// Store with proxy URL and session key for FileNav file browsing
			...systemTerminals.map((t) => ({
				id: t.id,
				url: `${WEBUI_API_BASE_URL}/terminals/${t.id}`,
				name: t.name,
				key: localStorage.token,
				contexts: t.contexts ?? {},
				config: t.config ?? {}
			}))
		];
		if (!appDestroyed) terminalServers.set(terminalData);
	};

	const setBanners = async () => {
		const bannersData = await getBanners(localStorage.token);
		if (!appDestroyed) banners.set(bannersData);
	};

	const setTools = async () => {
		const toolsData = await getTools(localStorage.token);
		if (!appDestroyed) tools.set(toolsData);
	};

	const refreshAccess = async () => {
		if (!localStorage.token) return;
		try {
			user.set(await getSessionUser(localStorage.token));
			const results = await Promise.allSettled([
				getBackendConfig().then((value) => config.set(value)),
				setModels(),
				setTools(),
				setToolServers(),
				getSkills(localStorage.token).then((value) => skills.set(value))
			]);
			for (const result of results) {
				if (result.status === 'rejected') console.error('Unable to refresh access', result.reason);
			}
		} catch (error) {
			console.error('Unable to refresh permissions', error);
		}
	};

	onMount(() => {
		const socketInstance = $socket;
		const scheduleAccessRefresh = () => {
			socketInstance?.off('connect', refreshAccess);
			socketInstance?.once('connect', refreshAccess);
		};
		socketInstance?.on('access:updated', scheduleAccessRefresh);
		return () => {
			socketInstance?.off('access:updated', scheduleAccessRefresh);
			socketInstance?.off('connect', refreshAccess);
		};
	});

	const openSettingsFromUrl = async () => {
		const requestedSettings = $page.url.searchParams.get('settings');
		if (!requestedSettings) {
			// Param handled and stripped; allow the same deep link to be
			// handled again later in this session.
			handledSettingsUrl = '';
			return;
		}

		const urlKey = `${$page.url.pathname}${$page.url.search}${$page.url.hash}`;
		if (handledSettingsUrl === urlKey) {
			return;
		}
		handledSettingsUrl = urlKey;

		showSettings.set(
			requestedSettings.startsWith('admin:') && $user?.role !== 'admin'
				? 'general'
				: requestedSettings
		);

		const params = new URLSearchParams($page.url.searchParams);
		params.delete('settings');
		const query = params.toString();
		await goto(`${$page.url.pathname}${query ? `?${query}` : ''}${$page.url.hash}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	};

	const gotoAuth = async () => {
		const currentUrl = `${$page.url.pathname}${$page.url.search}`;
		await goto(`/auth?redirect=${encodeURIComponent(currentUrl)}`);
	};

	const navigateChat = async (direction: -1 | 1) => {
		if (!$chats?.length) return;

		const currentIndex = $chats.findIndex((chat) => chat.id === $chatId);
		const nextChat = currentIndex === -1 ? $chats[0] : $chats[currentIndex + direction];

		if (nextChat) {
			await goto(`/c/${nextChat.id}`);
		}
	};

	const bootstrapApp = async (): Promise<void> => {
		if (appDestroyed) return;
		clearChatInputStorage();
		try {
			await Promise.all([
				checkLocalDBChats(),
				setBanners().catch((e) => console.error('Failed to load banners:', e)),
				setTools().catch((e) => console.error('Failed to load tools:', e)),
				setUserSettings(async () => {
					await setModels().catch((e) => console.error('Failed to load models:', e));
				})
			]);
		} catch (e) {
			console.error('Failed to load user settings:', e);
			toast.error($i18n.t('Failed to load Interface settings'));
			return;
		}
		if (appDestroyed) return;

		selectedTerminalId.set(
			$config?.features?.enable_tool_servers ? (localStorage.selectedTerminalId ?? null) : null
		);

		const loadToolServers = setToolServers().catch((e) => {
			console.error('Failed to load tool servers:', e);
			if (!appDestroyed) terminalServers.set([]);
		});
		if (
			$page.url.searchParams.get('q') &&
			($page.url.searchParams.get('submit') ?? 'true') === 'true'
		) {
			await loadToolServers;
		}
		if (appDestroyed) return;

		const setupKeyboardShortcuts = () => {
			const handleKeyDown = async (event: KeyboardEvent): Promise<void> => {
				if ($settings?.keyboardShortcuts === false) {
					return;
				}

				const shortcut = matchKeybinding(event);
				if (shortcut === Shortcut.SEARCH) {
					console.log('Shortcut triggered: SEARCH');
					event.preventDefault();
					showSearch.set(!$showSearch);
				} else if (shortcut === Shortcut.NEW_CHAT) {
					console.log('Shortcut triggered: NEW_CHAT');
					event.preventDefault();
					document.getElementById('sidebar-new-chat-button')?.click();
				} else if (shortcut === Shortcut.FOCUS_INPUT) {
					console.log('Shortcut triggered: FOCUS_INPUT');
					event.preventDefault();
					document.getElementById('chat-input')?.focus();
				} else if (shortcut === Shortcut.COPY_LAST_CODE_BLOCK) {
					console.log('Shortcut triggered: COPY_LAST_CODE_BLOCK');
					event.preventDefault();
					([...document.getElementsByClassName('copy-code-button')] as HTMLElement[])
						?.at(-1)
						?.click();
				} else if (shortcut === Shortcut.COPY_LAST_RESPONSE) {
					console.log('Shortcut triggered: COPY_LAST_RESPONSE');
					event.preventDefault();
					([...document.getElementsByClassName('copy-response-button')] as HTMLElement[])
						?.at(-1)
						?.click();
				} else if (shortcut === Shortcut.TOGGLE_SIDEBAR) {
					console.log('Shortcut triggered: TOGGLE_SIDEBAR');
					event.preventDefault();
					showSidebar.set(!$showSidebar);
				} else if (shortcut === Shortcut.NAVIGATE_CHAT_UP) {
					console.log('Shortcut triggered: NAVIGATE_CHAT_UP');
					event.preventDefault();
					await navigateChat(-1);
				} else if (shortcut === Shortcut.NAVIGATE_CHAT_DOWN) {
					console.log('Shortcut triggered: NAVIGATE_CHAT_DOWN');
					event.preventDefault();
					await navigateChat(1);
				} else if (shortcut === Shortcut.TOGGLE_CONTROLS) {
					console.log('Shortcut triggered: TOGGLE_CONTROLS');
					event.preventDefault();
					showControls.set(!$showControls);
				} else if (shortcut === Shortcut.DELETE_CHAT) {
					console.log('Shortcut triggered: DELETE_CHAT');
					event.preventDefault();
					document.getElementById('delete-chat-button')?.click();
				} else if (shortcut === Shortcut.OPEN_SETTINGS) {
					console.log('Shortcut triggered: OPEN_SETTINGS');
					event.preventDefault();
					showSettings.set(!$showSettings);
				} else if (shortcut === Shortcut.SHOW_SHORTCUTS) {
					console.log('Shortcut triggered: SHOW_SHORTCUTS');
					event.preventDefault();
					showSettings.set('shortcuts');
				} else if (shortcut === Shortcut.OPEN_MODEL_SELECTOR) {
					console.log('Shortcut triggered: OPEN_MODEL_SELECTOR');
					event.preventDefault();
					document.getElementById('model-selector-model-button')?.click();
				} else if (shortcut === Shortcut.NEW_TEMPORARY_CHAT) {
					console.log('Shortcut triggered: NEW_TEMPORARY_CHAT');
					event.preventDefault();
					if (!canUseTemporaryChats({ user: $user, config: null })) {
						return;
					}
					if ($user?.role !== 'admin' && $user?.permissions?.chat?.temporary_enforced) {
						temporaryChatEnabled.set(true);
					} else {
						temporaryChatEnabled.set(!$temporaryChatEnabled);
					}
					await goto('/');
					setTimeout(() => {
						document.getElementById('new-chat-button')?.click();
					}, 0);
				} else if (shortcut === Shortcut.GENERATE_MESSAGE_PAIR) {
					console.log('Shortcut triggered: GENERATE_MESSAGE_PAIR');
					event.preventDefault();
					document.getElementById('generate-message-pair-button')?.click();
				} else if (shortcut === Shortcut.ALLOW_TOOL_CALL) {
					const button = [...document.getElementsByClassName('tool-call-allow-button')]
						.reverse()
						.find((el) => !(el as HTMLButtonElement).disabled) as HTMLButtonElement | undefined;
					if (button) {
						console.log('Shortcut triggered: ALLOW_TOOL_CALL');
						event.preventDefault();
						button.click();
					}
				} else if (shortcut === Shortcut.DENY_TOOL_CALL) {
					const button = [...document.getElementsByClassName('tool-call-deny-button')]
						.reverse()
						.find((el) => !(el as HTMLButtonElement).disabled) as HTMLButtonElement | undefined;
					if (button) {
						console.log('Shortcut triggered: DENY_TOOL_CALL');
						event.preventDefault();
						button.click();
					}
				} else if (
					shortcut === Shortcut.REGENERATE_RESPONSE &&
					document.activeElement?.id === 'chat-input'
				) {
					console.log('Shortcut triggered: REGENERATE_RESPONSE');
					event.preventDefault();
					([...document.getElementsByClassName('regenerate-response-button')] as HTMLElement[])
						?.at(-1)
						?.click();
				}
			};
			document.addEventListener('keydown', handleKeyDown);
			bootstrapCleanup.push(() => document.removeEventListener('keydown', handleKeyDown));
		};
		setupKeyboardShortcuts();

		if ($user?.role === 'admin' && ($settings?.showChangelog ?? true)) {
			showChangelog.set($settings?.version !== $config?.version);
		}

		if ($user?.role === 'admin' || ($user?.permissions?.chat?.temporary ?? true)) {
			if ($page.url.searchParams.get('temporary-chat') === 'true') {
				temporaryChatEnabled.set(true);
			}

			if ($user?.role !== 'admin' && $user?.permissions?.chat?.temporary_enforced) {
				temporaryChatEnabled.set(true);
			}
		}

		// Check for version updates
		if (
			WEBUI_BUILD_CHANNEL === 'main' &&
			$user?.role === 'admin' &&
			$config?.features?.enable_version_update_check
		) {
			// Check if the user has dismissed the update toast in the last 24 hours
			if (localStorage.dismissedUpdateToast) {
				const dismissedUpdateToast = new Date(Number(localStorage.dismissedUpdateToast));
				const now = new Date();

				if (now.getTime() - dismissedUpdateToast.getTime() > 24 * 60 * 60 * 1000) {
					checkForVersionUpdates();
				}
			} else {
				checkForVersionUpdates();
			}
		}
		// Persist showControls: track open/close state separately from saved size
		// chatControlsSize always retains the last width for openPane()
		showControls.set(!$mobile ? localStorage.showControls === 'true' : false);
		bootstrapCleanup.push(
			showControls.subscribe((value) => {
				localStorage.showControls = value ? 'true' : 'false';
			})
		);

		// Persist selectedTerminalId across page loads
		bootstrapCleanup.push(
			selectedTerminalId.subscribe((value) => {
				if (!$config?.features?.enable_tool_servers) return;
				if (value === null) {
					delete localStorage.selectedTerminalId;
				} else {
					localStorage.selectedTerminalId = value;
				}
			})
		);

		await tick();

		if (!appDestroyed) loaded = true;
	};

	const handleLegalAccepted = async (
		event: CustomEvent<{ status: LegalStatusResponse }>
	): Promise<void> => {
		if (appDestroyed) return;
		legalStatus = event.detail.status;
		legalGateOpen = false;
		if (!loaded) {
			await bootstrapApp();
		}
	};

	onMount(async () => {
		if ($user === undefined || $user === null) {
			await gotoAuth();
			return;
		}
		if (!['user', 'admin'].includes($user?.role)) {
			return;
		}

		try {
			const status = await getLegalStatus(localStorage.token);
			if (appDestroyed) return;
			legalStatus = status;
			if (legalStatus?.needs_accept) {
				legalGateOpen = true;
				return;
			}
		} catch (error) {
			if (appDestroyed) return;
			console.error(error);

			if (error instanceof LegalApiError && error.status === 401) {
				localStorage.removeItem('token');
				await user.set(null);
				const redirectPath = `${$page.url.pathname}${$page.url.search}`;
				await goto(`/auth?redirect=${encodeURIComponent(redirectPath)}`);
				return;
			}

			// Fail closed: if status cannot be loaded, still show required documents.
			try {
				const requirements = await getLegalRequirements();
				if (appDestroyed) return;
				legalStatus = {
					docs: requirements.docs.map((doc) => ({
						...doc,
						accepted_at: null,
						accepted_version: null
					})),
					needs_accept: true,
					server_time: requirements.server_time
				};
				legalGateOpen = true;
				return;
			} catch (requirementsError) {
				if (appDestroyed) return;
				console.error(requirementsError);
				toast.error('Не удалось загрузить юридические документы. Попробуйте обновить страницу.');
				legalStatus = {
					docs: [],
					needs_accept: true,
					server_time: Math.floor(Date.now() / 1000)
				};
				legalGateOpen = true;
				return;
			}
		}

		await bootstrapApp();
	});

	// `$page.url` must be referenced here: `$:` only tracks variables used in
	// the statement itself, and reads inside openSettingsFromUrl don't count —
	// without it, client-side navigations to `?settings=...` are never handled.
	$: if (loaded && $page.url) {
		void openSettingsFromUrl();
	}

	$: if (loaded && ($user === undefined || $user === null)) {
		void gotoAuth();
	}

	const checkForVersionUpdates = async () => {
		version = await getVersionUpdates(localStorage.token).catch(() => {
			return {
				current: WEBUI_VERSION,
				latest: null
			};
		});
	};
</script>

<SettingsModal bind:show={$showSettings} />
<ChangelogModal bind:show={$showChangelog} />

{#if WEBUI_BUILD_CHANNEL === 'main' && version?.latest && compareVersion(version.latest, version.current) && ($settings?.showUpdateToast ?? true)}
	<div class=" absolute bottom-8 right-8 z-50" in:fade={{ duration: 100 }}>
		<UpdateInfoToast
			version={{ current: version.current, latest: version.latest }}
			on:close={() => {
				localStorage.setItem('dismissedUpdateToast', Date.now().toString());
				version = null;
			}}
		/>
	</div>
{/if}

{#if $user}
	<div class="app relative">
		<div
			class=" text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-900 h-screen max-h-[100dvh] overflow-auto flex flex-row justify-end"
		>
			{#if !['user', 'admin'].includes($user?.role)}
				<AccountPending />
			{:else}
				{#if localDBChats.length > 0}
					<div class="fixed w-full h-full flex z-50">
						<div
							class="absolute w-full h-full backdrop-blur-md bg-white/20 dark:bg-gray-900/50 flex justify-center"
						>
							<div class="m-auto pb-44 flex flex-col justify-center">
								<div class="max-w-md">
									<div class="text-center dark:text-white text-2xl font-normal z-50">
										{$i18n.t('Important Update')}<br />
										{$i18n.t('Action Required for Chat Log Storage')}
									</div>

									<div class=" mt-4 text-center text-sm dark:text-gray-200 w-full">
										{$i18n.t(
											"Saving chat logs directly to your browser's storage is no longer supported. Please take a moment to download and delete your chat logs by clicking the button below. Don't worry, you can easily re-import your chat logs to the backend through"
										)}
										<span class="font-normal dark:text-white"
											>{$i18n.t('Settings')} > {$i18n.t('Chats')} > {$i18n.t('Import Chats')}</span
										>. {$i18n.t(
											'This ensures that your valuable conversations are securely saved to your backend database. Thank you!'
										)}
									</div>

									<div class=" mt-6 mx-auto relative group w-fit">
										<button
											class="relative z-20 flex px-5 py-2 rounded-full bg-white border border-gray-100 dark:border-none hover:bg-gray-100 transition font-normal text-sm"
											on:click={async () => {
												let blob = new Blob([JSON.stringify(localDBChats)], {
													type: 'application/json'
												});
												saveAs(blob, `chat-export-${Date.now()}.json`);

												const tx = DB!.transaction('chats', 'readwrite');
												await Promise.all([tx.store.clear(), tx.done]);
												await deleteDB('Chats');

												localDBChats = [];
											}}
										>
											{$i18n.t('Download & Delete')}
										</button>

										<button
											class="text-xs text-center w-full mt-2 text-gray-400 underline"
											on:click={async () => {
												localDBChats = [];
											}}>{$i18n.t('Close')}</button
										>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}

				{#if legalGateOpen && legalStatus?.needs_accept}
					<LegalAcceptanceGate
						token={localStorage.token}
						status={legalStatus}
						acceptMethod="ui_gate"
						on:accepted={handleLegalAccepted}
					/>
				{:else}
					<Sidebar />

					{#if loaded}
						<main id="main-content" class="contents">
							<slot />
						</main>
					{:else}
						<div
							class="w-full flex-1 h-full flex items-center justify-center {$showSidebar
								? '  md:max-w-[calc(100%-var(--sidebar-width))]'
								: ' '}"
						>
							<Spinner className="size-5" />
						</div>
					{/if}
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	:global(.loading) {
		display: inline-block;
		clip-path: inset(0 1ch 0 0);
		animation: l 1s steps(3) infinite;
		letter-spacing: -0.5px;
	}

	@keyframes l {
		to {
			clip-path: inset(0 -1ch 0 0);
		}
	}

	:global(pre[class*='language-']) {
		position: relative;
		overflow: auto;

		/* make space  */
		margin: 0.3125rem 0;
		padding: 1.75rem 0 1.75rem 1rem;
		border-radius: 0.625rem;
	}

	:global(pre[class*='language-'] button) {
		position: absolute;
		top: 0.3125rem;
		right: 0.3125rem;

		font-size: 0.9rem;
		padding: 0.15rem;
		background-color: #828282;

		border: ridge 1px #7b7b7c;
		border-radius: 0.3125rem;
		text-shadow: #c4c4c4 0 0 2px;
	}

	:global(pre[class*='language-'] button:hover) {
		cursor: pointer;
		background-color: #bcbabb;
	}
</style>
