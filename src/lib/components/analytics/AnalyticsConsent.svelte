<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ANALYTICS_SETTINGS_EVENT,
		getAnalyticsConsent,
		setAnalyticsConsent,
		type AnalyticsConsent
	} from '$lib/utils/airis/analyticsConsent';

	import { FUNNEL_REVOKE_KEY, revokeFunnelConsent } from '$lib/utils/airis/funnelAnalytics';
	let saving = false;
	let revokeFailed = false;

	let consent: AnalyticsConsent = null;
	let settingsOpen = false;

	const openSettings = (): void => {
		settingsOpen = true;
	};

	onMount(() => {
		consent = getAnalyticsConsent();
		if (localStorage.getItem(FUNNEL_REVOKE_KEY)) {
			settingsOpen = true;
			revokeFailed = true;
		}
		window.addEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
		return () => window.removeEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
	});

	const choose = async (value: Exclude<AnalyticsConsent, null>): Promise<void> => {
		if (saving) return;
		const shouldReload = consent === 'granted' && value === 'denied';
		saving = true;
		revokeFailed = false;
		try {
			if (value === 'denied' || localStorage.getItem(FUNNEL_REVOKE_KEY)) {
				// Stop browser delivery immediately, then confirm the server has purged pending delivery.
				consent = 'denied';
				setAnalyticsConsent('denied');
				await revokeFunnelConsent();
			}
			consent = value;
			setAnalyticsConsent(value);
			settingsOpen = false;
		} catch {
			revokeFailed = true;
			settingsOpen = true;
		} finally {
			saving = false;
			// Remove already-loaded provider scripts even when server confirmation needs a retry.
			if (shouldReload) window.location.reload();
		}
	};
</script>

{#if consent === null || settingsOpen}
	<div
		class="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 text-sm text-gray-700 shadow-xl backdrop-blur md:flex-row md:items-center md:justify-between md:gap-6 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200"
		role="dialog"
		aria-modal="true"
		aria-label="Настройки аналитики"
	>
		<p class="leading-relaxed">
			{#if revokeFailed}
				Аналитика в браузере остановлена. Не удалось подтвердить отзыв на сервере. Нажмите
				«Запретить», чтобы повторить.
			{:else if consent === null}
				Разрешить продуктовую аналитику, чтобы мы улучшали Airis? Основные функции работают без неё.
			{:else}
				Сейчас аналитика {consent === 'granted' ? 'разрешена' : 'запрещена'}. Вы можете изменить
				выбор.
			{/if}
			<a href="/documents/cookies" class="font-medium text-gray-900 underline dark:text-white"
				>Подробнее</a
			>
		</p>
		<div class="flex shrink-0 flex-wrap justify-end gap-2">
			{#if settingsOpen && consent !== null}
				<button
					type="button"
					disabled={saving}
					class="rounded-xl px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
					on:click={() => (settingsOpen = false)}
				>
					Закрыть
				</button>
			{/if}
			<button
				type="button"
				disabled={saving}
				class="rounded-xl px-3 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
				on:click={() => choose('denied')}
			>
				Запретить
			</button>
			<button
				type="button"
				disabled={saving}
				class="rounded-xl bg-gray-900 px-3 py-2 font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
				on:click={() => choose('granted')}
			>
				Разрешить
			</button>
		</div>
	</div>
{/if}
