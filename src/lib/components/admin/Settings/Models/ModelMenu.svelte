<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { WorkspaceModel } from '$lib/apis/models';
	import type { ModelConfig } from '$lib/apis';

	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import DropdownMenu from '$lib/components/common/DropdownMenu.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import DocumentDuplicate from '$lib/components/icons/DocumentDuplicate.svelte';
	import Download from '$lib/components/icons/Download.svelte';
	import Pin from '$lib/components/icons/Pin.svelte';
	import PinSlash from '$lib/components/icons/PinSlash.svelte';
	import Check from '$lib/components/icons/Check.svelte';
	import GarbageBin from '$lib/components/icons/GarbageBin.svelte';
	import GlobeAlt from '$lib/components/icons/GlobeAlt.svelte';
	import LockClosed from '$lib/components/icons/LockClosed.svelte';

	import { pinnedModels } from '$lib/stores';
	import Link from '$lib/components/icons/Link.svelte';

	const i18n = getContext<Readable<I18n>>('i18n');

	type MenuModel = Pick<ModelConfig, 'id'> &
		Partial<Pick<ModelConfig, 'meta'>> & {
			is_active?: boolean;
			owned_by?: string;
			access_grants?: WorkspaceModel['access_grants'] | null;
		};

	export let model: MenuModel;

	export let exportHandler: () => void | Promise<void>;
	export let hideHandler: () => void | Promise<void>;
	export let privacyHandler: () => void | Promise<void>;
	export let deleteHandler: () => void | Promise<void>;
	export let deleteLabel: string;
	export let isDefaultSelected = false;
	export let isDefaultPinned = false;
	export let defaultSelectedHandler: () => void | Promise<void>;
	export let defaultPinnedHandler: () => void | Promise<void>;
	export let pinModelHandler: (modelId: string) => void | Promise<void>;
	export let copyLinkHandler: () => void | Promise<void>;
	export let cloneHandler: () => void | Promise<void>;

	export let onClose: () => void | Promise<void>;

	let show = false;

	const runAndClose = async (handler: () => void | Promise<void>): Promise<void> => {
		show = false;
		await handler();
	};

	const isPublicModel = (model: MenuModel): boolean =>
		(model?.access_grants ?? []).some(
			(g) => g.principal_type === 'user' && g.principal_id === '*' && g.permission === 'read'
		);
</script>

<Dropdown
	bind:show
	onOpenChange={(state) => {
		if (state === false) {
			onClose();
		}
	}}
>
	<Tooltip content={$i18n.t('More')}>
		<slot />
	</Tooltip>

	<div slot="content">
		<DropdownMenu className="min-w-[10.625rem]">
			<button
				class="select-none flex w-full gap-2 items-center h-[1.6875rem] px-2 text-[0.8125rem] font-normal cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40 rounded-xl"
				type="button"
				on:click={() => runAndClose(deleteHandler)}
			>
				<GarbageBin className="size-3.5" />
				<div class="flex items-center">{deleteLabel}</div>
			</button>

			<button
				class="select-none flex w-full gap-2 items-center h-[1.6875rem] px-2 text-[0.8125rem] font-normal cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40 rounded-xl"
				on:click={() => runAndClose(hideHandler)}
			>
				{#if model?.meta?.hidden ?? false}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="size-3.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
						/>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="size-3.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
						/>
					</svg>
				{/if}

				<div class="flex items-center">
					{#if model?.meta?.hidden ?? false}
						{$i18n.t('Show Model')}
					{:else}
						{$i18n.t('Hide Model')}
					{/if}
				</div>
			</button>

			<button
				class="select-none flex w-full gap-2 items-center h-[1.6875rem] px-2 text-[0.8125rem] font-normal cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40 rounded-xl"
				on:click={() => runAndClose(defaultSelectedHandler)}
			>
				<Check className="size-3.5" />

				<div class="flex items-center">
					{#if isDefaultSelected}
						{$i18n.t('Remove Selected Model')}
					{:else}
						{$i18n.t('Set as Selected Model')}
					{/if}
				</div>
			</button>

			<button
				class="select-none flex w-full gap-2 items-center h-[1.6875rem] px-2 text-[0.8125rem] font-normal cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40 rounded-xl"
				on:click={() => runAndClose(defaultPinnedHandler)}
			>
				{#if isDefaultPinned}
					<PinSlash className="size-3.5" />
				{:else}
					<Pin className="size-3.5" />
				{/if}

				<div class="flex items-center">
					{#if isDefaultPinned}
						{$i18n.t('Remove Pinned Model')}
					{:else}
						{$i18n.t('Set as Pinned Model')}
					{/if}
				</div>
			</button>

			<button
				class="select-none flex w-full gap-2 items-center h-[1.6875rem] px-2 text-[0.8125rem] font-normal cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40 rounded-xl"
				on:click={() => runAndClose(privacyHandler)}
			>
				{#if isPublicModel(model)}
					<LockClosed className="size-3.5" />
				{:else}
					<GlobeAlt className="size-3.5" />
				{/if}

				<div class="flex items-center">
					{#if isPublicModel(model)}
						{$i18n.t('Make Private')}
					{:else}
						{$i18n.t('Make Public')}
					{/if}
				</div>
			</button>

			<button
				class="select-none flex w-full gap-2 items-center h-[1.6875rem] px-2 text-[0.8125rem] font-normal cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40 rounded-xl"
				on:click={() => runAndClose(() => pinModelHandler(model?.id))}
			>
				{#if $pinnedModels.includes(model?.id)}
					<PinSlash />
				{:else}
					<Pin />
				{/if}

				<div class="flex items-center">
					{#if $pinnedModels.includes(model?.id)}
						{$i18n.t('Hide from Sidebar')}
					{:else}
						{$i18n.t('Keep in Sidebar')}
					{/if}
				</div>
			</button>

			<button
				class="select-none flex w-full gap-2 items-center h-[1.6875rem] px-2 text-[0.8125rem] font-normal cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40 rounded-xl"
				on:click={() => runAndClose(copyLinkHandler)}
			>
				<Link />

				<div class="flex items-center">{$i18n.t('Copy Link')}</div>
			</button>

			{#if (model?.is_active ?? true) && model?.owned_by !== 'arena'}
				<button
					class="select-none flex w-full gap-2 items-center h-[1.6875rem] px-2 text-[0.8125rem] font-normal cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40 rounded-xl"
					on:click={() => runAndClose(cloneHandler)}
				>
					<DocumentDuplicate />

					<div class="flex items-center">{$i18n.t('Clone')}</div>
				</button>
			{/if}

			<button
				class="select-none flex w-full gap-2 items-center h-[1.6875rem] px-2 text-[0.8125rem] font-normal cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40 rounded-xl"
				on:click={() => runAndClose(exportHandler)}
			>
				<Download />

				<div class="flex items-center">{$i18n.t('Export')}</div>
			</button>
		</DropdownMenu>
	</div>
</Dropdown>
