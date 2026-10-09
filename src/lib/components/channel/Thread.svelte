<script lang="ts">
	import type {
		ChannelMessageEvent,
		ChannelDetail,
		ChannelDisplayMessage,
		ChannelMessageInput,
		ChannelPinHandler
	} from '$lib/utils/airis/channel-types';
	import { goto } from '$app/navigation';

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
	let top = false;

	let messagesContainerElement: HTMLDivElement | null = null;
	let chatInputElement: RichTextInput | null = null;

	let replyToMessage: ChannelDisplayMessage | null = null;

	let typingUsers: ChannelMessageEvent['user'][] = [];
	let typingUsersTimeout: Record<string, ReturnType<typeof setTimeout>> = {};

	$: if (threadId) {
		loading = initHandler();
	}

	const scrollToBottom = () => {
		if (messagesContainerElement) {
			messagesContainerElement.scrollTop = messagesContainerElement.scrollHeight;
		}
	};

	const initHandler = async (): Promise<void> => {
		const version = ++loadVersion;
		const selectedThreadId = threadId;
		const selectedChannel = channel;
		messages = null;
		top = false;

		typingUsers = [];
		typingUsersTimeout = {};

		if (selectedChannel && selectedThreadId) {
			try {
				const loadedMessages = await getChannelThreadMessages(
					localStorage.token,
					selectedChannel.id,
					selectedThreadId
				);
				if (version !== loadVersion) return;
				messages = loadedMessages;
				if (messages) {
					top = messages.length < 50;
					await tick();
					if (version === loadVersion) scrollToBottom();
				}
			} catch (error) {
				if (version === loadVersion) toast.error(`${error}`);
			}
		} else {
			goto('/');
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

			if (type === 'message') {
				if ((data?.parent_id ?? null) === threadId) {
					if (messages) {
						messages = [
							data,
							...messages.filter((m: ChannelDisplayMessage): boolean => m.id !== data.id)
						];

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
					messages = messages.filter(
						(message: ChannelDisplayMessage): boolean => message.id !== data.id
					);
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

	const submitHandler = async ({ content, data }: ChannelMessageInput): Promise<void> => {
		if (!channel || (!content && (data?.files ?? []).length === 0)) {
			return;
		}

		await sendMessage(localStorage.token, channel.id, {
			parent_id: threadId,
			reply_to_id: replyToMessage?.id ?? null,
			content: content,
			data: data
		}).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		replyToMessage = null;
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
	<div class="flex flex-col w-full h-full bg-gray-50 dark:bg-gray-850">
		<div class="sticky top-0 flex items-center justify-between px-3.5 py-3">
			<div class=" font-normal text-lg">{$i18n.t('Thread')}</div>

			<div>
				<button
					class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-2"
					on:click={() => {
						onClose();
					}}
				>
					<XMark />
				</button>
			</div>
		</div>

		<div class=" max-h-full w-full overflow-y-auto" bind:this={messagesContainerElement}>
			{#if messages !== null}
				<Messages
					id={threadId}
					{channel}
					{top}
					{messages}
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
							messages.length
						);

						if (version !== loadVersion || !messages || !newMessages) return;
						messages = [...messages, ...newMessages];

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

			<div class=" pb-[1rem] px-2.5 w-full">
				<MessageInput
					bind:replyToMessage
					bind:chatInputElement
					id={threadId}
					{channel}
					disabled={!channel?.write_access}
					placeholder={!channel?.write_access
						? $i18n.t('You do not have permission to send messages in this thread.')
						: $i18n.t('Reply to thread...')}
					typingUsersClassName="from-gray-50 dark:from-gray-850"
					{typingUsers}
					userSuggestions={true}
					channelSuggestions={true}
					{onChange}
					onSubmit={submitHandler}
				/>
			</div>
		</div>
	</div>
{/if}
