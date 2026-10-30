<script lang="ts">
	import LockClosed from '$lib/components/icons/LockClosed.svelte';
	import { getContext } from 'svelte';


	import { user } from '$lib/stores';

	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import DropdownMenu from '$lib/components/common/DropdownMenu.svelte';
	import GarbageBin from '$lib/components/icons/GarbageBin.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import DocumentDuplicate from '$lib/components/icons/DocumentDuplicate.svelte';
	import Download from '$lib/components/icons/Download.svelte';

	const i18n = getContext<typeof import('$lib/i18n').default>('i18n');

	export let writeAccess = true;

	export let editHandler: () => void;
	export let cloneHandler: () => void;
	export let exportHandler: () => void;
	export let deleteHandler: () => void;
	export let accessHandler: (() => void) | null = null;
	export let onClose: () => void;

	export let show = false;
	export let disabled = false;

	const closeMenu = () => {
		show = false;
		onClose();
	};
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
				class="select-none flex h-[1.6875rem] w-full cursor-pointer items-center gap-2 rounded-xl bg-transparent px-2 text-[0.8125rem] enabled:hover:text-gray-900 dark:enabled:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
				draggable="false"
				disabled={disabled || !writeAccess}
				on:click={() => {
					if (!disabled) editHandler();
					closeMenu();
				}}
			>
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
						d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
					/>
				</svg>

				<div class="flex items-center">{$i18n.t('Edit')}</div>
			</button>
			{#if accessHandler && writeAccess}
				<button
					type="button"
					class="select-none flex h-[1.6875rem] w-full cursor-pointer items-center gap-2 rounded-xl bg-transparent px-2 text-[0.8125rem] hover:text-gray-900 dark:hover:text-gray-100"
					on:click={() => {
						accessHandler?.();
						closeMenu();
					}}
				>
					<LockClosed className="size-3.5" />
					<div class="flex items-center">{$i18n.t('Access')}</div>
				</button>
			{/if}

			<button
				class="select-none flex h-[1.6875rem] w-full cursor-pointer items-center gap-2 rounded-xl bg-transparent px-2 text-[0.8125rem] hover:text-gray-900 dark:hover:text-gray-100"
				draggable="false"
				on:click={() => {
					cloneHandler();
					closeMenu();
				}}
			>
				<DocumentDuplicate className="size-3.5" />
				<div class="flex items-center">{$i18n.t('Clone')}</div>
			</button>

			{#if $user?.role === 'admin' || $user?.permissions?.workspace?.prompts_export}
				<button
					class="select-none flex h-[1.6875rem] w-full cursor-pointer items-center gap-2 rounded-xl bg-transparent px-2 text-[0.8125rem] hover:text-gray-900 dark:hover:text-gray-100"
					draggable="false"
					on:click={() => {
						exportHandler();
						closeMenu();
					}}
				>
					<Download className="size-3.5" />
					<div class="flex items-center">{$i18n.t('Export')}</div>
				</button>
			{/if}

			<hr class="border-gray-50 dark:border-gray-850/30 mx-1 my-0.5" />

			<button
				class="select-none flex h-[1.6875rem] w-full cursor-pointer items-center gap-2 rounded-xl bg-transparent px-2 text-[0.8125rem] enabled:hover:text-gray-900 dark:enabled:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
				draggable="false"
				disabled={disabled || !writeAccess}
				on:click={() => {
					if (!disabled) deleteHandler();
					closeMenu();
				}}
			>
				<GarbageBin className="size-3.5" />
				<div class="flex items-center">{$i18n.t('Delete')}</div>
			</button>
		</DropdownMenu>
	</div>
</Dropdown>
