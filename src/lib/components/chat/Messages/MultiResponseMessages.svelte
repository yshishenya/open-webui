<script lang="ts">
	import { onMount, tick, getContext } from 'svelte';

	import { mobile, models, settings } from '$lib/stores';

	import ResponseMessage from './ResponseMessage.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Merge from '$lib/components/icons/Merge.svelte';

	import Markdown from './Markdown.svelte';
	import Name from './Name.svelte';
	import Skeleton from './Skeleton.svelte';
	import equal from 'fast-deep-equal';
	import { formatMessageTimestamp, formatMessageTimestampFull } from '$lib/utils';
	import type { Writable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import { getLastMessageId } from '$lib/utils/airis/chat_history';
	import type {
		ChatHistory,
		ChatHistoryMessage,
		ChatMessageEdit
	} from '$lib/utils/airis/chat_history';
	const i18n = getContext<Writable<I18n>>('i18n');

	export let chatId: string;
	export let history: ChatHistory;
	export let messageId: string;
	export let selectedModels: string[] = [];

	export let isLastMessage: boolean;
	export let readOnly = false;
	export let allowDelete = true;
	export let compactPreview = false;
	export let editCodeBlock = true;

	export let setInputText: (text: string) => void = () => {};
	export let updateChat: () => void | Promise<void>;
	export let editMessage: (
		id: string,
		edit: ChatMessageEdit,
		submit?: boolean
	) => void | Promise<void>;
	export let saveMessage: (id: string, message: ChatHistoryMessage) => void | Promise<void>;
	export let rateMessage: (id: string, rating: number) => void | Promise<void>;
	export let actionMessage: (
		actionId: string,
		message: ChatHistoryMessage,
		event?: unknown
	) => void | Promise<void>;

	export let submitMessage: (id: string, prompt: string) => void | Promise<void>;
	export let deleteMessage: (id: string) => void | Promise<void>;

	export let continueResponse: () => void | Promise<void>;
	export let regenerateResponse: (
		message: ChatHistoryMessage,
		prompt?: string | null
	) => void | Promise<void>;
	export let mergeResponses: (
		id: string,
		responses: string[],
		chatId: string
	) => void | Promise<void>;

	export let addMessages: (request: {
		modelId: string;
		parentId: string | null;
		messages: ChatHistoryMessage[];
	}) => void | Promise<void>;
	export let forkHandler: ((messageId?: string | null) => void | Promise<void>) | null = null;

	export let triggerScroll: () => void;

	export let topPadding = false;
	export let onInsertToNote: ((content: string) => void) | null = null;

	let parentMessage: ChatHistoryMessage | null | undefined;
	let groupedMessageIds: Record<number, { messageIds: string[] }> = {};
	let groupedMessageIdsIdx: Record<number, number> = {};

	let selectedModelIdx: number | null | undefined = null;

	let message = structuredClone(history.messages[messageId]);
	$: if (history.messages) {
		const source = history.messages[messageId];
		if (source) {
			if (message.content !== source.content || message.done !== source.done) {
				message = structuredClone(source);
			} else if (!equal(message, source)) {
				message = structuredClone(source);
			}
		}
	}

	const gotoMessage = async (modelIdx: number, messageIdx: number): Promise<void> => {
		// Clamp messageIdx to ensure it's within valid range
		groupedMessageIdsIdx[modelIdx] = Math.max(
			0,
			Math.min(messageIdx, groupedMessageIds[modelIdx].messageIds.length - 1)
		);

		// Get the messageId at the specified index
		let messageId = groupedMessageIds[modelIdx].messageIds[groupedMessageIdsIdx[modelIdx]];
		console.log(messageId);

		// Traverse the branch to find the deepest child message
		messageId = getLastMessageId(history, messageId) ?? history.currentId!;

		// Update the current message ID in history
		history.currentId = messageId;

		// Await UI updates
		await tick();
		await updateChat();

		// Trigger scrolling after navigation
		triggerScroll();
	};

	const showPreviousMessage = async (modelIdx: number): Promise<void> => {
		groupedMessageIdsIdx[modelIdx] = Math.max(0, groupedMessageIdsIdx[modelIdx] - 1);

		let messageId = groupedMessageIds[modelIdx].messageIds[groupedMessageIdsIdx[modelIdx]];
		console.log(messageId);

		messageId = getLastMessageId(history, messageId) ?? history.currentId!;

		history.currentId = messageId;

		await tick();
		await updateChat();
		triggerScroll();
	};

	const showNextMessage = async (modelIdx: number): Promise<void> => {
		groupedMessageIdsIdx[modelIdx] = Math.min(
			groupedMessageIds[modelIdx].messageIds.length - 1,
			groupedMessageIdsIdx[modelIdx] + 1
		);

		let messageId = groupedMessageIds[modelIdx].messageIds[groupedMessageIdsIdx[modelIdx]];
		console.log(messageId);

		messageId = getLastMessageId(history, messageId) ?? history.currentId!;

		history.currentId = messageId;

		await tick();
		await updateChat();
		triggerScroll();
	};

	const initHandler = async (): Promise<void> => {
		console.log('multiresponse:initHandler');
		await tick();

		parentMessage = history.messages[messageId].parentId
			? history.messages[history.messages[messageId].parentId!]
			: null;

		groupedMessageIds = (parentMessage?.models ?? []).reduce(
			(a, model, modelIdx) => {
				// Find all messages that are children of the parent message and have the same model
				let modelMessageIds = (parentMessage?.childrenIds ?? [])
					.map((id) => history.messages[id])
					.filter((m) => m?.modelIdx === modelIdx)
					.map((m) => m.id);

				// Legacy support for messages that don't have a modelIdx
				// Find all messages that are children of the parent message and have the same model
				if (modelMessageIds.length === 0) {
					let modelMessages = (parentMessage?.childrenIds ?? [])
						.map((id) => history.messages[id])
						.filter((m) => m?.model === model);

					modelMessages.forEach((m) => {
						m.modelIdx = modelIdx;
					});

					modelMessageIds = modelMessages.map((m) => m.id);
				}

				return {
					...a,
					[modelIdx]: { messageIds: modelMessageIds }
				};
			},
			{} as Record<number, { messageIds: string[] }>
		);

		groupedMessageIdsIdx = (parentMessage?.models ?? []).reduce(
			(a, model, modelIdx) => {
				const idx = groupedMessageIds[modelIdx].messageIds.findIndex((id) => id === messageId);
				if (idx !== -1) {
					return {
						...a,
						[modelIdx]: idx
					};
				} else {
					return {
						...a,
						[modelIdx]: groupedMessageIds[modelIdx].messageIds.length - 1
					};
				}
			},
			{} as Record<number, number>
		);

		selectedModelIdx = history.messages[messageId]?.modelIdx;

		console.log(groupedMessageIds, groupedMessageIdsIdx);

		await tick();
	};

	const onGroupClick = async (_messageId: string, modelIdx: number): Promise<void> => {
		if (messageId != _messageId) {
			history.currentId = getLastMessageId(history, _messageId) ?? history.currentId;
			selectedModelIdx = modelIdx;

			// await tick();
			// await updateChat();
			// triggerScroll();
		}
	};

	const mergeResponsesHandler = async (): Promise<void> => {
		const responses = Object.keys(groupedMessageIds)
			.map(Number)
			.map((modelIdx) => {
				const { messageIds } = groupedMessageIds[modelIdx];
				const messageId = messageIds[groupedMessageIdsIdx[modelIdx]];

				return history.messages[messageId].content ?? '';
			});
		mergeResponses(messageId, responses, chatId);
	};

	onMount(async () => {
		await initHandler();
		await tick();

		if ($settings?.scrollOnBranchChange ?? true) {
			const messageElement = document.getElementById(`message-${messageId}`);
			if (messageElement) {
				messageElement.scrollIntoView({ block: 'start' });
			}
		}
	});
</script>

{#if parentMessage}
	<div>
		<div
			class="flex snap-x snap-mandatory overflow-x-auto scrollbar-hidden"
			id="responses-container-{chatId}-{parentMessage.id}"
		>
			{#if $settings?.displayMultiModelResponsesInTabs ?? false}
				<div class="w-full">
					<div
						class=" flex w-full mb-4.5 border-b border-gray-200 dark:border-gray-850 {compactPreview
							? 'hidden'
							: ''}"
					>
						<div
							class="flex gap-2 scrollbar-none overflow-x-auto w-fit text-center font-normal bg-transparent pt-1 text-sm"
							on:wheel|preventDefault={(e) => {
								e.currentTarget.scrollLeft += e.deltaY;
							}}
						>
							{#each Object.keys(groupedMessageIds).map(Number) as modelIdx}
								{#if groupedMessageIdsIdx[modelIdx] !== undefined && (groupedMessageIds[modelIdx]?.messageIds ?? []).length > 0}
									{@const _messageId =
										groupedMessageIds[modelIdx].messageIds[groupedMessageIdsIdx[modelIdx]]}

									{@const model = $models.find((m) => m.id === history.messages[_messageId]?.model)}

									<button
										class="min-w-fit {selectedModelIdx == modelIdx
											? ' dark:border-gray-300 '
											: ' opacity-35 border-transparent'} pb-1.5 px-2.5 transition border-b-2"
										on:click={async () => {
											if (selectedModelIdx != modelIdx) {
												selectedModelIdx = modelIdx;
											}

											onGroupClick(_messageId, modelIdx);
										}}
									>
										<div class="flex items-center gap-1.5">
											<div class="-translate-y-[1px]">
												{model ? `${model.name}` : history.messages[_messageId]?.model}
											</div>
										</div>
									</button>
								{/if}
							{/each}
						</div>
					</div>

					{#if selectedModelIdx != null}
						{#key history.currentId}
							{#if message}
								<ResponseMessage
									{chatId}
									{history}
									messageId={message?.id}
									{selectedModels}
									isLastMessage={true}
									siblings={groupedMessageIds[selectedModelIdx].messageIds}
									gotoMessage={(message, messageIdx) => gotoMessage(selectedModelIdx!, messageIdx)}
									showPreviousMessage={() => showPreviousMessage(selectedModelIdx!)}
									showNextMessage={() => showNextMessage(selectedModelIdx!)}
									{setInputText}
									{updateChat}
									{editMessage}
									{saveMessage}
									{rateMessage}
									{deleteMessage}
									{actionMessage}
									{submitMessage}
									{continueResponse}
									regenerateResponse={async (message, prompt = null) => {
										regenerateResponse(message, prompt);
										await tick();
										groupedMessageIdsIdx[selectedModelIdx!] =
											groupedMessageIds[selectedModelIdx!].messageIds.length - 1;
									}}
									{addMessages}
									{forkHandler}
									{readOnly}
									{compactPreview}
									{topPadding}
									{onInsertToNote}
								/>
							{/if}
						{/key}
					{/if}
				</div>
			{:else}
				{#each Object.keys(groupedMessageIds).map(Number) as modelIdx}
					{#if groupedMessageIdsIdx[modelIdx] !== undefined && groupedMessageIds[modelIdx].messageIds.length > 0}
						{@const _messageId =
							groupedMessageIds[modelIdx].messageIds[groupedMessageIdsIdx[modelIdx]]}

						<div
							class="snap-center w-full max-w-full transition-all {compactPreview
								? ''
								: `m-1 border p-5 rounded-2xl ${
										history.messages[messageId]?.modelIdx == modelIdx
											? `bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 border-2 ${
													$mobile ? 'min-w-full' : 'min-w-80'
												}`
											: `border-gray-100/30 dark:border-gray-850/30 border-dashed ${
													$mobile ? 'min-w-full' : 'min-w-80'
												}`
									}`}"
							role="button"
							tabindex="0"
							on:keydown={(event) => {
								if (
									event.target === event.currentTarget &&
									(event.key === 'Enter' || event.key === ' ')
								) {
									event.preventDefault();
									onGroupClick(_messageId, modelIdx);
								}
							}}
							on:click={async () => {
								onGroupClick(_messageId, modelIdx);
							}}
						>
							{#key history.currentId}
								{#if message}
									<ResponseMessage
										{chatId}
										{history}
										messageId={_messageId}
										{selectedModels}
										isLastMessage={true}
										siblings={groupedMessageIds[modelIdx].messageIds}
										gotoMessage={(message, messageIdx) => gotoMessage(modelIdx, messageIdx)}
										showPreviousMessage={() => showPreviousMessage(modelIdx)}
										showNextMessage={() => showNextMessage(modelIdx)}
										{setInputText}
										{updateChat}
										{editMessage}
										{saveMessage}
										{rateMessage}
										{deleteMessage}
										{allowDelete}
										{actionMessage}
										{submitMessage}
										{continueResponse}
										regenerateResponse={async (message, prompt = null) => {
											regenerateResponse(message, prompt);
											await tick();
											groupedMessageIdsIdx[modelIdx] =
												groupedMessageIds[modelIdx].messageIds.length - 1;
										}}
										{addMessages}
										{forkHandler}
										{readOnly}
										{compactPreview}
										{editCodeBlock}
										{topPadding}
										{onInsertToNote}
									/>
								{/if}
							{/key}
						</div>
					{/if}
				{/each}
			{/if}
		</div>

		{#if !compactPreview && !readOnly}
			{#if !Object.keys(groupedMessageIds)
				.map(Number)
				.find((modelIdx) => {
					const { messageIds } = groupedMessageIds[modelIdx];
					const _messageId = messageIds[groupedMessageIdsIdx[modelIdx]];
					return !history.messages[_messageId]?.done;
				})}
				<div class="flex justify-end">
					<div class="w-full">
						{#if history.messages[messageId]?.merged?.status}
							{@const message = history.messages[messageId].merged!}

							<div class="w-full rounded-xl pl-5 pr-2 py-2 mt-2">
								<Name>
									{$i18n.t('Merged Response')}
								</Name>

								<div class="mt-1 w-full min-w-full">
									{#if (message?.content ?? '') === ''}
										<Skeleton />
									{:else}
										<div class="markdown-prose">
											<Markdown id={`merged`} content={message.content ?? ''} />
										</div>
									{/if}
								</div>

								{#if message.timestamp}
									<div
										class="mt-0.5 flex justify-start whitespace-nowrap text-gray-600 dark:text-gray-500"
									>
										<Tooltip
											className="flex self-center"
											content={formatMessageTimestampFull(message.timestamp * 1000)}
											placement="bottom"
										>
											<time
												datetime={new Date(message.timestamp * 1000).toISOString()}
												class="invisible group-hover:visible ml-1 shrink-0 whitespace-nowrap text-[0.6875rem] tabular-nums text-gray-400 dark:text-gray-600 select-none"
											>
												{formatMessageTimestamp(message.timestamp * 1000)}
											</time>
										</Tooltip>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					{#if isLastMessage}
						<div class=" shrink-0 text-gray-600 dark:text-gray-500 mt-1">
							<Tooltip content={$i18n.t('Merge Responses')} placement="bottom">
								<button
									type="button"
									id="merge-response-button"
									class="visible p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg dark:hover:text-white hover:text-black transition"
									on:click={() => {
										mergeResponsesHandler();
									}}
								>
									<Merge className=" size-5 " />
								</button>
							</Tooltip>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
{/if}
