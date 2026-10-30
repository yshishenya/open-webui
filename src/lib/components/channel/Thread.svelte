<script lang="ts">
	import type {
		ChannelMessageEvent,
		ChannelDetail,
		ChannelDisplayMessage,
		ChannelMessageInput,
		ChannelPinHandler
	} from '$lib/utils/airis/channel-types';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import { socket, user } from '$lib/stores';

	import { getChannelThreadMessages, sendMessage } from '$lib/apis/channels';

	import XMark from '$lib/components/icons/XMark.svelte';
	import MessageInput from './MessageInput.svelte';
	import Messages from './Messages.svelte';
	import { onDestroy, onMount, tick, getContext } from 'svelte';
	import type RichTextInput from '../common/RichTextInput.svelte';
	import { toast } from 'svelte-sonner';
	import Spinner from '../common/Spinner.svelte';

	const i18n = getContext('i18n');

	export let threadId: string | null = null;
	export let channel: ChannelDetail | null = null;

	export let onClose = () => {};
	export let onPin: ChannelPinHandler = () => {};

	let messages: ChannelDisplayMessage[] | null = null;
	let loadVersion = 0;
	let loading: Promise<void> = Promise.resolve();
	let searchAnchor = '';
	let top = false;

	let messagesContainerElement: HTMLDivElement | null = null;
	let chatInputElement: RichTextInput | undefined = undefined;

	let replyToMessage: ChannelDisplayMessage | null = null;

	let typingUsers: ChannelMessageEvent['user'][] = [];
	let typingUsersTimeout: Record<string, ReturnType<typeof setTimeout>> = {};

	$: if (threadId) {
		loading = initHandler(
			$page.url.searchParams.get('thread') === threadId
				? ($page.url.searchParams.get('message') ?? '')
				: ''
		);
	}

	const scrollToBottom = () => {
		if (messagesContainerElement) {
			messagesContainerElement.scrollTop = messagesContainerElement.scrollHeight;
		}
	};

	const initHandler = async (anchor = ''): Promise<void> => {
		const version = ++loadVersion;
		const selectedThreadId = threadId;
		const selectedChannel = channel;
		searchAnchor = anchor;
		messages = null;
		top = false;
		replyToMessage = null;
		typingUsers = [];
		Object.values(typingUsersTimeout).forEach(clearTimeout);
		typingUsersTimeout = {};
		if (!selectedChannel || !selectedThreadId) {
			void goto('/');
			return;
		}
		try {
			const loaded = await getChannelThreadMessages(
				localStorage.token, selectedChannel.id, selectedThreadId, 0, 50, { around: anchor }
			);
			if (version !== loadVersion) return;
			messages = loaded ?? [];
			top = (loaded ?? []).length < 50;
			await tick();
			if (version !== loadVersion) return;
			if (anchor) {
				const element = document.getElementById(`message-${selectedThreadId}-${anchor}`);
				element?.scrollIntoView({ block: 'center' });
				element?.animate([{ backgroundColor: '#a5a5c544' }, { backgroundColor: 'transparent' }], { duration: 2200 });
			} else scrollToBottom();
		} catch (error) {
			if (version === loadVersion) toast.error(String(error));
		}
	};

	const channelEventHandler = async (event: ChannelMessageEvent): Promise<void> => {
		const version = loadVersion;
		// Apply live changes only after the initial HTTP snapshot is installed.
		await loading;
		if (version !== loadVersion || !messages) return;
		console.debug(event);
		if (event.channel_id === channel?.id) {
			if (!event.data) return;
			const { type, data } = event.data;

			if (messages === null && type !== 'typing') {
				const request = loading;
				await request;
				if (request !== loading) return;
			}

			if (type === 'message') {
				if ((data?.parent_id ?? null) === threadId) {
					if (messages && !messages.some((message) => message.id === data.id)) {
						messages = [{ ...data, temp_id: null }, ...messages];

						if (typingUsers.find((user) => user.id === event.user.id)) {
							typingUsers = typingUsers.filter((user) => user.id !== event.user.id);
						}
					}
				}
			} else if (type === 'message:update' || type === 'message:reply') {
				if (messages) {
					const idx = messages.findIndex(
						(message: ChannelDisplayMessage): boolean => message.id === data.id
					);

					if (idx !== -1) {
						messages[idx] = data;
					}
				}
			} else if (type === 'message:delete') {
				if (data.id === threadId) {
					onClose();
				}

				if (messages) {
					messages = messages
						.filter((message) => message.id !== data.id)
						.map((message) =>
							message?.reply_to_message?.id === data.id
								? { ...message, reply_to_message: null }
								: message
						);
				}

				if (replyToMessage?.id === data.id) {
					replyToMessage = null;
				}
			} else if (type === 'message:reaction:add' || type === 'message:reaction:remove') {
				if (messages) {
					const idx = messages.findIndex(
						(message: ChannelDisplayMessage): boolean => message.id === data.id
					);
					if (idx !== -1) {
						messages[idx] = data;
					}
				}
			} else if (type === 'typing' && event.message_id === threadId) {
				if (event.user.id === $user?.id) {
					return;
				}

				typingUsers = data.typing
					? [
							...typingUsers,
							...(typingUsers.find((user) => user.id === event.user.id)
								? []
								: [
										{
											id: event.user.id,
											name: event.user.name
										}
									])
						]
					: typingUsers.filter((user) => user.id !== event.user.id);

				if (typingUsersTimeout[event.user.id]) {
					clearTimeout(typingUsersTimeout[event.user.id]);
				}

				typingUsersTimeout[event.user.id] = setTimeout((): void => {
					if (version !== loadVersion) return;
					typingUsers = typingUsers.filter((user) => user.id !== event.user.id);
				}, 5000);
			}
		}
	};

	const submitHandler = async ({ content, data, channel_id, parent_id, reply_to_message }: ChannelMessageInput): Promise<void> => {
		if (!channel || (!content && (data?.files ?? []).length === 0)) {
			return;
		}

		await sendMessage(localStorage.token, channel_id, {
			parent_id: parent_id ?? undefined,
			reply_to_id: reply_to_message?.id ?? null,
			content: content,
			data: data
		}).catch((error) => {
			toast.error(`${error}`);
			return null;
		});
	};

	const onChange = async (): Promise<void> => {
		if (!channel) return;
		$socket?.emit('events:channel', {
			channel_id: channel.id,
			message_id: threadId,
			data: {
				type: 'typing',
				data: {
					typing: true
				}
			}
		});
	};

	onMount(() => {
		$socket?.on('events:channel', channelEventHandler);
	});

	onDestroy((): void => {
		loadVersion++;
		$socket?.off('events:channel', channelEventHandler);
	});
</script>

{#if channel}
	<div class="flex flex-col w-full h-full bg-white dark:bg-gray-900">
		<div
			class="sticky top-0 flex min-h-10 items-center justify-between border-b border-gray-100/60 px-4 py-1.5 dark:border-gray-800/40"
		>
			<div class=" font-medium text-sm">{$i18n.t('Thread')}</div>

			<div>
				<button
					type="button"
					aria-label={$i18n.t('Close')}
					class="flex size-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50/60 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-300"
					on:click={() => {
						onClose();
					}}
				>
					<XMark className="size-4" />
				</button>
			</div>
		</div>

		<div
			class="flex-1 min-h-0 w-full overflow-y-auto will-change-transform"
			bind:this={messagesContainerElement}
		>
			<div class="pt-3">
				{#if searchAnchor}<div class="px-3 py-2 text-xs text-gray-500 flex justify-between">
						<span>{$i18n.t('Showing search match')}</span><button
							class="underline"
							on:click={() => initHandler()}>{$i18n.t('Latest replies')}</button
						>
					</div>{/if}
				{#if messages !== null}
					<Messages
						id={threadId}
						{channel}
						{top}
						bind:messages
						{replyToMessage}
						thread={true}
						{onPin}
						onReply={async (message) => {
							replyToMessage = message;

							await tick();
							chatInputElement?.focus();
						}}
						onLoad={async (): Promise<void> => {
							if (!channel || !threadId || !messages) return;
							const version = loadVersion;
							const newMessages = await getChannelThreadMessages(
								localStorage.token,
								channel.id,
								threadId,
								searchAnchor ? 0 : messages.length,
								50,
								searchAnchor ? { before: messages[messages.length - 1]?.id } : {}
							);

						if (version !== loadVersion || !messages || !newMessages) return;
													messages = [
								...messages,
								...newMessages.filter(
									(item: ChannelDisplayMessage) => !messages?.some((existing) => existing.id === item.id)
								)
							];

							if (newMessages.length < 50) {
								top = true;
								return;
							}
						}}
					/>
				{:else}
					<div class="w-full flex justify-center pt-5 pb-10">
						<Spinner />
					</div>
				{/if}
			</div>
		</div>

		<div class=" pb-3 px-3 w-full">
			<MessageInput
				{messages}
				bind:replyToMessage
				bind:chatInputElement
				id={threadId}
				{channel}
				disabled={!channel?.write_access}
				placeholder={!channel?.write_access
					? $i18n.t('You do not have permission to send messages in this thread.')
					: $i18n.t('Reply to thread...')}
				typingUsersClassName="from-white dark:from-gray-900"
				{typingUsers}
				userSuggestions={true}
				channelSuggestions={true}
				{onChange}
				onSubmit={submitHandler}
			/>
		</div>
	</div>
{/if}
