<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getContext, onDestroy } from 'svelte';
	import type {
		ChannelListItem,
		ChannelDetail,
		ChannelWebhook
	} from '$lib/utils/airis/channel-types';
	import type { WebhookForm } from '$lib/apis/channels';

	import {
		getChannelWebhooks,
		createChannelWebhook,
		updateChannelWebhook,
		deleteChannelWebhook
	} from '$lib/apis/channels';

	import Modal from '$lib/components/common/Modal.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import WebhookItem from './WebhookItem.svelte';

	const i18n = getContext('i18n');

	export let show = false;
	export let channel: ChannelListItem | ChannelDetail | null = null;
	let webhooks: ChannelWebhook[] = [];
	let isLoading = false;
	let isSaving = false;
	let showDeleteConfirmDialog = false;
	let selectedWebhookId: string | null = null;
	let pendingChanges: Record<string, WebhookForm> = {};
	let webhookSession = 0;
	let loadVersion = 0;
	const isCurrent = (session: number, id: string): boolean =>
		session === webhookSession && show && channel?.id === id;

	const loadWebhooks = async (): Promise<void> => {
		if (!show || !channel) return;
		const id = channel.id,
			session = webhookSession,
			version = ++loadVersion;
		isLoading = true;
		try {
			const result = await getChannelWebhooks(localStorage.token, id);
			if (isCurrent(session, id) && version === loadVersion) webhooks = result;
		} catch (error) {
			if (isCurrent(session, id) && version === loadVersion) toast.error(`${error}`);
		} finally {
			if (isCurrent(session, id) && version === loadVersion) isLoading = false;
		}
	};
	const createHandler = async (): Promise<void> => {
		if (!show || !channel || isSaving) return;
		const id = channel.id,
			session = webhookSession;
		isSaving = true;
		try {
			const result = await createChannelWebhook(localStorage.token, id, { name: 'New Webhook' });
			if (!isCurrent(session, id)) return;
			webhooks = [...webhooks, result];
			selectedWebhookId = result.id;
		} catch (error) {
			if (isCurrent(session, id)) toast.error(`${error}`);
		} finally {
			if (isCurrent(session, id)) isSaving = false;
		}
	};
	const saveHandler = async (): Promise<void> => {
		if (!show || !channel || isSaving) return;
		const id = channel.id,
			session = webhookSession;
		isSaving = true;
		try {
			for (const [webhookId, changes] of Object.entries(pendingChanges)) {
				if (!isCurrent(session, id)) return;
				const saved = await updateChannelWebhook(localStorage.token, id, webhookId, changes);
				if (!isCurrent(session, id)) return;
				if (pendingChanges[webhookId] === changes) delete pendingChanges[webhookId];
				webhooks = webhooks.map((webhook) => (webhook.id === saved.id ? saved : webhook));
			}
			toast.success($i18n.t('Saved'));
		} catch (error) {
			if (isCurrent(session, id)) toast.error(`${error}`);
		} finally {
			if (isCurrent(session, id)) isSaving = false;
		}
	};
	const deleteHandler = async (): Promise<void> => {
		if (!show || !channel || !selectedWebhookId || isSaving) return;
		const id = channel.id,
			webhookId = selectedWebhookId,
			session = webhookSession;
		isSaving = true;
		try {
			const deleted = await deleteChannelWebhook(localStorage.token, id, webhookId);
			if (!isCurrent(session, id)) return;
			if (!deleted) throw new Error($i18n.t('Failed to delete webhook'));
			webhooks = webhooks.filter((webhook) => webhook.id !== webhookId);
			delete pendingChanges[webhookId];
			selectedWebhookId = null;
			showDeleteConfirmDialog = false;
			toast.success($i18n.t('Deleted'));
		} catch (error) {
			if (isCurrent(session, id)) toast.error(`${error}`);
		} finally {
			if (isCurrent(session, id)) isSaving = false;
		}
	};
	const updatePendingChanges = (webhook: ChannelWebhook, changes: WebhookForm): void => {
		if (
			changes.name === webhook.name &&
			(changes.profile_image_url ?? '') === (webhook.profile_image_url ?? '')
		) {
			if (webhook.id in pendingChanges) delete pendingChanges[webhook.id];
		} else if (
			pendingChanges[webhook.id]?.name !== changes.name ||
			pendingChanges[webhook.id]?.profile_image_url !== changes.profile_image_url
		) {
			pendingChanges[webhook.id] = changes;
		}
	};
	$: {
		webhookSession++;
		isSaving = false;
		isLoading = false;
		webhooks = [];
		selectedWebhookId = null;
		pendingChanges = {};
		if (show && channel) loadWebhooks();
	}
	onDestroy(() => {
		webhookSession++;
	});
</script>

<ConfirmDialog bind:show={showDeleteConfirmDialog} on:confirm={deleteHandler} />

{#if channel}
	<Modal size="sm" bind:show>
		<div>
			<div class="flex justify-between dark:text-gray-100 px-4 pt-3 mb-1">
				<div class="flex w-full justify-between items-center mr-3">
					<div class="self-center text-base flex gap-1.5 items-center">
						<div>{$i18n.t('Webhooks')}</div>
						<span class="text-sm text-gray-500">{webhooks.length}</span>
					</div>

					<button
						type="button"
						class="px-3 py-1.5 gap-1 rounded-xl bg-gray-100/50 dark:bg-gray-850/50 text-black dark:text-white transition font-normal text-xs flex items-center justify-center"
						on:click={createHandler}
						disabled={isSaving}
					>
						<Plus className="size-3.5" />
						<span>{$i18n.t('New Webhook')}</span>
					</button>
				</div>

				<button
					class="self-center rounded-lg p-1 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
					on:click={() => (show = false)}
				>
					<XMark className="size-4" />
				</button>
			</div>

			<div class="flex flex-col w-full px-4 pb-4 dark:text-gray-200">
				<form
					class="flex flex-col w-full"
					on:submit={(e) => {
						e.preventDefault();
						saveHandler();
					}}
				>
					{#if isLoading}
						<div class="flex justify-center py-10">
							<Spinner className="size-5" />
						</div>
					{:else if webhooks.length > 0}
						<div class="w-full py-2">
							{#each webhooks as webhook (webhook.id)}
								<WebhookItem
									{webhook}
									expanded={selectedWebhookId === webhook.id}
									onClick={() => {
										selectedWebhookId = selectedWebhookId === webhook.id ? null : webhook.id;
									}}
									onDelete={() => {
										showDeleteConfirmDialog = true;
									}}
									onUpdate={(changes) => {
										updatePendingChanges(webhook, changes);
									}}
								/>
							{/each}
						</div>
					{:else}
						<div class="text-gray-500 text-xs text-center py-8 px-10">
							{$i18n.t('No webhooks yet')}
						</div>
					{/if}

					<div class="flex justify-end text-sm font-normal gap-1.5">
						<button
							class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full flex items-center gap-2 whitespace-nowrap {isSaving
								? 'cursor-not-allowed'
								: ''}"
							type="submit"
							disabled={isSaving}
						>
							{$i18n.t('Save')}
							{#if isSaving}
								<span class="shrink-0">
									<Spinner />
								</span>
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	</Modal>
{/if}
