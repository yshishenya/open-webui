<script lang="ts">
	import { onMount } from 'svelte';
	import { unsubscribeProductEmail } from '$lib/apis/email-preferences';

	let token = '';
	let busy = false;
	let done = false;
	let error = '';
	onMount(() => {
		token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
		window.history.replaceState(window.history.state, '', window.location.pathname);
	});
	async function unsubscribe(): Promise<void> {
		busy = true;
		error = '';
		try {
			await unsubscribeProductEmail(token);
			done = true;
			token = '';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Не удалось обработать отписку.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head
	><title>Отписка от писем — AIRIS</title><meta
		name="referrer"
		content="no-referrer"
	/></svelte:head
>
<main
	id="main-content"
	class="min-h-screen bg-gray-50 px-4 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100"
>
	<section
		class="mx-auto max-w-lg space-y-5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
	>
		<h1 class="text-2xl font-semibold">Отписка от продуктовых писем AIRIS</h1>
		{#if done}
			<p role="status">
				Запрос на отписку обработан. Повторно включить письма можно только в настройках аккаунта.
			</p>
		{:else if token.length >= 32 && token.length <= 128}
			<p>Отключить советы и новости продукта? Вход в аккаунт не требуется.</p>
			<button
				type="button"
				on:click={unsubscribe}
				disabled={busy}
				class="rounded-xl bg-gray-900 px-4 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
				>{busy ? 'Обработка…' : 'Отписаться'}</button
			>
		{:else}
			<p>
				Откройте ссылку «Отписаться» из письма или отключите продуктовые письма в настройках
				аккаунта.
			</p>
		{/if}
		{#if error}<p role="alert" class="text-red-600">{error}</p>{/if}
		<p class="text-sm text-gray-500">
			Подтверждение адреса, восстановление пароля и уведомления о платежах продолжат приходить.
		</p>
		<a href="/" class="inline-block underline">Перейти в AIRIS</a>
	</section>
</main>
