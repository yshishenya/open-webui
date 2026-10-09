<script context="module" lang="ts">
	/**
	 * At most one user profile preview may be open across all ProfilePreview
	 * instances. bits-ui's safe-polygon close only re-evaluates on pointermove,
	 * so a preview can be left open when the pointer stops on a neighboring
	 * row while still inside the previous row's grace area; opening a preview
	 * therefore force-closes whichever one is still up.
	 */
	let closeActiveProfilePreview: (() => void) | null = null;
</script>

<script lang="ts">
	import { LinkPreview } from 'bits-ui';
	import { onDestroy, type ComponentProps } from 'svelte';
	import type { SessionUser } from '$lib/stores';

	import UserStatusLinkPreview from './UserStatusLinkPreview.svelte';

	export let user: Pick<SessionUser, 'id'> | null | undefined = null;

	export let align: ComponentProps<typeof LinkPreview.Content>['align'] = 'center';
	export let side: ComponentProps<typeof LinkPreview.Content>['side'] = 'right';
	export let sideOffset = 8;

	let openPreview = false;

	const closeProfilePreview = (): void => {
		if (openPreview) {
			openPreview = false;
		}
	};

	const activateProfilePreview = (): void => {
		if (closeActiveProfilePreview !== closeProfilePreview) {
			closeActiveProfilePreview?.();
			closeActiveProfilePreview = closeProfilePreview;
		}
	};

	$: if (openPreview) activateProfilePreview();

	onDestroy(() => {
		if (closeActiveProfilePreview === closeProfilePreview) {
			closeActiveProfilePreview = null;
		}
	});
</script>

<LinkPreview.Root openDelay={0} closeDelay={200} bind:open={openPreview}>
	<LinkPreview.Trigger class="flex items-center">
		<button
			type="button"
			class=" cursor-pointer no-underline! font-normal!"
			on:click={() => {
				openPreview = !openPreview;
			}}
		>
			<slot />
		</button>
	</LinkPreview.Trigger>

	<UserStatusLinkPreview id={user?.id} {openPreview} {side} {align} {sideOffset} />
</LinkPreview.Root>
