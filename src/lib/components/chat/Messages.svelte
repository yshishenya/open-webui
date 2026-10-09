<script lang="ts">
	import { v4 as uuidv4 } from 'uuid';
	import { settings, user as _user, temporaryChatEnabled } from '$lib/stores';
	import { refreshChatList } from '$lib/stores/chatList';
	import { tick, getContext, onDestroy } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { Model } from '$lib/stores';
	import type {
		ChatHistory,
		ChatHistoryMessage,
		ChatMessageEdit
	} from '$lib/utils/airis/chat_history';

	import { getLastMessageId } from '$lib/utils/airis/chat_history';
	import { createMessagesList } from '$lib/utils';

	import { toast } from 'svelte-sonner';
	import { deleteChatMessageById, updateChatById } from '$lib/apis/chats';

	import Message from './Messages/Message.svelte';
	import Loader from '../common/Loader.svelte';
	import Spinner from '../common/Spinner.svelte';

	import ChatPlaceholder from './ChatPlaceholder.svelte';

	const i18n = getContext<Writable<I18n>>('i18n');

	export let className = 'h-full flex pt-18';

	export let chatId = '';
	export let user = $_user;

	export let history: ChatHistory = { messages: {}, currentId: null };
	export let selectedModels: string[];
	export let atSelectedModel: Model | null | undefined;

	let messages: ChatHistoryMessage[] = [];

	export let setInputText: (text: string) => void = () => {};

	export let sendMessage: (history: ChatHistory, parentId: string) => void | Promise<void>;
	export let continueResponse: () => void | Promise<void>;
	export let regenerateResponse: (
		message: ChatHistoryMessage,
		prompt?: string | null
	) => void | Promise<void>;
	export let mergeResponses: (
		messageId: string,
		responses: string[],
		chatId: string
	) => void | Promise<void>;

	export let chatActionHandler: (
		chatId: string,
		actionId: string,
		modelId: string | undefined,
		messageId: string,
		event?: unknown
	) => void | Promise<void>;
	export let submitMessage: (parentId: string, prompt: string) => void | Promise<void> = () => {};
	export let addMessages: (request: {
		modelId: string;
		parentId: string | null;
		messages: ChatHistoryMessage[];
	}) => void | Promise<void> = () => {};
	export let forkHandler: ((messageId?: string | null) => void | Promise<void>) | null = null;

	export let readOnly = false;
	export let allowDelete = true;
	export let compactPreview = false;
	export let editCodeBlock = true;

	export let topPadding = false;
	export let bottomPadding = false;
	export let autoScroll: boolean;
	export let messagesContainerId = 'messages-container';

	export let onSelect: (event: { type: string; data: string }) => void | Promise<void> = () => {};
	export let onInsertToNote: ((content: string) => void) | null = null;

	export let messagesCount: number | null = 8;
	let messagesLoading = false;

	const getMessagesContainer = (): HTMLElement | null =>
		document.getElementById(messagesContainerId);

	onDestroy(() => {
		cancelAnimationFrame(pendingRebuild!);
	});

	const loadMoreMessages = async (): Promise<void> => {
		// scroll slightly down to disable continuous loading
		const element = getMessagesContainer();
		if (element) {
			element.scrollTop = element.scrollTop + 100;
		}

		messagesLoading = true;
		messagesCount! += 8;

		buildMessages();

		await tick();

		messagesLoading = false;
	};

	let pendingRebuild: number | null = null;
	let lastCurrentId: string | null = null;

	const buildMessages = (): void => {
		let _messages: ChatHistoryMessage[] = [];

		let message: ChatHistoryMessage | null | undefined = history.messages[history.currentId!];
		const visitedMessageIds = new Set();

		while (message && (messagesCount !== null ? _messages.length < messagesCount : true)) {
			if (visitedMessageIds.has(message.id)) {
				console.warn('Circular dependency detected in message history', message.id);
				break;
			}
			visitedMessageIds.add(message.id);

			_messages.push(message);
			message = message.parentId !== null ? history.messages[message.parentId] : null;
		}

		messages = _messages.reverse();
	};

	// Throttle message list rebuilds to once per animation frame during streaming.
	// Structural changes (currentId change) always rebuild immediately.
	const handleHistoryChange = (
		currentId: string | null,
		_messages: ChatHistory['messages']
	): void => {
		if (!currentId) {
			messages = [];
			return;
		}

		const currentIdChanged = currentId !== lastCurrentId;
		lastCurrentId = currentId;

		if (currentIdChanged) {
			// Structural change: new chat, navigation, new message — rebuild immediately
			cancelAnimationFrame(pendingRebuild!);
			pendingRebuild = null;
			buildMessages();
		} else if (_messages) {
			// Content update (streaming) — throttle to once per frame
			if (!pendingRebuild) {
				pendingRebuild = requestAnimationFrame(() => {
					pendingRebuild = null;
					buildMessages();
				});
			}
		}
	};

	$: handleHistoryChange(history.currentId, history.messages);

	$: if (autoScroll && bottomPadding) {
		(async () => {
			await tick();
			scrollToBottom();
		})();
	}

	const scrollToBottom = (): void => {
		const element = getMessagesContainer();
		if (element) {
			element.scrollTop = element.scrollHeight;

			// Follow-up scroll to account for content-visibility: auto re-layouts
			requestAnimationFrame(() => {
				if (element) {
					element.scrollTop = element.scrollHeight;
				}
			});
		}
	};

	export const scrollToTop = async (): Promise<void> => {
		messagesCount = null;
		buildMessages();
		await tick();
		if (messages.length > 0) {
			const firstMessageEl = document.getElementById(`message-${messages[0].id}`);
			if (firstMessageEl) {
				firstMessageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}
	};

	const updateChat = async (): Promise<void> => {
		if (!$temporaryChatEnabled) {
			history = history;
			await tick();
			const res = await updateChatById(localStorage.token, chatId, {
				history: history,
				messages: messages
			});

			// Keep local plain-content edits aligned with the saved chat response.
			if (res?.chat?.history?.messages) {
				for (const [id, msg] of Object.entries(
					res.chat.history.messages as ChatHistory['messages']
				)) {
					if (history.messages[id] && msg.content) {
						history.messages[id].content = msg.content;
					}
				}
				history = history;
			}

			await refreshChatList(localStorage.token);
		}
	};

	const gotoMessage = async (message: ChatHistoryMessage, idx: number): Promise<void> => {
		// Determine the correct sibling list (either parent's children or root messages)
		let siblings;
		if (message.parentId !== null) {
			siblings = history.messages[message.parentId]?.childrenIds ?? [];
		} else {
			siblings = Object.values(history.messages)
				.filter((msg) => msg.parentId === null)
				.map((msg) => msg.id);
		}

		// Clamp index to a valid range
		idx = Math.max(0, Math.min(idx, siblings.length - 1));

		let messageId = siblings[idx];

		// If we're navigating to a different message
		if (message.id !== messageId) {
			// Drill down to the deepest child of that branch
			messageId = getLastMessageId(history, messageId) ?? history.currentId!;

			history.currentId = messageId;
		}

		await tick();

		// Optional auto-scroll
		if ($settings?.scrollOnBranchChange ?? true) {
			const element = getMessagesContainer();
			autoScroll = element
				? element.scrollHeight - element.scrollTop <= element.clientHeight + 50
				: false;

			setTimeout(() => {
				scrollToBottom();
			}, 100);
		}
	};

	const showPreviousMessage = async (message: ChatHistoryMessage): Promise<void> => {
		if (message.parentId !== null) {
			let messageId = (history.messages[message.parentId]?.childrenIds ?? [])[
				Math.max((history.messages[message.parentId]?.childrenIds ?? []).indexOf(message.id) - 1, 0)
			];

			if (message.id !== messageId) {
				messageId = getLastMessageId(history, messageId) ?? history.currentId!;

				history.currentId = messageId;
			}
		} else {
			let childrenIds = Object.values(history.messages)
				.filter((message) => message.parentId === null)
				.map((message) => message.id);
			let messageId = childrenIds[Math.max(childrenIds.indexOf(message.id) - 1, 0)];

			if (message.id !== messageId) {
				messageId = getLastMessageId(history, messageId) ?? history.currentId!;

				history.currentId = messageId;
			}
		}

		await tick();

		if ($settings?.scrollOnBranchChange ?? true) {
			const element = getMessagesContainer();
			autoScroll = element
				? element.scrollHeight - element.scrollTop <= element.clientHeight + 50
				: false;

			setTimeout(() => {
				scrollToBottom();
			}, 100);
		}
	};

	const showNextMessage = async (message: ChatHistoryMessage): Promise<void> => {
		if (message.parentId !== null) {
			let messageId = (history.messages[message.parentId]?.childrenIds ?? [])[
				Math.min(
					(history.messages[message.parentId]?.childrenIds ?? []).indexOf(message.id) + 1,
					(history.messages[message.parentId]?.childrenIds ?? []).length - 1
				)
			];

			if (message.id !== messageId) {
				messageId = getLastMessageId(history, messageId) ?? history.currentId!;

				history.currentId = messageId;
			}
		} else {
			let childrenIds = Object.values(history.messages)
				.filter((message) => message.parentId === null)
				.map((message) => message.id);
			let messageId =
				childrenIds[Math.min(childrenIds.indexOf(message.id) + 1, childrenIds.length - 1)];

			if (message.id !== messageId) {
				messageId = getLastMessageId(history, messageId) ?? history.currentId!;

				history.currentId = messageId;
			}
		}

		await tick();

		if ($settings?.scrollOnBranchChange ?? true) {
			const element = getMessagesContainer();
			autoScroll = element
				? element.scrollHeight - element.scrollTop <= element.clientHeight + 50
				: false;

			setTimeout(() => {
				scrollToBottom();
			}, 100);
		}
	};

	const rateMessage = async (messageId: string, rating: number): Promise<void> => {
		history.messages[messageId].annotation = {
			...history.messages[messageId].annotation,
			rating: rating
		};

		await updateChat();
	};

	// ponytail: retry IDs live with this component; persist drafts if retries must survive reload.
	const pendingCopyIds = new Map<string, string>();
	const savingMessageIds = new Set<string>();

	const editMessage = async (
		messageId: string,
		{ content, files, output = undefined }: ChatMessageEdit,
		submit = true
	): Promise<boolean> => {
		const message = history.messages[messageId];
		if (!message) return false;
		const sourceHistory = history;
		const sourceChatId = chatId;
		const currentId = history.currentId;
		const key = `${chatId}:${messageId}`;
		if (savingMessageIds.has(key)) return false;
		savingMessageIds.add(key);
		try {
			if (message.role === 'user' && submit) {
				if ((selectedModels ?? []).filter((id) => id).length === 0) {
					toast.error($i18n.t('Model not selected'));
					return false;
				}
				// New user message
				let userPrompt = content!;
				let userMessageId = uuidv4();

				let userMessage = {
					id: userMessageId,
					parentId: message.parentId,
					childrenIds: [],
					role: 'user',
					content: userPrompt,
					...(files && { files: files }),
					models: selectedModels,
					timestamp: Math.floor(Date.now() / 1000) // Unix epoch
				};

				let messageParentId = message.parentId;

				if (messageParentId !== null) {
					history.messages[messageParentId].childrenIds = [
						...history.messages[messageParentId].childrenIds,
						userMessageId
					];
				}

				history.messages[userMessageId] = userMessage;
				history.currentId = userMessageId;

				await tick();
				await sendMessage(history, userMessageId);
				return true;
			}

			const copy = message.role !== 'user' && submit;
			const editedId = copy ? (pendingCopyIds.get(key) ?? uuidv4()) : messageId;
			if (copy) pendingCopyIds.set(key, editedId);
			const changes: ChatMessageEdit & Pick<ChatHistoryMessage, 'originalContent'> =
				message.role === 'user'
					? { content: content!, files }
					: {
							...(content !== undefined ? { content, originalContent: message.content } : {}),
							...(output !== undefined ? { output, content: '' } : {})
						};
			const editedMessage: ChatHistoryMessage = {
				...message,
				...changes,
				...(copy
					? {
							id: editedId,
							childrenIds: [],
							files: undefined,
							originalContent: message.originalContent,
							timestamp: Math.floor(Date.now() / 1000)
						}
					: {})
			};
			let savedMessage = editedMessage;
			if (!$temporaryChatEnabled) {
				// The server already merges sparse history maps and rebuilds parent links.
				const res = await updateChatById(localStorage.token, sourceChatId, {
					history: {
						messages: { [editedId]: editedMessage },
						currentId: copy ? editedId : currentId
					},
					messages: createMessagesList(
						{ messages: { ...sourceHistory.messages, [editedId]: editedMessage } },
						copy ? editedId : currentId
					)
				});
				const saved = res?.chat?.history?.messages?.[editedId] as ChatHistoryMessage | undefined;
				if (!saved) throw new Error('Failed to save conversation');
				savedMessage = saved;
			}
			if (copy) pendingCopyIds.delete(key);

			if (chatId === sourceChatId && history === sourceHistory) {
				if (copy) {
					history.messages[editedId] = savedMessage;
					const parent = message.parentId !== null ? history.messages[message.parentId] : undefined;
					if (parent && !parent.childrenIds.includes(editedId)) {
						parent.childrenIds = [...parent.childrenIds, editedId];
					}
					if (history.currentId === currentId) history.currentId = editedId;
				} else if (history.messages[messageId]) {
					// Apply only edited fields; concurrent status/annotation and sibling updates survive.
					history.messages[messageId] = {
						...history.messages[messageId],
						...changes,
						...(changes.content !== undefined ? { content: savedMessage.content } : {}),
						...(output !== undefined ? { output: savedMessage.output } : {}),
						...(message.role === 'user' ? { files: savedMessage.files } : {})
					};
				}
				history = history;
				await tick();
				if (!$temporaryChatEnabled) {
					await refreshChatList(localStorage.token).catch(() => {
						console.warn('Failed to refresh chat list after saving');
					});
				}
			}
			return true;
		} finally {
			savingMessageIds.delete(key);
		}
	};

	const actionMessage = async (
		actionId: string,
		message: ChatHistoryMessage,
		event: unknown = null
	): Promise<void> => {
		await chatActionHandler(chatId, actionId, message.model, message.id, event);
	};

	const saveMessage = async (messageId: string, message: ChatHistoryMessage): Promise<void> => {
		if (!history.messages?.[messageId]) {
			return;
		}

		history.messages[messageId] = message;
		await updateChat();
	};

	const deleteMessage = async (messageId: string): Promise<void> => {
		const messageToDelete = history.messages[messageId];
		const parentMessageId = messageToDelete.parentId;
		const childMessageIds = messageToDelete.childrenIds ?? [];

		// Collect all grandchildren
		const grandchildrenIds = childMessageIds.flatMap(
			(childId) => history.messages[childId]?.childrenIds ?? []
		);

		// Update parent's children
		if (parentMessageId && history.messages[parentMessageId]) {
			history.messages[parentMessageId].childrenIds = [
				...history.messages[parentMessageId].childrenIds.filter((id) => id !== messageId),
				...grandchildrenIds
			];
		}

		// Update grandchildren's parent
		grandchildrenIds.forEach((grandchildId) => {
			if (history.messages[grandchildId]) {
				history.messages[grandchildId].parentId = parentMessageId;
			}
		});

		// Delete the message and its children
		[messageId, ...childMessageIds].forEach((id) => {
			delete history.messages[id];
		});

		history.currentId = getLastMessageId(history, parentMessageId);
		history = history;

		if (!$temporaryChatEnabled) {
			const res = await deleteChatMessageById(localStorage.token, chatId, messageId);
			if (res?.chat?.history) {
				history = res.chat.history;
			}

			await refreshChatList(localStorage.token);
		}
	};

	const triggerScroll = (): void => {
		if (autoScroll) {
			const element = getMessagesContainer();
			if (element) {
				autoScroll = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
				setTimeout(() => {
					scrollToBottom();
				}, 100);
			}
		}
	};
</script>

<div class={className}>
	{#if Object.keys(history?.messages ?? {}).length == 0}
		<ChatPlaceholder modelIds={selectedModels} {atSelectedModel} {onSelect} />
	{:else}
		<div class="w-full pt-2">
			{#key chatId}
				<section class="w-full" aria-labelledby="chat-conversation">
					<h2 class="sr-only" id="chat-conversation">{$i18n.t('Chat Conversation')}</h2>
					{#if messages.at(0)?.parentId !== null}
						<Loader
							on:visible={() => {
								console.log('visible');
								if (!messagesLoading) {
									loadMoreMessages();
								}
							}}
						>
							<div class="w-full flex justify-center py-1 text-xs animate-pulse items-center gap-2">
								<Spinner className=" size-4" />
								<div class=" ">{$i18n.t('Loading...')}</div>
							</div>
						</Loader>
					{/if}
					<ul role="log" aria-live="polite" aria-relevant="additions" aria-atomic="false">
						{#each messages as message, messageIdx (message.id)}
							<Message
								{chatId}
								bind:history
								{selectedModels}
								messageId={message.id}
								idx={messageIdx}
								{user}
								{setInputText}
								{gotoMessage}
								{showPreviousMessage}
								{showNextMessage}
								{updateChat}
								{editMessage}
								{deleteMessage}
								{rateMessage}
								{actionMessage}
								{saveMessage}
								{submitMessage}
								{regenerateResponse}
								{continueResponse}
								{mergeResponses}
								{addMessages}
								{forkHandler}
								{allowDelete}
								{triggerScroll}
								{readOnly}
								{compactPreview}
								{editCodeBlock}
								{topPadding}
								{onInsertToNote}
							/>
						{/each}
					</ul>
				</section>
				<div class="pb-18"></div>
				{#if bottomPadding}
					<div class="  pb-6"></div>
				{/if}
			{/key}
		</div>
	{/if}
</div>
