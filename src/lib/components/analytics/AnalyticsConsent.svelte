<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ANALYTICS_SETTINGS_EVENT,
		ANALYTICS_CONSENT_EVENT,
		ANALYTICS_CONSENT_KEY,
		ANALYTICS_NOTICE_KEY,
		getAnalyticsConsentChoice,
		getAnalyticsConsent,
		setAnalyticsConsent,
		type AnalyticsConsent
	} from '$lib/utils/airis/analyticsConsent';

	import { FUNNEL_REVOKE_KEY, revokeFunnelConsent } from '$lib/utils/airis/funnelAnalytics';
	let saving = false;
	let revokeFailed = false;

	let consent: AnalyticsConsent = null;
	let settingsOpen = false;
	let initialNotice = false;

	const openSettings = (): void => {
		settingsOpen = true;
	};

	const refreshChoice = (): void => {
		consent = getAnalyticsConsent();
		initialNotice = false;
		try {
			initialNotice =
				consent === 'granted' &&
				getAnalyticsConsentChoice() === null &&
				localStorage.getItem(ANALYTICS_NOTICE_KEY) !== 'dismissed';
			revokeFailed = Boolean(localStorage.getItem(FUNNEL_REVOKE_KEY));
		} catch {
			revokeFailed = false;
		}
		if (revokeFailed) settingsOpen = true;
	};
	const syncOtherTab = (event: StorageEvent): void => {
		if (
			event.key === null ||
			event.key === ANALYTICS_CONSENT_KEY ||
			event.key === FUNNEL_REVOKE_KEY
		)
			refreshChoice();
	};
	onMount(() => {
		refreshChoice();
		settingsOpen = initialNotice || revokeFailed;
		window.addEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
		window.addEventListener(ANALYTICS_CONSENT_EVENT, refreshChoice);
		window.addEventListener('storage', syncOtherTab);
		return () => {
			window.removeEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
			window.removeEventListener(ANALYTICS_CONSENT_EVENT, refreshChoice);
			window.removeEventListener('storage', syncOtherTab);
		};
	});

	const dismissNotice = (): void => {
		try {
			localStorage.setItem(ANALYTICS_NOTICE_KEY, 'dismissed');
		} catch {
			// The notice may reappear after reload when storage is unavailable.
		}
		initialNotice = false;
		settingsOpen = false;
	};

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

{#if settingsOpen}
	<div
		class="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 text-sm text-gray-700 shadow-xl backdrop-blur md:flex-row md:items-center md:justify-between md:gap-6 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200"
		role="dialog"
		aria-label="Настройки аналитики"
	>
		<p class="leading-relaxed">
			{#if revokeFailed}
				Аналитика в браузере остановлена. Не удалось подтвердить отзыв на сервере. Нажмите
				«Запретить», чтобы повторить.
			{:else if initialNotice}
				Аналитика включена по умолчанию и помогает нам улучшать Airis. Вы можете запретить её —
				основные функции продолжат работать.
			{:else}
				Сейчас аналитика {consent === 'granted' ? 'разрешена' : 'запрещена'}. Вы можете изменить
				выбор.
			{/if}
			<a href="/documents/cookies" class="font-medium text-gray-900 underline dark:text-white"
				>Подробнее</a
			>
		</p>
		<div class="flex shrink-0 flex-wrap justify-end gap-2">
			{#if !initialNotice && consent !== null}
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
				on:click={() => (initialNotice ? dismissNotice() : choose('granted'))}
			>
				{initialNotice ? 'Понятно' : 'Разрешить'}
			</button>
		</div>
	</div>
{/if}
