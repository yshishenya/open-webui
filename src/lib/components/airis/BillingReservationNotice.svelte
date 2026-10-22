<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { ChatHistory } from '$lib/utils/airis/chat_history';
	import { getI18nLocale } from '$lib/utils/airis/i18n_locale';
	import {
		billingReservationMessage,
		currentBillingReservations,
		type BillingReservationNotice
	} from '$lib/utils/airis/billing_reservation';
	const i18n: Writable<I18n> = getContext('i18n');
	export let notices: Record<string, BillingReservationNotice> = {};
	export let chatId: string;
	export let history: ChatHistory;
	$: visible = currentBillingReservations(notices, chatId, history);
</script>

{#if visible.length > 0}
	<div
		role="status"
		aria-live="polite"
		class="mx-auto mb-2 w-full max-w-3xl px-4 text-xs text-gray-600 dark:text-gray-300"
	>
		{#each visible as notice (notice.message_id)}
			<p>
				<span class="font-medium">{notice.model_id}:</span>
				{$i18n.t(billingReservationMessage(notice.reason))}
				{#if notice.free_reset_at !== null && notice.reason !== 'paid_model'}
					{$i18n.t('Free quota renews at {{time}}.', {
						time: new Date(notice.free_reset_at * 1000).toLocaleString(getI18nLocale($i18n))
					})}
				{/if}
			</p>
		{/each}
		<p>{$i18n.t('Final cost depends on actual usage. This is not a charge confirmation.')}</p>
	</div>
{/if}
