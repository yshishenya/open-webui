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

	import { settings, chatId, WEBUI_NAME, models, config, user as sessionUser } from '$lib/stores';
	import { convertMessagesToHistory, createMessagesList } from '$lib/utils';

	import { getChatByShareId, cloneSharedChatById } from '$lib/apis/chats';

	import Messages from '$lib/components/chat/Messages.svelte';

	import { getUserInfoById, getUserSettings, type UserInfoResponse } from '$lib/apis/users';
	import { getModels } from '$lib/apis';
	import { toast } from 'svelte-sonner';
	import localizedFormat from 'dayjs/plugin/localizedFormat';

	const i18n = getContext<Readable<I18n>>('i18n');
	dayjs.extend(localizedFormat);

	let loaded = false;

	let autoScroll = true;
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
			if (isCurrent(request, shareId)) loaded = true;
		} catch (error) {
			if (isCurrent(request, shareId)) {
				console.error(error);
				await goto('/');
			}
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
	<title>
		{title
			? `${title.length > 30 ? `${title.slice(0, 30)}...` : title} / ${$WEBUI_NAME}`
			: `${$WEBUI_NAME}`}
	</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

{#if loaded}
	<div
		class="h-screen max-h-[100dvh] w-full flex flex-col text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-900"
	>
		<div class="flex flex-col flex-auto justify-center relative">
			<div class=" flex flex-col w-full flex-auto overflow-auto h-0" id="messages-container">
				<div
					class="pt-5 px-2 w-full {($settings?.widescreenMode ?? null)
						? 'max-w-full'
						: 'max-w-[58rem]'} mx-auto"
				>
					<div class="px-3">
						<h1 class=" text-2xl font-normal line-clamp-1 m-0">
							{title}
						</h1>

						<div class="flex text-sm justify-between items-center mt-1">
							<time
								class="text-gray-400"
								datetime={new Date(chat?.chat?.timestamp || Date.now()).toISOString()}
							>
								{dayjs(chat?.chat?.timestamp ?? undefined).format('LLL')}
							</time>
						</div>
					</div>
				</div>

				<div class=" h-full w-full flex flex-col py-2" role="main">
					<div class="w-full">
						<Messages
							className="h-full flex pt-4 pb-8 "
							{user}
							chatId={$chatId}
							readOnly={true}
							atSelectedModel={undefined}
							mergeResponses={() => {}}
							chatActionHandler={() => {}}
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
					class="absolute bottom-0 right-0 left-0 flex justify-center w-full bg-linear-to-b from-transparent to-white dark:to-gray-900"
				>
					<div class="pb-5">
						<button
							class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
							on:click={cloneSharedChat}
						>
							{$i18n.t('Clone Chat')}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
