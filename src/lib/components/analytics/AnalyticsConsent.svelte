<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getAnalyticsConsent,
		setAnalyticsConsent,
		type AnalyticsConsent
	} from '$lib/utils/airis/analyticsConsent';

	let consent: AnalyticsConsent = null;

	onMount(() => {
		consent = getAnalyticsConsent();
	});

	const choose = (value: Exclude<AnalyticsConsent, null>): void => {
		consent = value;
		setAnalyticsConsent(value);
	};
</script>

{#if consent === null}
	<div
		class="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 text-sm text-gray-700 shadow-xl backdrop-blur md:flex-row md:items-center md:justify-between md:gap-6 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200"
		role="dialog"
		aria-label="Настройки аналитики"
	>
		<p class="leading-relaxed">
			Разрешить обезличенную аналитику, чтобы мы улучшали Airis? Основные функции работают и без
			неё.
			<a href="/documents/cookies" class="font-medium text-gray-900 underline dark:text-white"
				>Подробнее</a
			>
		</p>
		<div class="flex shrink-0 gap-2">
			<button
				type="button"
				class="rounded-xl px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
				on:click={() => choose('denied')}
			>
				Не сейчас
			</button>
			<button
				type="button"
				class="rounded-xl bg-gray-900 px-3 py-2 font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
				on:click={() => choose('granted')}
			>
				Разрешить
			</button>
		</div>
	</div>
{/if}
