<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getProductEmailPreference,
		saveProductEmailPreference,
		type ProductEmailPreference
	} from '$lib/apis/email-preferences';
	import ProductEmailChoice from './ProductEmailChoice.svelte';

	let preference: ProductEmailPreference | null = null;
	let checked = false;
	let busy = false;
	let message = '';
	let error = '';

	async function load(): Promise<void> {
		busy = true;
		error = '';
		try {
			preference = await getProductEmailPreference(localStorage.token);
			checked = preference.subscribed;
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Не удалось загрузить настройку.';
		} finally {
			busy = false;
		}
	}

	async function save(): Promise<void> {
		busy = true;
		error = '';
		message = '';
		try {
			preference = await saveProductEmailPreference(localStorage.token, checked);
			checked = preference.subscribed;
			message = checked ? 'Согласие сохранено.' : 'Продуктовые письма отключены.';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Не удалось сохранить выбор.';
		} finally {
			busy = false;
		}
	}

	onMount(() => {
		void load();
	});
</script>

<section
	class="my-4 space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
	aria-labelledby="product-email-heading"
>
	<h3 id="product-email-heading" class="font-medium">Продуктовые письма</h3>
	{#if preference}
		<ProductEmailChoice bind:checked disabled={busy} />
		{#if checked && !preference.email_verified}
			<p class="text-xs text-gray-500">
				Письма начнут приходить после подтверждения текущего адреса.
			</p>
		{:else if checked && preference.reason === 'suppressed_address'}
			<p class="text-xs text-gray-500">
				Отправка на этот адрес остановлена. Обратитесь в поддержку.
			</p>
		{/if}
		<button
			type="button"
			disabled={busy || checked === preference.subscribed}
			on:click={save}
			class="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
			>Сохранить выбор писем</button
		>
	{:else}
		<button type="button" disabled={busy} on:click={load} class="text-xs underline"
			>{busy ? 'Загрузка…' : 'Загрузить настройку писем'}</button
		>
	{/if}
	<p class="text-xs text-gray-500">
		Подтверждение адреса, восстановление пароля и уведомления о платежах приходят независимо от
		этого выбора.
	</p>
	{#if message}<p role="status" class="text-xs">{message}</p>{/if}
	{#if error}<p role="alert" class="text-xs text-red-600">{error}</p>{/if}
</section>
