<script lang="ts">
	import { tick, getContext, onDestroy } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { SavedChat } from '$lib/utils/airis/frontend-contracts';
	import type {
		ChatHistory,
		ChatHistoryMessage,
		ChatAttachment
	} from '$lib/utils/airis/chat_history';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import dayjs from 'dayjs';
	import localizedFormat from 'dayjs/plugin/localizedFormat';

	import { settings, chatId, WEBUI_NAME, models, config, user as sessionUser } from '$lib/stores';
	import { convertMessagesToHistory, createMessagesList, getDeepestChildId } from '$lib/utils';

	import { getChatByShareId, cloneSharedChatById, forkChatById } from '$lib/apis/chats';

	import Messages from '$lib/components/chat/Messages.svelte';

	import { getUserInfoById, getUserSettings, type UserInfoResponse } from '$lib/apis/users';
	import { getModels } from '$lib/apis';
	import { toast } from 'svelte-sonner';

	const i18n = getContext<Readable<I18n>>('i18n');
	dayjs.extend(localizedFormat);

	let loaded = false;
	let forking = false;

	let autoScroll = true;
	let messagesComponent: Messages | undefined;
	let selectedModels = [''];

	let chat: SavedChat | null = null;
	let user: UserInfoResponse | null = null;

	let title = '';
	const files: ChatAttachment[] = [];

	let messages: ChatHistoryMessage[] = [];
	let history: ChatHistory = {
		messages: {},
		currentId: null
	};

	$: messages = createMessagesList(history, history.currentId);
	$: canClone =
		$sessionUser &&
		($sessionUser.role === 'admin' || ($sessionUser.permissions?.chat?.import ?? true));

	let loadGeneration = 0;
	let destroyed = false;
	const isCurrent = (request: number, shareId: string): boolean =>
		!destroyed && request === loadGeneration && $page.params.id === shareId;

	onDestroy(() => {
		destroyed = true;
		loadGeneration += 1;
	});

	const loadSharedChat = async (shareId = $page.params.id): Promise<void> => {
		const request = ++loadGeneration;
		loaded = false;
		chat = null;
		user = null;
		title = '';
		if (!shareId || destroyed) return;
		const token = localStorage.token ?? '';
		try {
			const userSettings = token
				? await getUserSettings(token).catch((error) => {
						console.error(error);
						return null;
					})
				: null;
			if (!isCurrent(request, shareId)) return;
			if (userSettings) {
				settings.set(userSettings.ui);
			} else {
				let localSettings = {} as Parameters<(typeof settings)['set']>[0];
				try {
					localSettings = JSON.parse(localStorage.getItem('settings') ?? '{}');
				} catch (error: unknown) {
					console.error('Failed to parse settings from localStorage', error);
				}
				settings.set(localSettings);
			}
			const availableModels = token
				? await getModels(
						token,
						$config?.features?.enable_direct_connections
							? ($settings?.directConnections ?? null)
							: null
					).catch((error) => {
						console.error(error);
						return [];
					})
				: [];
			if (!isCurrent(request, shareId)) return;
			models.set(availableModels);
			chatId.set(shareId);
			const sharedChat = await getChatByShareId(token, shareId);
			if (!isCurrent(request, shareId)) return;
			if (!sharedChat?.chat) {
				await goto('/');
				return;
			}
			if (sharedChat.chat?.share_mode === 'continue' && sharedChat.id !== shareId) {
				await goto(`/c/${sharedChat.id}${$page.url.search}`, { replaceState: true });
				return;
			}
			const owner = token
				? await getUserInfoById(token, sharedChat.user_id).catch((error) => {
						console.error(error);
						return null;
					})
				: null;
			if (!isCurrent(request, shareId)) return;
			chat = sharedChat;
			user = owner;
			const chatContent = sharedChat.chat;
			selectedModels = chatContent.models ?? [''];
			history = chatContent.history ?? convertMessagesToHistory(chatContent.messages);
			title = chatContent.title;
			autoScroll = true;
			await tick();
			if (!isCurrent(request, shareId)) return;
			const lastMessage = messages.at(-1);
			if (lastMessage?.id && lastMessage.id in history.messages) {
				history.messages[lastMessage.id].done = true;
			}
			await tick();
			if (isCurrent(request, shareId)) {
				loaded = true;
				await tick();
				if (!isCurrent(request, shareId)) return;
				const target = $page.url.searchParams.get('message');
				if (target && history.messages[target]) {
					autoScroll = false;
					history.currentId = getDeepestChildId(history, target);
					await tick();
					if (isCurrent(request, shareId)) await messagesComponent?.scrollToMessage(target);
				} else messagesComponent?.scrollToBottom();
			}
		} catch (error) {
			if (isCurrent(request, shareId)) {
				console.error(error);
				await goto('/');
			}
		}
	};

	const forkSharedChat = async (messageId: string | null = null) => {
		const shareId = $page.params.id;
		if (!canClone || !shareId || forking) return;
		forking = true;
		const toastId = toast.loading($i18n.t('Forking chat...'));
		try {
			const result = await forkChatById(
				localStorage.token,
				shareId,
				messageId ?? history.currentId
			);
			if (result?.id) {
				await goto(`/c/${result.id}`);
				toast.success($i18n.t('Chat forked'), { id: toastId });
			} else {
				toast.error($i18n.t('Failed to fork chat'), { id: toastId });
			}
		} catch (error) {
			toast.error(`${error}`, { id: toastId });
		} finally {
			forking = false;
		}
	};

	$: if ($page.params.id) loadSharedChat($page.params.id);

	const cloneSharedChat = async (): Promise<void> => {
		if (!canClone) {
			toast.error($i18n.t('Access prohibited'));
			return;
		}

		if (!chat) return;

		const res = await cloneSharedChatById(localStorage.token, chat.id).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			goto(`/c/${res.id}`);
		}
	};
</script>

<svelte:head>
	<!-- LICENSE covers this Open WebUI browser-title identifier.
	Do not alter, remove, obscure, or replace it except as LICENSE permits:
	https://docs.openwebui.com/license. -->
	<title>
		{title
			? `${title.length > 30 ? `${title.slice(0, 30)}...` : title} / ${$WEBUI_NAME}`
			: `${$WEBUI_NAME}`}
	</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

{#if loaded && chat}
	<div
		class="h-screen max-h-[100dvh] w-full flex flex-col text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-900"
	>
		<div class="flex flex-col flex-auto justify-center relative">
			<div
				class="@container flex flex-col w-full flex-auto overflow-auto h-0"
				id="messages-container"
			>
				<header
					class="sticky top-0 z-30 mx-auto w-full max-w-[58rem] shrink-0 bg-white px-2 dark:bg-gray-900"
				>
					<div
						class="pointer-events-none absolute inset-x-0 top-full h-10 z-[-1] bg-linear-to-b from-white to-transparent dark:from-gray-900"
					></div>
					<div class="flex items-center gap-3 px-3 py-2">
						<h1
							class="min-w-0 truncate text-[0.9375rem] font-normal text-gray-700 dark:text-gray-300"
							{title}
						>
							{title}
						</h1>
						<time
							class="ms-auto shrink-0 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500"
							datetime={dayjs(chat.chat.timestamp || chat.created_at * 1000)
								.locale($i18n.language)
								.toISOString()}
						>
							{dayjs(chat.chat.timestamp || chat.created_at * 1000)
								.locale($i18n.language)
								.format('LLL')}
						</time>
					</div>
				</header>

				<div class=" h-full w-full flex flex-col py-2" role="main">
					<div class="w-full">
						<Messages
							bind:this={messagesComponent}
							className="h-full flex pb-8"
							{user}
							chatId={$chatId}
							readOnly={true}
							atSelectedModel={undefined}
							mergeResponses={() => {}}
							chatActionHandler={() => {}}
							forkHandler={canClone ? forkSharedChat : null}
							{selectedModels}
							bind:history
							bind:autoScroll
							bottomPadding={files.length > 0}
							sendMessage={() => {}}
							continueResponse={() => {}}
							regenerateResponse={() => {}}
						/>
					</div>
				</div>
			</div>

			{#if canClone}
				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center gap-2 bg-linear-to-t from-white dark:from-gray-900 to-transparent pb-5 pt-10"
				>
					<button
						class="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-2.5 text-xs font-normal text-white transition hover:bg-black disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white pointer-events-auto"
						on:click={cloneSharedChat}
					>
						{$i18n.t('Clone Chat')}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
