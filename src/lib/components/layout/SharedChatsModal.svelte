<script lang="ts">
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { SharedChatTitleResponse } from '$lib/utils/airis/frontend-contracts';
	import { toast } from 'svelte-sonner';
	import { getContext, onDestroy } from 'svelte';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	import { unshareAllChats, deleteSharedChatById, getSharedChatList } from '$lib/apis/chats';

	import ChatsModal from './ChatsModal.svelte';
	import UnshareAllConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import Spinner from '../common/Spinner.svelte';

	const i18n = getContext<Readable<I18n>>('i18n');

	export let show = false;
	export let onUpdate = () => {};

	let loading = false;
	let chatList: (SharedChatTitleResponse & { time_range: string })[] | null = null;
	let page = 1;

	let query = '';
	let orderBy = 'updated_at';
	let direction = 'desc';

	let allChatsLoaded = false;
	let chatListLoading = false;
	let chatListError: string | null = null;
	let searchDebounceTimeout: ReturnType<typeof setTimeout> | undefined;
	let requestGeneration = 0;
	let destroyed = false;

	let showUnshareAllConfirmDialog = false;

	let filter: { query?: string; order_by: string; direction: string };
	$: filter = {
		...(query ? { query } : {}),
		order_by: orderBy,
		direction
	};

	const isCurrent = (request: number, requestFilter: typeof filter): boolean =>
		!destroyed &&
		show &&
		request === requestGeneration &&
		query === (requestFilter.query ?? '') &&
		orderBy === requestFilter.order_by &&
		direction === requestFilter.direction;

	const searchHandler = async (open = show, requestFilter = filter): Promise<void> => {
		clearTimeout(searchDebounceTimeout);
		const request = ++requestGeneration;
		page = 1;
		chatList = null;
		chatListError = null;
		allChatsLoaded = false;
		chatListLoading = open && !destroyed;
		if (!open || destroyed) return;
		const fetchChats = async (): Promise<void> => {
			if (!isCurrent(request, requestFilter)) return;
			try {
				const results = await getSharedChatList(localStorage.token, 1, requestFilter);
				if (!isCurrent(request, requestFilter)) return;
				chatList = results;
				allChatsLoaded = results.length === 0;
			} catch (error) {
				if (isCurrent(request, requestFilter)) chatListError = getErrorMessage(error);
			} finally {
				if (isCurrent(request, requestFilter)) chatListLoading = false;
			}
		};
		if (query) {
			searchDebounceTimeout = setTimeout(() => {
				void fetchChats();
			}, 500);
		} else {
			await fetchChats();
		}
	};

	const loadMoreChats = async (): Promise<void> => {
		if (
			!show ||
			destroyed ||
			chatList === null ||
			chatListLoading ||
			allChatsLoaded ||
			chatListError
		)
			return;
		const request = requestGeneration;
		const requestFilter = { ...filter };
		const nextPage = page + 1;
		chatListLoading = true;
		try {
			const results = await getSharedChatList(localStorage.token, nextPage, requestFilter);
			if (!isCurrent(request, requestFilter)) return;
			const existingIds = new Set((chatList ?? []).map((chat) => chat.id));
			chatList = [...(chatList ?? []), ...results.filter((chat) => !existingIds.has(chat.id))];
			page = nextPage;
			allChatsLoaded = results.length === 0;
		} catch (error) {
			if (isCurrent(request, requestFilter)) chatListError = getErrorMessage(error);
		} finally {
			if (isCurrent(request, requestFilter)) chatListLoading = false;
		}
	};

	const retryHandler = (): void => {
		chatListError = null;
		if (chatList === null) void searchHandler();
		else void loadMoreChats();
	};

	onDestroy(() => {
		destroyed = true;
		requestGeneration += 1;
		clearTimeout(searchDebounceTimeout);
	});

	$: searchHandler(show, filter);
	const unshareHandler = async (chatId: string): Promise<void> => {
		const res = await deleteSharedChatById(localStorage.token, chatId).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res === true) {
			toast.success($i18n.t('Chat unshared successfully.'));
			onUpdate();
			searchHandler();
		} else if (res === false) {
			toast.error($i18n.t('Failed to unshare chat.'));
		}
	};

	const unshareAllHandler = async (): Promise<void> => {
		loading = true;
		try {
			await unshareAllChats(localStorage.token);
			toast.success($i18n.t('All shared chats have been unshared.'));
			onUpdate();
			await searchHandler();
		} catch (error) {
			toast.error(`${error}`);
		} finally {
			loading = false;
		}
	};
</script>

<UnshareAllConfirmDialog
	bind:show={showUnshareAllConfirmDialog}
	message={$i18n.t(
		'Are you sure you want to unshare all shared chats? This will remove all share links.'
	)}
	confirmLabel={$i18n.t('Unshare All')}
	on:confirm={() => {
		unshareAllHandler();
	}}
/>

<ChatsModal
	bind:show
	bind:query
	bind:orderBy
	bind:direction
	title={$i18n.t('Shared Chats')}
	emptyPlaceholder={$i18n.t('You have no shared conversations.')}
	shareUrl={false}
	{chatList}
	{allChatsLoaded}
	{chatListLoading}
	{chatListError}
	{retryHandler}
	onUpdate={() => {
		onUpdate();
		searchHandler();
	}}
	loadHandler={loadMoreChats}
	{unshareHandler}
>
	<div slot="footer">
		<div class="flex flex-wrap text-sm font-normal gap-1.5 mt-2 m-1 justify-end w-full">
			<button
				class=" px-3.5 py-1.5 font-normal hover:bg-black/5 dark:hover:bg-white/5 outline outline-1 outline-gray-100 dark:outline-gray-800 rounded-3xl"
				disabled={loading}
				on:click={() => {
					showUnshareAllConfirmDialog = true;
				}}
			>
				{#if loading}
					<Spinner className="size-4" />
				{:else}
					{$i18n.t('Unshare All Shared Chats')}
				{/if}
			</button>
		</div>
	</div>
</ChatsModal>
