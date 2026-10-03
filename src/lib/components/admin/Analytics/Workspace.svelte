<script lang="ts">
	import { config, user } from '$lib/stores';
	import ReportNavigation from './ReportNavigation.svelte';
	import ProductFunnel from './ProductFunnel.svelte';
	import Dashboard from './Dashboard.svelte';
	import EmailObservations from './EmailObservations.svelte';
	import Retention from './Retention.svelte';
	export let view = 'overview';
</script>

{#if $user?.role === 'admin' && ($config?.features?.enable_admin_analytics ?? true)}
	<ReportNavigation />
	{#key view}
		{#if view === 'overview'}<ProductFunnel overview />
		{:else if view === 'funnel'}<ProductFunnel />
		{:else if view === 'models'}<div class="mx-auto max-w-7xl p-4 sm:p-6"><Dashboard /></div>
		{:else if view === 'retention'}<Retention />
		{:else if view === 'mail'}<div class="mx-auto max-w-7xl p-4 sm:p-6"><EmailObservations /></div>
		{:else}<div class="p-6">
				<h1 class="text-xl font-medium">Раздел не найден</h1>
				<a class="mt-3 inline-block underline" href="/admin/analytics"
					>Вернуться к обзору продукта</a
				>
			</div>{/if}
	{/key}
{:else if $user?.role === 'admin'}<p class="p-6">
		Аналитика выключена в настройках приложения.
	</p>{/if}
