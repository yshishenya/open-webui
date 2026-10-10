<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';

	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import DropdownMenu from '$lib/components/common/DropdownMenu.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Camera from '$lib/components/icons/Camera.svelte';
	import Clip from '$lib/components/icons/Clip.svelte';

	const i18n = getContext<Writable<I18n>>('i18n');

	export let screenCaptureHandler: () => void | Promise<void>;
	export let uploadFilesHandler: () => void | Promise<void>;

	export let onClose: () => void | Promise<void> = () => {};

	let show = false;

	$: if (show) {
		init();
	}

	const init = async () => {};
</script>

<Dropdown
	bind:show
	on:change={(e) => {
		if (e.detail === false) {
			onClose();
		}
	}}
>
	<Tooltip content={$i18n.t('More')}>
		<slot />
	</Tooltip>

	<div slot="content">
		<DropdownMenu className="w-[200px] z-999 transition">
			<button
				class="select-none flex h-[1.6875rem] w-full items-center gap-2 rounded-xl px-2 text-[13px] cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40"
				type="button"
				on:click={() => {
					uploadFilesHandler();
					show = false;
				}}
			>
				<Clip className="size-3.5" />
				<div class="line-clamp-1">{$i18n.t('Upload Files')}</div>
			</button>

			<button
				class="select-none flex h-[1.6875rem] w-full items-center gap-2 rounded-xl px-2 text-[13px] cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-800/40"
				type="button"
				on:click={() => {
					screenCaptureHandler();
					show = false;
				}}
			>
				<Camera className="size-3.5" />
				<div class=" line-clamp-1">{$i18n.t('Capture')}</div>
			</button>
		</DropdownMenu>
	</div>
</Dropdown>
