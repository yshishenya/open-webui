<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import type { FloatingAction } from '$lib/utils/airis/frontend-contracts';
	import { getErrorMessage } from '$lib/utils/airis/error_message';
	import Modal from '$lib/components/common/Modal.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Minus from '$lib/components/icons/Minus.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import Textarea from '$lib/components/common/Textarea.svelte';
	const i18n = getContext<Writable<i18nType>>('i18n');
	export let show = false;
	export let floatingActionButtons: FloatingAction[] | null = null;
	export let onSave: (value: FloatingAction[] | null) => Promise<boolean> = async () => true;
	let draft: FloatingAction[] | null = null;
	let saving = false;
	let wasOpen = false;
	let draftVersion = 0;
	$: if (show !== wasOpen) {
		wasOpen = show;
		draftVersion++;
		if (show) draft = structuredClone(floatingActionButtons);
	}
	const submitHandler = async (): Promise<void> => {
		if (saving) return;
		saving = true;
		const version = draftVersion;
		try {
			if ((await onSave(structuredClone(draft))) && version === draftVersion) show = false;
		} catch (error) {
			if (version === draftVersion) toast.error(getErrorMessage(error));
		} finally {
			saving = false;
		}
	};
</script>

<Modal size="sm" bind:show className="bg-white dark:bg-gray-900 rounded-4xl">
	<div>
		<div class=" flex justify-between text-gray-900 dark:text-white px-4 pt-3 pb-1">
			<h1 class="text-sm font-medium self-center">
				{$i18n.t('Quick Actions')}
			</h1>
			<button
				class="self-center rounded-lg p-1 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
				aria-label={$i18n.t('Close modal')}
				on:click={() => {
					show = false;
				}}
			>
				<XMark className={'size-4'} />
			</button>
		</div>

		<div
			class="flex flex-col md:flex-row w-full px-4 pb-4 md:space-x-4 text-gray-600 dark:text-gray-400"
		>
			<div class=" flex flex-col w-full sm:flex-row sm:justify-center sm:space-x-6">
				<form
					class="flex flex-col w-full px-1"
					on:submit={(e) => {
						e.preventDefault();
						submitHandler();
					}}
				>
					<div>
						<div class="text-xs flex items-center justify-between mb-2">
							<div class="font-normal">{$i18n.t('Actions')}</div>

							<div class="flex items-center gap-2 text-gray-500 dark:text-gray-500">
								<button
									type="button"
									on:click={() => {
										if (draft === null) {
											draft = [
												{
													id: 'ask',
													label: $i18n.t('Ask'),
													input: true,
													prompt: `{{SELECTED_CONTENT}}\n\n\n{{INPUT_CONTENT}}`
												},
												{
													id: 'explain',
													label: $i18n.t('Explain'),
													input: false,
													prompt: `{{SELECTED_CONTENT}}\n\n\n${$i18n.t('Explain')}`
												}
											];
										} else {
											draft = null;
										}
									}}
								>
									{#if draft === null}
										<span class="">{$i18n.t('Default')}</span>
									{:else}
										<span class="">{$i18n.t('Custom')}</span>
									{/if}
								</button>

								{#if draft !== null}
									<button
										class=""
										type="button"
										on:click={() => {
											if (!draft) return;
											let id = `new-button`;
											let idx = 0;

											while (draft.some((b) => b.id === id)) {
												idx++;
												id = `new-button-${idx}`;
											}

											draft = [
												...draft,
												{
													id: id,
													label: `${$i18n.t('New Button')}`,
													input: true,
													prompt: `{{CONTENT}}\n\n\n{{INPUT_CONTENT}}`
												}
											];
										}}
									>
										<Plus className="size-4 " />
									</button>
								{/if}
							</div>
						</div>

						{#if draft === null || draft.length === 0}
							<div class="text-gray-500 dark:text-gray-400 text-xs w-full text-center py-5">
								{$i18n.t('Default action buttons will be used.')}
							</div>
						{:else}
							{#each draft as button}
								<div class=" py-1 flex w-full justify-between items-start">
									<div class="flex flex-col items-start pr-2">
										<input
											class=" self-center text-xs outline-none w-20"
											placeholder={$i18n.t('Button Label')}
											aria-label={$i18n.t('Button Label')}
											bind:value={button.label}
										/>

										<input
											class=" self-center text-xs outline-none w-20 text-gray-600 dark:text-gray-400"
											placeholder={$i18n.t('Button ID')}
											aria-label={$i18n.t('Button ID')}
											bind:value={button.id}
										/>
									</div>

									<div class="flex items-center gap-2 w-full">
										<Textarea
											className=" self-center text-xs w-full outline-none"
											placeholder={$i18n.t('Button Prompt')}
											ariaLabel={$i18n.t('Button Prompt')}
											minSize={30}
											bind:value={button.prompt}
										/>
									</div>
									<button
										class="pl-3 text-xs flex rounded-sm transition"
										aria-label={$i18n.t('Remove action')}
										on:click={() => {
											draft = draft?.filter((b) => b.id !== button.id) ?? null;
										}}
										type="button"
									>
										<Minus className="h-4 w-4" />
									</button>
								</div>

								<hr class="border-gray-50 dark:border-gray-850/30 my-2" />
							{/each}
						{/if}
					</div>

					<div class="flex justify-end text-sm font-normal">
						<button
							class="px-3.5 py-1.5 text-sm font-normal bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
							type="submit"
							disabled={saving}
						>
							{$i18n.t('Save')}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</Modal>
