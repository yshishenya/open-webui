// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import BillingReservationNotice from './BillingReservationNotice.svelte';
import type { ChatHistory } from '$lib/utils/airis/chat_history';
import type { BillingReservation } from '$lib/utils/airis/billing_reservation';

const history: ChatHistory = {
	currentId: 'reply',
	messages: { reply: { id: 'reply', parentId: 'prompt', childrenIds: [], role: 'assistant' } }
};

it.each(['free_quota', 'free_quota_insufficient', 'free_quota_exhausted', 'paid_model'] as const)(
	'renders %s near the composer with no consent step',
	async (reason) => {
		const target = document.createElement('div');
		document.body.append(target);
		const reservation: BillingReservation = {
			request_id: 'operation',
			model_id: 'gpt-6-luna',
			billing_source: reason === 'free_quota' ? 'lead_magnet' : 'payg',
			reason,
			free_reset_at: 2000000000
		};
		const component = mount(BillingReservationNotice, {
			target,
			props: {
				chatId: 'chat',
				history,
				notices: { operation: { ...reservation, chat_id: 'chat', message_id: 'reply' } }
			},
			context: new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]])
		});
		try {
			if (reason === 'free_quota') expect(target.querySelector('[role="status"]')).toBeNull();
			else {
				expect(target.querySelector('[role="status"]')).toBeTruthy();
				expect(target.textContent).toContain('will use your wallet');
				expect(target.textContent).toContain('not a charge confirmation');
				expect(target.textContent?.includes('exhausted')).toBe(reason === 'free_quota_exhausted');
				expect(target.textContent?.includes('whole reply')).toBe(
					reason === 'free_quota_insufficient'
				);
			}
			expect(target.querySelector('button, input')).toBeNull();
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);
