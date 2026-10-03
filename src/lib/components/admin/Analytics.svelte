<script lang="ts">
	import { user, showSettings } from '$lib/stores';
</script>

{#if $user?.role === 'admin'}
	<div class="space-y-4 p-4">
		<h2 class="text-xl font-medium">Продукт и деньги</h2>
		<p class="text-sm text-gray-600 dark:text-gray-300">
			Обзор продукта, воронка и денежные отчёты доступны в отдельном разделе.
		</p>
		<a
			href="/admin/analytics"
			on:click={() => showSettings.set(false)}
			class="inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm text-white dark:bg-gray-100 dark:text-gray-900"
			>Открыть обзор продукта</a
		>
	</div>
{/if}
