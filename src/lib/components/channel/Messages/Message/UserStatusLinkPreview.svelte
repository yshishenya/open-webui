<script lang="ts">
	import { onDestroy, type ComponentProps } from 'svelte';
	import { LinkPreview } from 'bits-ui';

	import { getUserInfoById, type UserInfoResponse } from '$lib/apis/users';

	import UserStatus from './UserStatus.svelte';

	export let id: string | null | undefined = null;
	export let openPreview = false;

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

	$: if (openPreview && id) {
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
			class="w-[260px] rounded-2xl border border-gray-100  dark:border-gray-800 z-[9999] bg-white dark:bg-gray-850 dark:text-white shadow-lg transition"
			{side}
			{align}
			{sideOffset}
		>
			<UserStatus {user} />
		</LinkPreview.Content>
	</LinkPreview.Portal>
{/if}
