<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getContext, onDestroy } from 'svelte';
	const i18n = getContext('i18n');

	import type { ChannelDetail } from '$lib/utils/airis/channel-types';
	import { addMembersById } from '$lib/apis/channels';

	import Modal from '$lib/components/common/Modal.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import MemberSelector from '$lib/components/workspace/common/MemberSelector.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';

	export let show = false;
	export let channel: ChannelDetail | null = null;

	export let onUpdate: () => void | Promise<void> = () => {};

	let groupIds: string[] = [];
	let userIds: string[] = [];

	let loading = false;
	let submissionVersion = 0;

	const submitHandler = async (): Promise<void> => {
		if (!show || !channel || loading) return;
		const id = channel.id,
			version = ++submissionVersion;
		loading = true;
		try {
			await addMembersById(localStorage.token, id, { user_ids: userIds, group_ids: groupIds });
			if (!show || channel?.id !== id || version !== submissionVersion) return;
			toast.success($i18n.t('Members added successfully'));
			show = false;
			await onUpdate();
		} catch (error) {
			if (channel?.id === id && version === submissionVersion) toast.error(`${error}`);
		} finally {
			if (version === submissionVersion) loading = false;
		}
	};
	onDestroy(() => {
		submissionVersion++;
	});

	const reset = (): void => {
		submissionVersion++;
		userIds = [];
		groupIds = [];
		loading = false;
	};

	$: if (!show) {
		reset();
	}
</script>

{#if channel}
	<Modal size="sm" bind:show>
		<div>
			<div class=" flex justify-between dark:text-gray-100 px-4 pt-3 mb-1">
				<div class="self-center text-base">
					<div class="flex items-center gap-0.5 shrink-0">
						{$i18n.t('Add Members')}
					</div>
				</div>
				<button
					class="self-center rounded-lg p-1 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
					on:click={() => {
						show = false;
					}}
				>
					<XMark className={'size-4'} />
				</button>
			</div>

			<div class="flex flex-col md:flex-row w-full px-3 pb-4 md:space-x-4 dark:text-gray-200">
				<div class=" flex flex-col w-full sm:flex-row sm:justify-center sm:space-x-6">
					<form
						class="flex flex-col w-full"
						on:submit={(e) => {
							e.preventDefault();
							submitHandler();
						}}
					>
						<div class="flex flex-col w-full h-full pb-2">
							<MemberSelector bind:userIds bind:groupIds includeGroups={true} />
						</div>

						<div class="flex justify-end pt-3 text-sm font-normal gap-1.5">
							<button
								class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-950 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full flex flex-row space-x-1 items-center {loading
									? ' cursor-not-allowed'
									: ''}"
								type="submit"
								disabled={loading}
							>
								{$i18n.t('Add')}

								{#if loading}
									<div class="ml-2 self-center">
										<Spinner />
									</div>
								{/if}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	</Modal>
{/if}
