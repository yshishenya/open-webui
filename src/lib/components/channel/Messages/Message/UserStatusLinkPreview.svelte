<script lang="ts">
	import { onDestroy, type ComponentProps } from 'svelte';
	import { LinkPreview } from 'bits-ui';

	import { getUserInfoById, type UserInfoResponse } from '$lib/apis/users';

	import UserStatus from './UserStatus.svelte';

	export let id: string | null | undefined = null;
	export let openPreview = false;
	export let resolvedUser: UserInfoResponse | null = null;
	export let loadingUser = false;

	export let side: ComponentProps<typeof LinkPreview.Content>['side'] = 'top';
	export let align: ComponentProps<typeof LinkPreview.Content>['align'] = 'start';
	export let sideOffset = 6;

	let user: UserInfoResponse | null = null;
	let pendingRequest: object | null = null;
	let requestedUserId: string | null = null;

	const loadUser = async (userId: string): Promise<void> => {
		const request = {};
		pendingRequest = request;
		requestedUserId = userId;
		user = null;

		const loadedUser = await getUserInfoById(localStorage.token, userId).catch((error) => {
			if (pendingRequest === request) {
				console.error('Error fetching user by ID:', error);
			}
			return null;
		});

		// Request identity also rejects an older response after A -> B -> A.
		if (pendingRequest === request && openPreview && id === userId) {
			user = loadedUser;
		}
	};

	$: if (resolvedUser?.id === id) {
		pendingRequest = null;
		user = resolvedUser;
		requestedUserId = id ?? null;
	} else if (openPreview && id && !loadingUser) {
		if (id !== requestedUserId) loadUser(id);
	} else {
		pendingRequest = null;
		if (!id || id !== requestedUserId || !user) {
			user = null;
			requestedUserId = null;
		}
	}

	onDestroy(() => {
		pendingRequest = null;
	});
</script>

{#if user}
	<LinkPreview.Portal>
		<LinkPreview.Content
			class="z-[9999] w-64 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl bg-white font-sans text-gray-900 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:bg-gray-850 dark:text-gray-100 dark:ring-white/10"
			{side}
			{align}
			{sideOffset}
		>
			<UserStatus {user} />
		</LinkPreview.Content>
	</LinkPreview.Portal>
{/if}
