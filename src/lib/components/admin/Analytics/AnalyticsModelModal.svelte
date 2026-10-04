<script lang="ts">
	import Modal from '$lib/components/common/Modal.svelte';
	import { getContext, onDestroy } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';
	import { getModelChats, getModelOverview } from '$lib/apis/analytics';
	import ModelActivityChart from '$lib/components/admin/Evaluations/ModelActivityChart.svelte';
	import ChatList from '$lib/components/common/ChatList.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import { config } from '$lib/stores';

	export let show = false;
	export let model: { id: string; name: string } | null = null;
	export let startDate: number | null = null;
	export let endDate: number | null = null;
	export let groupId: string | null = null;
	export let onClose: () => void = () => {};

	const i18n = getContext<Readable<I18nType>>('i18n');

	type Tab = 'overview' | 'chats';
	type ChatSortKey = 'title' | 'updated_at' | 'user_name';
	let selectedTab: Tab = 'overview';

	let history: Array<{ date: string; won: number; lost: number }> = [];
	let tags: Array<{ tag: string; count: number }> = [];
	let loadingOverview = false;
	let overviewError = '';
	let chatsError = '';
	let overviewGeneration = 0;
	let chatsGeneration = 0;
	type ModelChat = {
		chat_id: string;
		first_message?: string;
		updated_at: number;
		user_id?: string;
		user_name?: string;
	};
	const preview = (chat: ModelChat) => ({
		id: chat.chat_id,
		title: chat.first_message || 'Без текста для предпросмотра',
		updated_at: chat.updated_at,
		user_id: chat.user_id,
		user_name: chat.user_name
	});
	// Chats tab state
	let chatList: Array<{
		id: string;
		title: string;
		updated_at: number;
		user_id?: string;
		user_name?: string;
	}> = [];
	let chatListLoading = false;
	let allChatsLoaded = false;
	let chatsOffset = 0;
	let chatOrderBy: ChatSortKey = 'updated_at';
	let chatDirection: 'asc' | 'desc' = 'desc';
	const PAGE_SIZE = 50;

	const close = (): void => {
		show = false;
		onClose();
	};
	const loadOverview = async (): Promise<void> => {
		if (!model?.id) return;
		const current = ++overviewGeneration;
		loadingOverview = true;
		overviewError = '';
		history = [];
		tags = [];
		try {
			const result = await getModelOverview(
				localStorage.token,
				model.id,
				0,
				startDate,
				endDate,
				groupId
			);
			if (current !== overviewGeneration) return;
			if (!result) throw new Error('Не удалось загрузить данные');
			history = result.history;
			tags = result.tags;
		} catch {
			if (current === overviewGeneration)
				overviewError = 'Не удалось загрузить оценки и темы. Повторите попытку.';
		} finally {
			if (current === overviewGeneration) loadingOverview = false;
		}
	};
	const loadChats = async (more = false): Promise<void> => {
		if (!model?.id || (more && (chatListLoading || allChatsLoaded))) return;
		const current = ++chatsGeneration;
		if (!more) {
			chatList = [];
			chatsOffset = 0;
			allChatsLoaded = false;
		}
		chatListLoading = true;
		chatsError = '';
		try {
			const result = await getModelChats(
				localStorage.token,
				model.id,
				startDate,
				endDate,
				chatsOffset,
				PAGE_SIZE,
				chatOrderBy,
				chatDirection,
				groupId
			);
			if (current !== chatsGeneration) return;
			if (!result) throw new Error('Не удалось загрузить чаты');
			chatsOffset += result.chats.length;
			const existingIds = new Set(chatList.map((chat) => chat.id));
			const next = (result.chats as ModelChat[])
				.map(preview)
				.filter((chat) => !existingIds.has(chat.id));
			chatList = [...chatList, ...next];
			allChatsLoaded = chatsOffset >= result.total || result.chats.length < PAGE_SIZE;
		} catch {
			if (current === chatsGeneration) chatsError = 'Не удалось загрузить чаты. Повторите попытку.';
		} finally {
			if (current === chatsGeneration) chatListLoading = false;
		}
	};
	const loadMoreChats = (): void => {
		void loadChats(true);
	};
	const setChatSort = (key: ChatSortKey) => {
		if (chatOrderBy === key) {
			chatDirection = chatDirection === 'asc' ? 'desc' : 'asc';
		} else {
			chatOrderBy = key;
			chatDirection = key === 'updated_at' ? 'desc' : 'asc';
		}
		loadChats();
	};

	const selectTab = (tab: Tab) => {
		selectedTab = tab;
		if (tab === 'chats' && chatList.length === 0) {
			loadChats();
		}
	};

	const reset = (): void => {
		++chatsGeneration;
		selectedTab = 'overview';
		chatList = [];
		chatsOffset = 0;
		allChatsLoaded = false;
		chatListLoading = false;
		chatsError = '';
		chatOrderBy = 'updated_at';
		chatDirection = 'desc';
		void loadOverview();
	};
	const invalidate = (): void => {
		++overviewGeneration;
		++chatsGeneration;
	};
	onDestroy(invalidate);
	$: context = `${model?.id || ''}:${startDate}:${endDate}:${groupId}`;
	$: if (show && model?.id && context) reset();
	else invalidate();
</script>

<Modal size="md" bind:show>
	{#if model}
		<div class="flex justify-between dark:text-gray-300 px-4 pt-3 pb-1">
			<Tooltip content={`${model.name} (${model.id})`} placement="top-start">
				<div class="text-sm font-medium self-center line-clamp-1">
					{model.name}
				</div>
			</Tooltip>
			<button
				class="min-h-11 min-w-11 flex items-center justify-center self-center rounded-lg p-1 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
				on:click={close}
				aria-label={$i18n.t('Close')}
			>
				<XMark className={'size-4'} />
			</button>
		</div>

		<p class="px-5 py-2 text-xs text-gray-600 dark:text-gray-300">
			Период исходного отчёта: {startDate === null
				? 'всё время'
				: new Date(startDate * 1000).toISOString().slice(0, 10)}{endDate === null
				? ''
				: ` — ${new Date((endDate - 1) * 1000).toISOString().slice(0, 10)}`} · UTC · {groupId
				? 'Выбранная группа'
				: 'Все пользователи'}
		</p>
		<!-- Tabs -->
		<div class="px-5 border-b border-gray-100 dark:border-gray-850">
			<div class="flex gap-4">
				<button
					class="min-h-11 py-2 text-sm font-normal border-b-2 transition-colors {selectedTab ===
					'overview'
						? 'border-black dark:border-white text-gray-900 dark:text-white'
						: 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}"
					on:click={() => selectTab('overview')}
				>
					{$i18n.t('Overview')}
				</button>
				{#if $config?.features?.enable_admin_chat_access}
					<button
						class="min-h-11 py-2 text-sm font-normal border-b-2 transition-colors {selectedTab ===
						'chats'
							? 'border-black dark:border-white text-gray-900 dark:text-white'
							: 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}"
						on:click={() => selectTab('chats')}
					>
						{$i18n.t('Chats')}
					</button>
				{/if}
			</div>
		</div>

		<div class="px-5 pb-4 dark:text-gray-200">
			{#if selectedTab === 'overview'}
				{#if overviewError}<p role="alert" class="mt-3 text-sm text-red-700 dark:text-red-300">
						{overviewError} <button class="underline" on:click={loadOverview}>Повторить</button>
					</p>{/if}
				<!-- Activity Chart -->
				<div class="mb-4 mt-3">
					<div class="flex items-center justify-between mb-2">
						<Tooltip content={$i18n.t('Thumbs up/down ratings from users on model responses')}>
							<div class="text-xs text-gray-500 font-normal uppercase tracking-wide cursor-help">
								{$i18n.t('Feedback Activity')}
							</div>
						</Tooltip>
					</div>
					<ModelActivityChart {history} loading={loadingOverview} aggregateWeekly={false} />
				</div>

				<!-- Tags -->
				<div class="mb-4">
					<div class="text-xs text-gray-500 mb-2 font-normal uppercase tracking-wide">
						{$i18n.t('Tags')}
					</div>
					{#if tags.length}
						<div class="flex flex-wrap gap-1 -mx-1">
							{#each tags as tagInfo}
								<span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-850 text-xs">
									{tagInfo.tag} <span class="text-gray-500 font-normal">{tagInfo.count}</span>
								</span>
							{/each}
						</div>
					{:else}
						<span class="text-gray-500 text-sm">-</span>
					{/if}
				</div>
			{:else if selectedTab === 'chats'}
				<div class="mt-3">
					{#if chatsError}<p role="alert" class="mb-3 text-sm text-red-700 dark:text-red-300">
							{chatsError}
							<button class="underline" on:click={() => loadChats(chatList.length > 0)}
								>Повторить</button
							>
						</p>{/if}
					<ChatList
						{chatList}
						loading={chatListLoading}
						allLoaded={allChatsLoaded}
						showUserInfo={true}
						shareUrl={true}
						orderBy={chatOrderBy}
						direction={chatDirection}
						onSort={setChatSort}
						onLoadMore={loadMoreChats}
						onChatClick={() => (show = false)}
					/>
				</div>
			{/if}

			<div class="flex justify-end pt-4">
				<button
					class="min-h-11 px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
					type="button"
					on:click={close}
				>
					{$i18n.t('Close')}
				</button>
			</div>
		</div>
	{/if}
</Modal>
