<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { AdminUser } from '$lib/apis/users';
	import type { ChatTitleIdResponse } from '$lib/utils/airis/frontend-contracts';

	import dayjs from 'dayjs';
	import localizedFormat from 'dayjs/plugin/localizedFormat';

	dayjs.extend(localizedFormat);

	import { getChatListByUserId } from '$lib/apis/chats';

	import ChatsModal from '$lib/components/layout/ChatsModal.svelte';

	const i18n = getContext<Readable<I18n>>('i18n');

	export let show = false;
	export let user: Pick<AdminUser, 'id' | 'name'>;

	let chatList: (ChatTitleIdResponse & { time_range: string })[] | null = null;
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

	let filter: { query?: string; order_by: string; direction: string };
	$: filter = {
		...(query ? { query } : {}),
		order_by: orderBy,
		direction
	};

	const isCurrent = (request: number, requestFilter: typeof filter, userId: string): boolean =>
		!destroyed &&
		show &&
		request === requestGeneration &&
		user.id === userId &&
		query === (requestFilter.query ?? '') &&
		orderBy === requestFilter.order_by &&
		direction === requestFilter.direction;

	const searchHandler = async (
		open = show,
		requestFilter = filter,
		userId = user.id
	): Promise<void> => {
		clearTimeout(searchDebounceTimeout);
		const request = ++requestGeneration;
		page = 1;
		chatList = null;
		chatListError = null;
		allChatsLoaded = false;
		chatListLoading = open && !destroyed;
		if (!open || destroyed) return;
		const fetchChats = async (): Promise<void> => {
			if (!isCurrent(request, requestFilter, userId)) return;
			try {
				const results = await getChatListByUserId(localStorage.token, userId, 1, requestFilter);
				if (!isCurrent(request, requestFilter, userId)) return;
				chatList = results;
				allChatsLoaded = results.length === 0;
			} catch (error) {
				if (isCurrent(request, requestFilter, userId)) chatListError = getErrorMessage(error);
			} finally {
				if (isCurrent(request, requestFilter, userId)) chatListLoading = false;
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
		const userId = user.id;
		const nextPage = page + 1;
		chatListLoading = true;
		try {
			const results = await getChatListByUserId(
				localStorage.token,
				userId,
				nextPage,
				requestFilter
			);
			if (!isCurrent(request, requestFilter, userId)) return;
			const existingIds = new Set((chatList ?? []).map((chat) => chat.id));
			chatList = [...(chatList ?? []), ...results.filter((chat) => !existingIds.has(chat.id))];
			page = nextPage;
			allChatsLoaded = results.length === 0;
		} catch (error) {
			if (isCurrent(request, requestFilter, userId)) chatListError = getErrorMessage(error);
		} finally {
			if (isCurrent(request, requestFilter, userId)) chatListLoading = false;
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

	$: searchHandler(show, filter, user.id);
</script>

<ChatsModal
	bind:show
	bind:query
	bind:orderBy
	bind:direction
	title={$i18n.t("{{user}}'s Chats", {
		user: user.name.length > 32 ? `${user.name.slice(0, 32)}...` : user.name
	})}
	emptyPlaceholder={$i18n.t('No chats found for this user.')}
	shareUrl={true}
	{chatList}
	{allChatsLoaded}
	{chatListLoading}
	{chatListError}
	{retryHandler}
	onUpdate={() => {
		searchHandler();
	}}
	loadHandler={loadMoreChats}
></ChatsModal>
