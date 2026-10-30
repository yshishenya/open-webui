<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import type { ChatHistory } from '$lib/utils/airis/chat_history';
	import { settings } from '$lib/stores';

	import MultiResponseMessages from './MultiResponseMessages.svelte';
	import ResponseMessage from './ResponseMessage.svelte';
	import UserMessage from './UserMessage.svelte';

	type ResponseProps = ComponentProps<typeof ResponseMessage>;
	type MultiResponseProps = ComponentProps<typeof MultiResponseMessages>;
	export let chatId: string;
	export let selectedModels: string[] = [];
	export let idx = 0;

	export let history: ChatHistory;
	export let messageId: string;

	export let user: ComponentProps<typeof UserMessage>['user'];

	export let setInputText: (text: string) => void = () => {};
	export let gotoMessage: ComponentProps<typeof UserMessage>['gotoMessage'];
	export let showPreviousMessage: ResponseProps['showPreviousMessage'];
	export let showNextMessage: ResponseProps['showNextMessage'];
	export let updateChat: ResponseProps['updateChat'];

	export let editMessage: ResponseProps['editMessage'];
	export let saveMessage: ResponseProps['saveMessage'];
	export let deleteMessage: ResponseProps['deleteMessage'];
	export let rateMessage: ResponseProps['rateMessage'];
	export let actionMessage: ResponseProps['actionMessage'];
	export let submitMessage: ResponseProps['submitMessage'];

	export let regenerateResponse: ResponseProps['regenerateResponse'];
	export let continueResponse: ResponseProps['continueResponse'];
	export let mergeResponses: MultiResponseProps['mergeResponses'];

	export let addMessages;
	export let onToolCallResolved: ComponentProps<typeof ResponseMessage>['onToolCallResolved'] = () => {};
	export let forkHandler: ComponentProps<typeof ResponseMessage>['forkHandler'] = null;
	export let triggerScroll;
	export let readOnly = false;
	export let shareMode: 'view' | 'continue' | null = null;
	export let allowDelete = true;
	export let compactPreview = false;
	export let editCodeBlock = true;
	export let topPadding = false;
	export let onInsertToNote: ((content: string) => void) | null = null;

	// Keep the latest turn's real height when assigning a chat ID remounts the message list.
	$: isCurrentTurn =
		messageId === history.currentId || messageId === history.messages[history.currentId ?? '']?.parentId;

	// WebKit's content-visibility implementation has paint bugs that leave
	// on-screen messages blank (#26712), so skip virtualization there
	// iOS WebViews and home screen apps carry no Safari token, hence the vendor check
	const isWebKit =
		navigator.vendor === 'Apple Computer, Inc.' ||
		/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
</script>

<div
	role="listitem"
	class="flex flex-col justify-between px-3.5 mb-3 w-full {($settings?.widescreenMode ?? null)
		? 'max-w-full'
		: 'max-w-[58rem]'} mx-auto rounded-lg group message-listitem"
	class:message-virtualized={!isWebKit && !isCurrentTurn}
>
	{#if history.messages[messageId]}
		{#if history.messages[messageId].role === 'user'}
			<UserMessage
				{user}
				{chatId}
				{history}
				{messageId}
				isFirstMessage={idx === 0}
				siblings={history.messages[messageId].parentId !== null
					? (history.messages[history.messages[messageId].parentId!]?.childrenIds ?? [])
					: (Object.values(history.messages)
							.filter((message) => message.parentId === null)
							.map((message) => message.id) ?? [])}
				{gotoMessage}
				{showPreviousMessage}
				{showNextMessage}
				{editMessage}
				{deleteMessage}
				{allowDelete}
				{readOnly}
				{shareMode}
				{compactPreview}
				{editCodeBlock}
				{topPadding}
			/>
		{:else if compactPreview || (history.messages[history.messages[messageId].parentId!]?.models?.length ?? 1) === 1}
			<ResponseMessage
				{chatId}
				{history}
				{messageId}
				{selectedModels}
				isLastMessage={messageId === history.currentId}
				siblings={history.messages[history.messages[messageId].parentId!]?.childrenIds ?? []}
				{setInputText}
				{gotoMessage}
				{showPreviousMessage}
				{showNextMessage}
				{updateChat}
				{editMessage}
				{saveMessage}
				{rateMessage}
				{actionMessage}
				{submitMessage}
				{deleteMessage}
				{allowDelete}
				{continueResponse}
				{regenerateResponse}
				{addMessages}
				{onToolCallResolved}
				{forkHandler}
				{readOnly}
				{compactPreview}
				{editCodeBlock}
				{topPadding}
				{onInsertToNote}
				{shareMode}
			/>
		{:else}
			{#key messageId}
				<MultiResponseMessages
					bind:history
					{chatId}
					{messageId}
					{selectedModels}
					isLastMessage={messageId === history?.currentId}
					{setInputText}
					{updateChat}
					{editMessage}
					{saveMessage}
					{rateMessage}
					{actionMessage}
					{submitMessage}
					{deleteMessage}
					{allowDelete}
					{continueResponse}
					{regenerateResponse}
					{mergeResponses}
					{triggerScroll}
					{addMessages}
					{onToolCallResolved}
					{forkHandler}
					{readOnly}
					{compactPreview}
					{editCodeBlock}
					{topPadding}
					{onInsertToNote}
					{shareMode}
				/>
			{/key}
		{/if}
	{/if}
</div>

<style>
	/* Browser-native virtualization: skip rendering of off-screen messages
	   without destroying their component trees. Replaces the JS-based
	   culling that caused catastrophic mount/destroy thrashing. */
	.message-virtualized {
		content-visibility: auto;
		contain-intrinsic-size: auto 150px;
	}
</style>
