<script>
	import { io } from 'socket.io-client';
	import { spring } from 'svelte/motion';
	import { createPyodideWorker } from '$lib/pyodide/createPyodideWorker';
	import { Toaster, toast } from 'svelte-sonner';

	let loadingProgress = spring(0, {
		stiffness: 0.05
	});

	import { onMount, tick, setContext, onDestroy } from 'svelte';
	import {
		config,
		user,
		settings,
		theme,
		WEBUI_NAME,
		WEBUI_VERSION,
		WEBUI_DEPLOYMENT_ID,
		appData,
		mobile,
		models,
		socket,
		socketConnected,
		chatId,
		tags,
		temporaryChatEnabled,
		isLastActiveTab,
		isApp,
		appInfo,
		toolServers,
		playingNotificationSound,
		channels,
		channelId,
		terminalServers,
		showControls,
		showFileNavPath,
		showFileNavDir,
		pyodideWorker,
		desktopEvent
	} from '$lib/stores';
	import { refreshChatList } from '$lib/stores/chatList';
	import { getFileContentById } from '$lib/apis/files';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { beforeNavigate } from '$app/navigation';
	import { updated } from '$app/state';

	import i18n, { initI18n, getLanguages, changeLanguage } from '$lib/i18n';

	import '../tailwind.css';
	import '../app.css';
	import 'tippy.js/dist/tippy.css';

	import { executeToolServer, getBackendConfig, getModels, getVersion } from '$lib/apis';
	import { getSessionUser, updateUserTimezone, userSignOut } from '$lib/apis/auths';
	import { getAllTags } from '$lib/apis/chats';
	import { chatCompletion } from '$lib/apis/openai';
	import { isTemporaryChatId } from '$lib/utils/chatId';
	import {
		addOpenAIConnection,
		removeOpenAIConnection,
		addTerminalConnection,
		removeTerminalConnection
	} from '$lib/utils/connections';

	import { WEBUI_API_BASE_URL, WEBUI_BASE_URL } from '$lib/constants';
	import {
		bestMatchingLanguage,
		cleanText,
		displayFileHandler,
		getUserTimezone,
		removeAllDetails,
		splitStream
	} from '$lib/utils';
	import { isPublicMarketingRoute } from '$lib/utils/airis/public_routes';

	import NotificationToast from '$lib/components/NotificationToast.svelte';
	import AnalyticsBootstrap from '$lib/components/analytics/AnalyticsBootstrap.svelte';
	import AnalyticsConsent from '$lib/components/analytics/AnalyticsConsent.svelte';
	import AppSidebar from '$lib/components/app/AppSidebar.svelte';
	import SyncStatsModal from '$lib/components/chat/Settings/SyncStatsModal.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import { getOutputText } from '$lib/components/chat/Messages/structuredOutput';
	import dayjs from 'dayjs';
	import { getChannels } from '$lib/apis/channels';

	const unregisterServiceWorkers = async () => {
		if ('serviceWorker' in navigator) {
			try {
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(registrations.map((r) => r.unregister()));
				return true;
			} catch (error) {
				console.error('Error unregistering service workers:', error);
				return false;
			}
		}
		return false;
	};

	// handle frontend updates (https://svelte.dev/docs/kit/configuration#version)
	beforeNavigate(async ({ from, willUnload, to }) => {
		if (
			!willUnload &&
			from?.url &&
			to?.url &&
			isPublicMarketingRoute(from.url.pathname) &&
			!isPublicMarketingRoute(to.url.pathname)
		) {
			location.href = to.url.href;
			return;
		}

		if (updated.current && !willUnload && to?.url) {
			await unregisterServiceWorkers();
			location.href = to.url.href;
		}
	});

	setContext('i18n', i18n);

	let bc = null;

	let loaded = isPublicMarketingRoute($page.url.pathname);
	let tokenTimer = null;
	let isAuthRedirectInProgress = false;

	let showRefresh = false;

	let showSyncStatsModal = false;
	let syncStatsEventData = null;

	let heartbeatInterval = null;
	let disconnectToastTimer = null;
	let disconnectWarningShown = false;
	let pageIsVisible = true;
	let pageWasHidden = false;
	let lastVisibleAt = Date.now();
	let disconnectReason = null;

	const BREAKPOINT = 768;
	const DISCONNECT_TOAST_DELAY_MS = 2000;
	const RECENT_RESUME_GRACE_MS = 8000;
	const RESUME_DISCONNECT_REASONS = new Set(['ping timeout', 'transport close', 'transport error']);

	const clearDisconnectToastTimer = () => {
		if (disconnectToastTimer) {
			clearTimeout(disconnectToastTimer);
			disconnectToastTimer = null;
		}
	};

	const recentlyResumed = () =>
		pageWasHidden && Date.now() - lastVisibleAt < RECENT_RESUME_GRACE_MS;

	const isLikelyResumeDisconnect = (reason) => {
		return (!pageIsVisible || recentlyResumed()) && RESUME_DISCONNECT_REASONS.has(reason);
	};

	const scheduleDisconnectToast = () => {
		clearDisconnectToastTimer();

		const resumeDelay = isLikelyResumeDisconnect(disconnectReason)
			? Math.max(RECENT_RESUME_GRACE_MS - (Date.now() - lastVisibleAt), 0)
			: 0;

		disconnectToastTimer = setTimeout(() => {
			disconnectToastTimer = null;

			if ($socket?.connected || !pageIsVisible || isLikelyResumeDisconnect(disconnectReason)) {
				return;
			}

			disconnectWarningShown = true;
			toast.warning($i18n.t('Connection lost. Reconnecting...'));
		}, resumeDelay + DISCONNECT_TOAST_DELAY_MS);
	};

	const setupSocket = async (enableWebsocket) => {
		const _socket = io(`${WEBUI_BASE_URL}` || undefined, {
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			randomizationFactor: 0.5,
			path: '/ws/socket.io',
			transports: enableWebsocket ? ['websocket'] : ['polling', 'websocket'],
			auth: { token: localStorage.token }
		});
		await socket.set(_socket);

		_socket.on('connect_error', (err) => {
			console.log('connect_error', err);
		});

		let hasConnectedOnce = false;

		_socket.on('connect', async () => {
			console.log('connected', _socket.id);

			// Cancel any pending disconnect toast if we reconnected quickly
			clearDisconnectToastTimer();

			if (hasConnectedOnce) {
				socketConnected.set(true);
				// Only show "Reconnected" if the user actually saw the disconnect warning
				if (disconnectWarningShown) {
					toast.success($i18n.t('Reconnected'));
				}
			}
			disconnectWarningShown = false;
			disconnectReason = null;
			hasConnectedOnce = true;

			const res = await getVersion(localStorage.token);

			const deploymentId = res?.deployment_id ?? null;
			const version = res?.version ?? null;

			if (version !== null || deploymentId !== null) {
				if (
					($WEBUI_VERSION !== null && version !== $WEBUI_VERSION) ||
					($WEBUI_DEPLOYMENT_ID !== null && deploymentId !== $WEBUI_DEPLOYMENT_ID)
				) {
					await unregisterServiceWorkers();
					location.href = location.href;
					return;
				}
			}

			// Send heartbeat every 30 seconds
			heartbeatInterval = setInterval(() => {
				if (_socket.connected) {
					console.log('Sending heartbeat');
					_socket.emit('heartbeat', {});
				}
			}, 30000);

			if (deploymentId !== null) {
				WEBUI_DEPLOYMENT_ID.set(deploymentId);
			}

			if (version !== null) {
				WEBUI_VERSION.set(version);
				window.WEBUI_VERSION = version;
			}

			console.log('version', version);

			if (localStorage.getItem('token')) {
				// Emit user-join event with auth token
				_socket.emit('user-join', { auth: { token: localStorage.token } });
			} else {
				console.warn('No token found in localStorage, user-join event not emitted');
			}
		});

		_socket.on('reconnect_attempt', (attempt) => {
			console.log('reconnect_attempt', attempt);
		});

		_socket.on('reconnect_failed', () => {
			console.log('reconnect_failed');
		});

		_socket.on('disconnect', (reason, details) => {
			console.log(`Socket ${_socket.id} disconnected due to ${reason}`);
			socketConnected.set(false);
			disconnectReason = reason;
			disconnectWarningShown = false;

			// Delay visible warnings while mobile browsers resume suspended tabs.
			if (isLikelyResumeDisconnect(reason)) {
				clearDisconnectToastTimer();
			} else {
				scheduleDisconnectToast();
			}

			if (heartbeatInterval) {
				clearInterval(heartbeatInterval);
				heartbeatInterval = null;
			}

			if (details) {
				console.log('Additional details:', details);
			}
		});
	};

	/**
	 * Get or create the persistent Pyodide worker.
	 * The worker persists across executions so the virtual FS (IDBFS) is preserved.
	 */
	const getOrCreateWorker = () => {
		let worker = $pyodideWorker;
		if (!worker) {
			worker = createPyodideWorker();
			pyodideWorker.set(worker);
		}
		return worker;
	};

	/**
	 * @param {string} id
	 * @param {string} code
	 * @param {((output: {stdout: unknown, stderr: unknown, result: unknown}) => void) | undefined} cb
	 * @param {{id?: string, filename?: string, name?: string}[]} files
	 * @returns {Promise<void>}
	 */
	const executePythonAsWorker = async (id, code, cb, files = []) => {
		let settled = false;
		let submitted = false;
		/** @type {Worker | null} */
		let worker = null;
		const controller = new AbortController();
		/** @param {{stdout: unknown, stderr: unknown, result: unknown}} output
		 * @returns {void} */
		const finish = (output) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeoutId);
			controller.abort();
			worker?.removeEventListener('message', onMessage);
			worker?.removeEventListener('error', onError);
			let response;
			try {
				response = JSON.parse(
					JSON.stringify(output, (_key, value) =>
						typeof value === 'bigint' ? value.toString() : value
					)
				);
			} catch {
				response = { stdout: null, stderr: 'Invalid Python worker response.', result: null };
			}
			try {
				cb?.(response);
			} catch {
				console.warn('Failed to deliver Python execution response.');
			}
		};
		/** @returns {void} */
		const stopWorker = () => {
			if (!worker) return;
			if ($pyodideWorker === worker) pyodideWorker.set(null);
			worker.terminate();
		};
		/** @param {MessageEvent<unknown>} event
		 * @returns {void} */
		const onMessage = (event) => {
			if (settled || !submitted || !event.data || typeof event.data !== 'object') return;
			const data = /** @type {Record<string, unknown>} */ (event.data);
			if (data.id !== id || (typeof data.type === 'string' && data.type.startsWith('fs:'))) return;
			if (!['stdout', 'stderr', 'result', 'error'].some((key) => key in data)) {
				finish({ stdout: null, stderr: 'Invalid Python worker response.', result: null });
				return;
			}
			finish({
				stdout: data.stdout ?? null,
				stderr: data.stderr ?? data.error ?? null,
				result: data.result ?? null
			});
		};
		/** @returns {void} */
		const onError = () => {
			if (settled) return;
			finish({ stdout: null, stderr: 'Python worker failed.', result: null });
			stopWorker();
		};
		const timeoutId = setTimeout(() => {
			if (settled) return;
			finish({ stdout: null, stderr: 'Execution Time Limit Exceeded', result: null });
			// Preparation has not used the shared runtime yet.
			if (submitted) stopWorker();
		}, 60000);

		const packages = [
			/\bimport\s+requests\b|\bfrom\s+requests\b/.test(code) ? 'requests' : null,
			/\bimport\s+bs4\b|\bfrom\s+bs4\b/.test(code) ? 'beautifulsoup4' : null,
			/\bimport\s+numpy\b|\bfrom\s+numpy\b/.test(code) ? 'numpy' : null,
			/\bimport\s+pandas\b|\bfrom\s+pandas\b/.test(code) ? 'pandas' : null,
			/\bimport\s+matplotlib\b|\bfrom\s+matplotlib\b/.test(code) ? 'matplotlib' : null,
			/\bimport\s+seaborn\b|\bfrom\s+seaborn\b/.test(code) ? 'seaborn' : null,
			/\bimport\s+sklearn\b|\bfrom\s+sklearn\b/.test(code) ? 'scikit-learn' : null,
			/\bimport\s+scipy\b|\bfrom\s+scipy\b/.test(code) ? 'scipy' : null,
			/\bimport\s+re\b|\bfrom\s+re\b/.test(code) ? 'regex' : null,
			/\bimport\s+seaborn\b|\bfrom\s+seaborn\b/.test(code) ? 'seaborn' : null,
			/\bimport\s+sympy\b|\bfrom\s+sympy\b/.test(code) ? 'sympy' : null,
			/\bimport\s+tiktoken\b|\bfrom\s+tiktoken\b/.test(code) ? 'tiktoken' : null,
			/\bimport\s+pytz\b|\bfrom\s+pytz\b/.test(code) ? 'pytz' : null
		].filter(Boolean);
		try {
			worker = getOrCreateWorker();
			worker.addEventListener('message', onMessage);
			worker.addEventListener('error', onError);
			/** @type {{name: string, data: ArrayBuffer}[]} */
			const filePayloads = [];
			for (const file of files) {
				if (!file?.id) throw new Error('Selected file unavailable.');
				const content = await getFileContentById(file.id, controller.signal);
				if (settled) return;
				filePayloads.push({ name: file.filename || file.name || 'file', data: content });
			}
			submitted = true;
			worker.postMessage({
				type: 'execute',
				id,
				code,
				packages,
				files: filePayloads.length ? filePayloads : undefined
			});
		} catch {
			finish({
				stdout: null,
				stderr: 'Failed to prepare or start Python execution.',
				result: null
			});
		}
	};

	/** @param {string | undefined} serverUrl */
	const resolveToolServer = (serverUrl) => {
		let toolServer = $settings?.toolServers?.find((server) => server.url === serverUrl);
		if (!toolServer) {
			const terminalServer = ($settings?.terminalServers ?? []).find(
				(server) => server.url === serverUrl
			);
			if (terminalServer) {
				toolServer = {
					url: terminalServer.url,
					auth_type: terminalServer.auth_type ?? 'bearer',
					key: terminalServer.key ?? '',
					path: terminalServer.path ?? '/openapi.json'
				};
			}
		}

		let toolServerData =
			$toolServers?.find((server) => server.url === serverUrl) ??
			$terminalServers?.find((server) => server.url === serverUrl);

		let token = null;
		if (toolServer) {
			const auth_type = toolServer?.auth_type ?? 'bearer';
			if (auth_type === 'bearer') token = toolServer?.key;
			else if (auth_type === 'session') token = localStorage.token;
		}

		return { toolServer, toolServerData, token };
	};

	/**
	 * @param {{name: string, params: Record<string, unknown>, server?: {url?: string}}} data
	 * @param {((result: unknown) => void) | undefined} cb
	 * @param {string} chatId
	 */
	const executeTool = async (data, cb, chatId) => {
		let result = [{ error: 'Tool execution failed.' }, null];
		try {
			const { toolServer, toolServerData, token } = resolveToolServer(data.server?.url);
			if (toolServer) {
				const res = await executeToolServer(
					token,
					toolServer.url,
					data.name,
					data.params,
					toolServerData,
					chatId,
					toolServer.headers
				);
				result = res;
				try {
					const value = res[0];
					const fields = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
					if (!fields.error && res[1] !== null && typeof data.params?.path === 'string') {
						if (data.name === 'display_file' && fields.exists !== false)
							displayFileHandler(data.params.path, { showControls, showFileNavPath });
						if (data.name === 'write_file')
							showFileNavDir.set(typeof fields.path === 'string' ? fields.path : data.params.path);
					}
				} catch {
					console.error('Tool file display failed.');
				}
			} else result = { error: 'Tool Server Not Found' };
		} catch {
			// Always acknowledge the RPC; request/config/result bodies may contain secrets.
			result = [{ error: 'Tool execution failed.' }, null];
		}
		cb?.(result);
	};

	const chatEventHandler = async (event, cb) => {
		const type = event?.data?.type ?? null;
		const data = event?.data?.data ?? null;

		// Session-targeted RPC calls (code execution, tool calls, direct completion)
		// must ALWAYS be processed regardless of active chat or tab visibility,
		// because the backend's sio.call blocks waiting for our callback response.
		if ($socket?.id && data?.session_id === $socket.id) {
			if (type === 'execute:python') {
				executePythonAsWorker(data.id, data.code, cb, data.files || []);
				return;
			} else if (type === 'execute:tool') {
				await executeTool(data, cb, event.chat_id);
				return;
			} else if (type === 'request:chat:completion') {
				const { channel, form_data, model } = data;
				const responseSocket = $socket;
				let acknowledged = false;
				try {
					const directConnections = $settings?.directConnections;
					const urlIdx = model?.urlIdx;
					const apiUrl = directConnections?.OPENAI_API_BASE_URLS?.[urlIdx];
					if (typeof apiUrl !== 'string' || !apiUrl.trim())
						throw new Error('Direct completion URL missing.');
					const apiConfig = directConnections?.OPENAI_API_CONFIGS?.[urlIdx];
					const requestBody = { ...form_data };
					if (apiConfig?.prefix_id) {
						requestBody.model = requestBody.model.replace(`${apiConfig.prefix_id}.`, '');
					}
					const [res] = await chatCompletion(
						directConnections?.OPENAI_API_KEYS?.[urlIdx],
						requestBody,
						apiUrl
					);
					if (responseSocket.id !== data.session_id) {
						await res?.body?.cancel();
						return;
					}
					if (!res?.ok) throw new Error('Direct completion failed.');
					if (requestBody.stream) {
						const reader = res.body
							?.pipeThrough(new TextDecoderStream())
							.pipeThrough(splitStream('\n'))
							.getReader();
						if (!reader) throw new Error('Direct completion body missing.');
						acknowledged = true;
						cb({ status: true });
						let streamDone = false;
						try {
							while (!streamDone) {
								const { done, value } = await reader.read();
								streamDone = done;
								if (responseSocket.id !== data.session_id) {
									await reader.cancel();
									break;
								}
								if (done) break;
								if (value.trim()) responseSocket.emit(channel, value);
							}
						} finally {
							reader.releaseLock();
						}
					} else {
						const completion = await res.json();
						if (responseSocket.id !== data.session_id) return;
						acknowledged = true;
						cb(completion);
					}
				} catch {
					if (responseSocket.id !== data.session_id) return;
					// Request and provider errors can contain keys or private content.
					const failure = { error: 'Direct completion failed.' };
					console.error('Direct completion failed.');
					if (acknowledged) responseSocket.emit(channel, failure);
					else cb(failure);
				} finally {
					if (responseSocket.id === data.session_id)
						responseSocket.emit(channel, { done: true });
				}
				return;
			}
		}

		// Skip events from temporary chats that are not the current chat.
		// This prevents notifications from being sent to other tabs/devices
		// for privacy, since temporary chats are not meant to be persisted or visible elsewhere.
		const isTemporaryChat = isTemporaryChatId(event.chat_id);
		if (isTemporaryChat && event.chat_id !== $chatId) {
			return;
		}

		let isInBackground = document.visibilityState !== 'visible';
		if (window.electronAPI) {
			const res = await window.electronAPI.send({
				type: 'window:isFocused'
			});
			if (res) {
				isInBackground = !res.isFocused;
			}
		}

		await tick();

		// Calendar alerts are not chat-scoped, handle before chat_id checks
		if (type === 'calendar:alert' && data) {
			const timeStr =
				data.minutes_until <= 0
					? $i18n.t('Starting now')
					: data.minutes_until === 1
						? $i18n.t('Starting in 1 minute')
						: $i18n.t('Starting in {{count}} minutes', { count: data.minutes_until });

			toast.custom(NotificationToast, {
				componentProps: {
					onClick: () => {
						goto('/calendar');
					},
					title: data.title,
					content: timeStr
				},
				duration: 30000,
				unstyled: true
			});

			if ($isLastActiveTab) {
				if ($settings?.notificationEnabled ?? false) {
					new Notification(`${data.title} / Airis`, {
						body: timeStr,
						icon: `${WEBUI_BASE_URL}/static/favicon.png`
					});
				}
			}
			return;
		}

		if (
			!event?.internal &&
			((event.chat_id !== $chatId && !$temporaryChatEnabled) || isInBackground)
		) {
			if (type === 'chat:completion') {
				const { done, content, output, title } = data;
				const displayTitle = title || $i18n.t('New Chat');
				const contentPreview = cleanText(removeAllDetails(getOutputText(output) || content || ''));

				if (done) {
					if (
						($settings?.notificationSound ?? true) &&
						($settings?.notificationSoundAlways ?? false)
					) {
						playingNotificationSound.set(true);

						const audio = new Audio(`/audio/notification.mp3`);
						audio.play().finally(() => {
							// Ensure the global state is reset after the sound finishes
							playingNotificationSound.set(false);
						});
					}

					if ($isLastActiveTab) {
						if ($settings?.notificationEnabled ?? false) {
							new Notification(`${displayTitle} / Airis`, {
								body: contentPreview,
								icon: `${WEBUI_BASE_URL}/static/favicon.png`
							});
						}
					}

					toast.custom(NotificationToast, {
						componentProps: {
							onClick: () => {
								goto(`/c/${event.chat_id}`);
							},
							content: contentPreview,
							title: displayTitle
						},
						duration: 15000,
						unstyled: true
					});
				}
			} else if (type === 'chat:title') {
				await refreshChatList(localStorage.token);
			} else if (type === 'chat:tags') {
				tags.set(await getAllTags(localStorage.token));
			}
		}
	};

	const channelEventHandler = async (event) => {
		console.log('channelEventHandler', event);
		if (event.data?.type === 'typing') {
			return;
		}

		// handle channel created event
		if (event.data?.type === 'channel:created') {
			const res = await getChannels(localStorage.token).catch(() => {
				return null;
			});

			if (res) {
				await channels.set(
					res.sort(
						(a, b) =>
							['', null, 'group', 'dm'].indexOf(a.type) - ['', null, 'group', 'dm'].indexOf(b.type)
					)
				);
			}

			return;
		}

		// check url path
		const channel = $page.url.pathname.includes(`/channels/${event.channel_id}`);

		let isInBackground = document.visibilityState !== 'visible';
		if (window.electronAPI) {
			const res = await window.electronAPI.send({
				type: 'window:isFocused'
			});
			if (res) {
				isInBackground = !res.isFocused;
			}
		}

		if ((!channel || isInBackground) && event?.user?.id !== $user?.id) {
			await tick();
			const type = event?.data?.type ?? null;
			const data = event?.data?.data ?? null;

			if ($channels) {
				if ($channels.find((ch) => ch.id === event.channel_id) && $channelId !== event.channel_id) {
					channels.set(
						$channels.map((ch) => {
							if (ch.id === event.channel_id) {
								if (type === 'message') {
									return {
										...ch,
										unread_count: (ch.unread_count ?? 0) + 1,
										last_message_at: event.created_at
									};
								}
							}
							return ch;
						})
					);
				} else {
					const res = await getChannels(localStorage.token).catch(() => {
						return null;
					});

					if (res) {
						await channels.set(
							res.sort(
								(a, b) =>
									['', null, 'group', 'dm'].indexOf(a.type) -
									['', null, 'group', 'dm'].indexOf(b.type)
							)
						);
					}
				}
			}

			if (type === 'message') {
				const title = `${data?.user?.name}${event?.channel?.type !== 'dm' ? ` (#${event?.channel?.name})` : ''}`;

				if ($isLastActiveTab) {
					if ($settings?.notificationEnabled ?? false) {
						new Notification(`${title} / Airis`, {
							body: data?.content,
							icon: `${WEBUI_API_BASE_URL}/users/${data?.user?.id}/profile/image`
						});
					}
				}

				toast.custom(NotificationToast, {
					componentProps: {
						onClick: () => {
							goto(`/channels/${event.channel_id}`);
						},
						content: data?.content,
						title: `${title}`
					},
					duration: 15000,
					unstyled: true
				});
			}
		}
	};

	const TOKEN_EXPIRY_BUFFER = 60; // seconds
	const resolveFetchUrl = (input) => {
		if (input instanceof Request) {
			return new URL(input.url, window.location.origin);
		}

		return new URL(input, window.location.origin);
	};

	const resolveFetchHeaders = (input, init) => {
		if (init?.headers) {
			return new Headers(init.headers);
		}

		if (input instanceof Request) {
			return input.headers;
		}

		return new Headers();
	};

	const isAuthenticatedBackendFetch = (input, init) => {
		try {
			const requestUrl = resolveFetchUrl(input);
			const backendOrigin = new URL(WEBUI_BASE_URL || '/', window.location.origin).origin;

			return (
				requestUrl.origin === backendOrigin && resolveFetchHeaders(input, init).has('authorization')
			);
		} catch {
			return false;
		}
	};

	const clearExpiredSession = () => {
		if (isAuthRedirectInProgress) {
			return;
		}

		isAuthRedirectInProgress = true;
		if (tokenTimer) {
			clearInterval(tokenTimer);
			tokenTimer = null;
		}
		user.set(null);
		localStorage.removeItem('token');
		// Clear the OAuth token cookie so /auth doesn't auto-login and redirect-loop
		document.cookie = 'token=; Max-Age=0; path=/';
		userSignOut().catch((error) => {
			console.error('Error signing out expired session:', error);
		});
		toast.error($i18n.t('Session expired. Please sign in again.'));
		isAuthRedirectInProgress = false;
	};

	const isCurrentSessionUnauthorized = async (originalFetch) => {
		return originalFetch(`${WEBUI_API_BASE_URL}/auths/`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${localStorage.token}`
			},
			credentials: 'include'
		})
			.then((res) => res.status === 401)
			.catch(() => false);
	};

	const checkTokenExpiry = async () => {
		const exp = $user?.expires_at; // token expiry time in unix timestamp
		const now = Math.floor(Date.now() / 1000); // current time in unix timestamp

		if (!exp) {
			// If no expiry time is set, do nothing
			return;
		}

		if (now >= exp - TOKEN_EXPIRY_BUFFER) {
			clearExpiredSession();
		}
	};

	const desktopEventHandler = async (event) => {
		// Events that don't require auth
		if (event.type === 'page:reload') {
			location.reload();
			return;
		}
		if (event.type === 'page:navigate' && event.data?.path) {
			await goto(event.data.path);
			return;
		}
		if (event.type === 'query' && (event.data?.query || event.data?.files?.length)) {
			desktopEvent.set(event);
			await goto('/');
			return;
		}
		if (event.type === 'call') {
			desktopEvent.set(event);
			await goto('/');
			return;
		}
		if (event.type === 'theme:update' && event.data?.theme) {
			const newTheme = event.data.theme;
			localStorage.setItem('theme', newTheme);
			theme.set(newTheme);

			// Apply theme classes (mirrors logic from chat/Settings/General.svelte)
			const themes = ['dark', 'light', 'oled-dark'];
			let themeToApply =
				newTheme === 'oled-dark' ? 'dark' : newTheme === 'her' ? 'light' : newTheme;
			if (newTheme === 'system') {
				themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
			}
			themes
				.filter((e) => e !== themeToApply)
				.forEach((e) => {
					e.split(' ').forEach((cls) => document.documentElement.classList.remove(cls));
				});
			themeToApply.split(' ').forEach((cls) => document.documentElement.classList.add(cls));
			return;
		}
		if (event.type === 'models:refresh') {
			const token = localStorage.token;
			if (token) {
				models.set(
					await getModels(
						token,
						$config?.features?.enable_direct_connections
							? ($settings?.directConnections ?? null)
							: null
					)
				);
			}
			return;
		}

		const token = localStorage.token;
		if (!token) return;

		// Only admins can modify system-level connections
		if ($user?.role !== 'admin') return;

		try {
			if (event.type === 'connections:terminal') {
				if (event.data.action === 'add') {
					await addTerminalConnection(token, {
						url: event.data.url,
						key: event.data.key,
						name: 'Local Open Terminal'
					});
				} else if (event.data.action === 'remove') {
					await removeTerminalConnection(token, event.data.url);
				}
			} else if (event.type === 'connections:openai') {
				if (event.data.action === 'add') {
					await addOpenAIConnection(token, {
						url: event.data.url,
						key: event.data.key,
						config: event.data.config
					});
				} else if (event.data.action === 'remove') {
					await removeOpenAIConnection(token, event.data.url);
				}
			}
		} catch (e) {
			console.error('Desktop connection update failed:', e);
		}
	};

	const windowMessageEventHandler = async (event) => {
		if (![window.location.origin, 'http://localhost:9999'].includes(event.origin)) {
			return;
		}

		if (event.data === 'export:stats' || event.data?.type === 'export:stats') {
			syncStatsEventData = event.data;
			showSyncStatsModal = true;
		}
	};

	onMount(async () => {
		if (typeof BroadcastChannel !== 'undefined') {
			bc = new BroadcastChannel('active-tab-channel');
		}

		const originalFetch = window.fetch.bind(window);
		window.fetch = async (input, init) => {
			const response = await originalFetch(input, init);

			if (
				response.status === 401 &&
				localStorage.token &&
				isAuthenticatedBackendFetch(input, init) &&
				(await isCurrentSessionUnauthorized(originalFetch))
			) {
				clearExpiredSession();
			}

			return response;
		};

		window.addEventListener('message', windowMessageEventHandler);

		let touchstartY = 0;

		function isNavOrDescendant(el) {
			const nav = document.querySelector('nav'); // change selector if needed
			return nav && (el === nav || nav.contains(el));
		}

		const touchstartHandler = (e) => {
			if (!isNavOrDescendant(e.target)) return;
			touchstartY = e.touches[0].clientY;
		};

		const touchmoveHandler = (e) => {
			if (!isNavOrDescendant(e.target)) return;
			const touchY = e.touches[0].clientY;
			const touchDiff = touchY - touchstartY;
			if (touchDiff > 50 && window.scrollY === 0) {
				showRefresh = true;
				e.preventDefault();
			}
		};

		const touchendHandler = (e) => {
			if (!isNavOrDescendant(e.target)) return;
			if (showRefresh) {
				showRefresh = false;
				location.reload();
			}
		};

		document.addEventListener('touchstart', touchstartHandler);
		document.addEventListener('touchmove', touchmoveHandler);
		document.addEventListener('touchend', touchendHandler);

		if (typeof window !== 'undefined') {
			if (window.applyTheme) {
				window.applyTheme();
			}
		}

		if (window?.electronAPI) {
			const info = await window.electronAPI.send({
				type: 'app:info'
			});

			if (info) {
				isApp.set(true);
				appInfo.set(info);

				const data = await window.electronAPI.send({
					type: 'app:data'
				});

				if (data) {
					appData.set(data);
				}
			}

			// Listen for desktop service lifecycle events (scalable protocol)
			if (window.electronAPI.onEvent) {
				window.electronAPI.onEvent(desktopEventHandler);
			}
		}

		// Listen for messages on the BroadcastChannel
		if (bc) {
			bc.onmessage = (event) => {
				if (event.data === 'active') {
					isLastActiveTab.set(false); // Another tab became active
				}
			};
		}

		// Set yourself as the last active tab when this tab is focused
		const handlePageHidden = () => {
			pageIsVisible = false;
			pageWasHidden = true;
			clearDisconnectToastTimer();
		};

		const handlePageVisible = () => {
			pageIsVisible = true;
			lastVisibleAt = Date.now();

			isLastActiveTab.set(true); // This tab is now the active tab
			bc?.postMessage('active'); // Notify other tabs that this tab is active

			// Check token expiry when the tab becomes active
			checkTokenExpiry();

			if ($socket && !$socket.connected) {
				scheduleDisconnectToast();
			}
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				handlePageVisible();
			} else {
				handlePageHidden();
			}
		};

		// Add event listener for visibility state changes
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pagehide', handlePageHidden);
		window.addEventListener('pageshow', handlePageVisible);

		// Call visibility change handler initially to set state on load
		handleVisibilityChange();

		theme.set(localStorage.theme);

		mobile.set(window.innerWidth < BREAKPOINT);

		const onResize = () => {
			if (window.innerWidth < BREAKPOINT) {
				mobile.set(true);
			} else {
				mobile.set(false);
			}
		};
		window.addEventListener('resize', onResize);

		user.subscribe(async (value) => {
			if (value) {
				$socket?.off('events', chatEventHandler);
				$socket?.off('events:channel', channelEventHandler);

				$socket?.on('events', chatEventHandler);
				$socket?.on('events:channel', channelEventHandler);

				// Set up the token expiry check
				if (tokenTimer) {
					clearInterval(tokenTimer);
				}
				tokenTimer = setInterval(checkTokenExpiry, 15000);
			} else {
				$socket?.off('events', chatEventHandler);
				$socket?.off('events:channel', channelEventHandler);
			}
		});

		initI18n(localStorage?.locale);
		const isPublicRoute = isPublicMarketingRoute($page.url.pathname);
		if (isPublicRoute && localStorage.token) {
			// Hydrate an existing session without delaying the public landing page.
			void getSessionUser(localStorage.token)
				.then((sessionUser) => {
					if (sessionUser) user.set(sessionUser);
				})
				.catch((error) => console.warn('Unable to hydrate public session:', error));
		}
		if (!isPublicRoute) {
			let backendConfig = null;
			try {
				backendConfig = await getBackendConfig();
				console.log('Backend config:', backendConfig);
			} catch (error) {
				if (error?.authRedirect) {
					// Forward-auth proxy is redirecting to an external login page.
					// Full-page navigation lets the browser follow the redirect natively.
					window.location.href = '/';
					return;
				}
				console.error('Error loading backend config:', error);
			}

			if (!localStorage.locale) {
				const languages = await getLanguages();
				const browserLanguages = navigator.languages
					? navigator.languages
					: [navigator.language || navigator.userLanguage];
				const lang = backendConfig?.default_locale
					? backendConfig.default_locale
					: bestMatchingLanguage(languages, browserLanguages, 'en-US');
				changeLanguage(lang);
				dayjs.locale(lang);
			}

			if (backendConfig) {
				// Save Backend Status to Store
				await config.set(backendConfig);
				await WEBUI_NAME.set(backendConfig.name);

				if ($config) {
					await setupSocket($config.features?.enable_websocket ?? true);

					if (localStorage.token) {
						// Get Session User Info
						const sessionUser = await getSessionUser(localStorage.token).catch((error) => {
							toast.error(`${error}`);
							return null;
						});

						if (sessionUser) {
							await user.set(sessionUser);
							try {
								await config.set(await getBackendConfig());
							} catch (error) {
								console.error('Error refreshing backend config:', error);
							}

							// Keep user timezone in sync on every app load/refresh
							const timezone = getUserTimezone();
							if (timezone) {
								updateUserTimezone(localStorage.token, timezone);
							}

							// Relay auth token to desktop app for API access
							if (window.electronAPI?.send) {
								window.electronAPI
									.send({
										type: 'token:update',
										token: localStorage.token
									})
									.catch(() => {});
							}
						} else {
							localStorage.removeItem('token');
							await user.set(null);
						}
					}
				}
			} else {
				// Redirect to /error when Backend Not Detected
				await goto(`/error`);
			}
		}

		await tick();

		if (
			document.documentElement.classList.contains('her') &&
			document.getElementById('progress-bar')
		) {
			loadingProgress.subscribe((value) => {
				const progressBar = document.getElementById('progress-bar');

				if (progressBar) {
					progressBar.style.width = `${value}%`;
				}
			});

			await loadingProgress.set(100);

			document.getElementById('splash-screen')?.remove();
			document.documentElement.classList.remove('splash');

			const audio = new Audio(`/audio/greeting.mp3`);
			const playAudio = () => {
				audio.play();
				document.removeEventListener('click', playAudio);
			};

			document.addEventListener('click', playAudio);

			loaded = true;
		} else {
			document.getElementById('splash-screen')?.remove();
			document.documentElement.classList.remove('splash');
			loaded = true;
		}

		// Auto-show SyncStatsModal when opened with ?sync=true (from community)
		if ((window.opener ?? false) && $page.url.searchParams.get('sync') === 'true') {
			showSyncStatsModal = true;
		}

		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('message', windowMessageEventHandler);
			document.removeEventListener('touchstart', touchstartHandler);
			document.removeEventListener('touchmove', touchmoveHandler);
			document.removeEventListener('touchend', touchendHandler);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('pagehide', handlePageHidden);
			window.removeEventListener('pageshow', handlePageVisible);
		};
	});

	$: if (typeof document !== 'undefined') {
		document.documentElement.classList.toggle(
			'high-contrast',
			$settings?.highContrastMode ?? false
		);
	}

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('message', windowMessageEventHandler);
		}
		bc?.close();
	});
</script>

<svelte:head>
	{#if isPublicMarketingRoute($page.url.pathname)}
		<meta
			name="robots"
			content={$page.url.pathname === '/unsubscribe' ? 'noindex,nofollow' : 'index,follow'}
		/>
	{:else}
		<meta name="robots" content="noindex,nofollow" />
		<title>{$WEBUI_NAME}</title>
		<link crossorigin="anonymous" rel="icon" href="{WEBUI_BASE_URL}/static/favicon.svg" />

		<meta name="apple-mobile-web-app-title" content={$WEBUI_NAME} />
		<meta name="description" content={$WEBUI_NAME} />
		<link
			rel="search"
			type="application/opensearchdescription+xml"
			title={$WEBUI_NAME}
			href="/opensearch.xml"
			crossorigin="use-credentials"
		/>
	{/if}
</svelte:head>

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-gray-900 focus:shadow-lg dark:focus:bg-gray-800 dark:focus:text-gray-100"
>
	{$i18n.t('Skip to main content')}
</a>

{#if $page.url.pathname !== '/unsubscribe'}
	<AnalyticsBootstrap />
	<AnalyticsConsent />
{/if}

{#if showRefresh}
	<div class=" py-5">
		<Spinner className="size-5" />
	</div>
{/if}

{#if loaded}
	{#if $isApp}
		<div class="flex flex-row h-screen">
			<AppSidebar />

			<div class="w-full flex-1 max-w-[calc(100%-4.5rem)]">
				<slot />
			</div>
		</div>
	{:else}
		<slot />
	{/if}
{/if}

{#if $config?.features.enable_community_sharing}
	<SyncStatsModal bind:show={showSyncStatsModal} eventData={syncStatsEventData} />
{/if}

<Toaster
	theme={$theme.includes('dark')
		? 'dark'
		: $theme === 'system'
			? typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light'
			: 'light'}
	richColors
	position="top-right"
	closeButton
	toastOptions={{
		classes: {
			closeButton:
				'!bg-white/80 !text-gray-500 !border-gray-200 hover:!bg-gray-50 hover:!text-gray-700 dark:!bg-gray-850 dark:!text-gray-400 dark:!border-gray-700 dark:hover:!bg-gray-800 dark:hover:!text-gray-200'
		}
	}}
/>
