<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { WEBUI_NAME, showSidebar, user, mobile, config } from '$lib/stores';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Sidebar from '$lib/components/icons/Sidebar.svelte';
	import ChatBubbles from '$lib/components/icons/ChatBubbles.svelte';
	import { sanitizeReturnTo } from '$lib/utils/airis/return_to';

	const i18n = getContext('i18n');

	let loaded = false;
	let subscriptionsEnabled = true;
	let returnTo: string | null = null;

	$: subscriptionsEnabled = $config?.features?.enable_billing_subscriptions ?? true;
	$: isAdmin = $user?.role === 'admin';
	$: returnTo = sanitizeReturnTo($page.url.searchParams.get('return_to'));

	const buildBillingHref = (pathname: string): string => {
		if (!returnTo) return pathname;
		const params = new URLSearchParams();
		params.set('return_to', returnTo);
		return `${pathname}?${params.toString()}`;
	};

	const handleReturnToClick = async (event: MouseEvent): Promise<void> => {
		if (!returnTo) return;
		if (
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey ||
			event.button !== 0
		) {
			return;
		}
		event.preventDefault();
		await goto(returnTo);
	};

	onMount(async () => {
		if (!$user) {
			goto('/auth');
			return;
		}
		loaded = true;
	});
</script>

<svelte:head>
	<title>
		{$i18n.t('Billing')} • {$WEBUI_NAME}
	</title>
</svelte:head>

{#if loaded}
	<div
		class="relative flex flex-col w-full h-screen max-h-[100dvh] transition-width duration-200 ease-in-out {$showSidebar
			? 'md:max-w-[calc(100%-260px)]'
			: ''} max-w-full"
	>
		<nav class="px-2.5 pt-1.5 backdrop-blur-xl drag-region">
			<div class="flex items-center gap-1">
				{#if $mobile}
					<div class="{$showSidebar ? 'md:hidden' : ''} self-center flex flex-none items-center">
						<Tooltip
							content={$showSidebar ? $i18n.t('Close Sidebar') : $i18n.t('Open Sidebar')}
							interactive={true}
						>
							<button
								id="sidebar-toggle-button"
								class="cursor-pointer flex rounded-lg hover:bg-gray-100 dark:hover:bg-gray-850 transition"
								on:click={() => {
									showSidebar.set(!$showSidebar);
								}}
							>
								<div class="self-center p-1.5">
									<Sidebar />
								</div>
							</button>
						</Tooltip>
					</div>
				{/if}

				<div class="">
					<div
						class="flex gap-1 scrollbar-none overflow-x-auto w-fit text-center text-sm font-medium rounded-full bg-transparent py-1 touch-auto pointer-events-auto"
					>
						<a
							class="min-w-fit p-1.5 {$page.url.pathname === '/billing/balance' ||
							$page.url.pathname === '/billing/dashboard' ||
							$page.url.pathname === '/billing/settings'
								? ''
								: 'text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'} transition"
							href={buildBillingHref('/billing/balance')}
						>
							{$i18n.t('Wallet')}
						</a>

						<a
							class="min-w-fit p-1.5 {$page.url.pathname === '/billing/history'
								? ''
								: 'text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'} transition"
							href={buildBillingHref('/billing/history')}
						>
							{$i18n.t('History')}
						</a>

						{#if subscriptionsEnabled && isAdmin}
							<a
								class="min-w-fit p-1.5 {$page.url.pathname === '/billing/plans'
									? ''
									: 'text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-white'} transition"
								href={buildBillingHref('/billing/plans')}
							>
								{$i18n.t('Plans')}
							</a>
						{/if}
					</div>
				</div>

				{#if returnTo}
					<div class="ml-auto">
						<a
							href={returnTo}
							on:click={handleReturnToClick}
							class="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 transition text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
						>
							<ChatBubbles className="size-4" />
							<span class="hidden sm:inline">{$i18n.t('Back to chat')}</span>
							<span class="sm:hidden">{$i18n.t('Back')}</span>
						</a>
					</div>
				{/if}
			</div>
		</nav>

		<div class="pb-1 px-3 md:px-[18px] flex-1 max-h-full overflow-y-auto" id="billing-container">
			<slot />
		</div>
	</div>
{/if}
