import { describe, expect, it } from 'vitest';
import type { ChatHistory } from './chat_history';
import {
	addBillingReservation,
	billingReservationMessage,
	currentBillingReservations,
	parseBillingReservation
} from './billing_reservation';

const history: ChatHistory = {
	currentId: 'reply',
	messages: {
		user: {
			id: 'user',
			role: 'user',
			parentId: null,
			childrenIds: ['reply', 'sibling'],
			models: ['gpt-6-luna', 'gpt-5.6-luna']
		},
		reply: { id: 'reply', role: 'assistant', parentId: 'user', childrenIds: [], modelIdx: 0 },
		sibling: { id: 'sibling', role: 'assistant', parentId: 'user', childrenIds: [], modelIdx: 1 }
	}
};
const payload = {
	request_id: 'operation',
	model_id: 'gpt-6-luna',
	billing_source: 'payg',
	reason: 'free_quota_insufficient',
	free_reset_at: 2000000000
};

describe('server-authoritative reservation notice', () => {
	it.each(['free_quota_insufficient', 'free_quota_exhausted', 'paid_model'])(
		'accepts %s without claiming a charge',
		(reason) => {
			const result = parseBillingReservation({ ...payload, reason });
			expect(result?.reason).toBe(reason);
			expect(billingReservationMessage(result!.reason)).toContain('will use your wallet');
		}
	);
	it.each([
		null,
		{},
		{ ...payload, reason: 'invented' },
		{ ...payload, billing_source: 'lead_magnet' },
		{ ...payload, free_reset_at: Infinity },
		{ ...payload, free_reset_at: -1 }
	])('ignores malformed or inconsistent events', (value) => {
		expect(parseBillingReservation(value)).toBeNull();
	});
	it('deduplicates delivery, scopes by chat and response group, and clears when a new reservation is free', () => {
		const notices = addBillingReservation({}, 'chat', 'reply', payload);
		expect(addBillingReservation(notices, 'chat', 'reply', payload)).toBe(notices);
		expect(currentBillingReservations(notices, 'chat', history)).toHaveLength(1);
		expect(currentBillingReservations(notices, 'other', history)).toEqual([]);
		expect(currentBillingReservations(notices, 'chat', { ...history, currentId: 'user' })).toEqual(
			[]
		);
		const free = addBillingReservation(notices, 'chat', 'reply', {
			...payload,
			request_id: 'new-operation',
			billing_source: 'lead_magnet',
			reason: 'free_quota'
		});
		expect(currentBillingReservations(free, 'chat', history)).toEqual([]);
		expect(addBillingReservation(free, 'chat', 'reply', payload)).toBe(free);
	});
	it('keeps separate reservations for parallel model replies', () => {
		const first = addBillingReservation({}, 'chat', 'reply', payload);
		const both = addBillingReservation(first, 'chat', 'sibling', {
			...payload,
			request_id: 'second',
			model_id: 'gpt-5.6-luna',
			reason: 'paid_model'
		});
		expect(currentBillingReservations(both, 'chat', history).map((item) => item.model_id)).toEqual([
			'gpt-6-luna',
			'gpt-5.6-luna'
		]);
	});
	it.each([false, true])(
		'hides an old paid regeneration when the selected new reply is free (parallel=%s)',
		(parallel) => {
			const regenerated = structuredClone(history);
			regenerated.messages.user.models = parallel ? history.messages.user.models : ['gpt-6-luna'];
			regenerated.messages.user.childrenIds.push('new-reply');
			regenerated.messages['new-reply'] = { ...regenerated.messages.reply, id: 'new-reply' };
			regenerated.currentId = 'new-reply';
			let notices = addBillingReservation({}, 'chat', 'reply', payload);
			notices = addBillingReservation(notices, 'chat', 'sibling', {
				...payload,
				request_id: 'parallel-paid'
			});
			expect(
				currentBillingReservations(notices, 'chat', regenerated).map((n) => n.message_id)
			).toEqual(parallel ? ['sibling'] : []);
			notices = addBillingReservation(notices, 'chat', 'new-reply', {
				...payload,
				request_id: 'new-free',
				billing_source: 'lead_magnet',
				reason: 'free_quota'
			});
			expect(
				currentBillingReservations(notices, 'chat', regenerated).map((n) => n.message_id)
			).toEqual(parallel ? ['sibling'] : []);
			// Navigating back selects the old reply, even though the newer reply is free.
			regenerated.currentId = 'reply';
			expect(
				currentBillingReservations(notices, 'chat', regenerated).map((n) => n.message_id)
			).toEqual(parallel ? ['reply', 'sibling'] : ['reply']);
		}
	);
	it.each([false, true])('uses the latest other model slot, with legacy model fallback=%s', (legacy) => {
		const regenerated = structuredClone(history);
		regenerated.messages.reply.model = 'gpt-6-luna';
		regenerated.messages.sibling.model = 'gpt-5.6-luna';
		regenerated.messages.user.childrenIds.push('new-sibling');
		regenerated.messages['new-sibling'] = { ...regenerated.messages.sibling, id: 'new-sibling' };
		if (legacy) {
			delete regenerated.messages.reply.modelIdx;
			delete regenerated.messages.sibling.modelIdx;
			delete regenerated.messages['new-sibling'].modelIdx;
		}
		let notices = addBillingReservation({}, 'chat', 'reply', payload);
		notices = addBillingReservation(notices, 'chat', 'sibling', {
			...payload,
			request_id: 'old-other'
		});
		expect(
			currentBillingReservations(notices, 'chat', regenerated).map((n) => n.message_id)
		).toEqual(['reply']);
		notices = addBillingReservation(notices, 'chat', 'new-sibling', {
			...payload,
			request_id: 'new-other'
		});
		expect(
			currentBillingReservations(notices, 'chat', regenerated).map((n) => n.message_id)
		).toEqual(['reply', 'new-sibling']);
	});
	it('keeps parallel slots distinct even when they use the same model ID', () => {
		const sameModel = structuredClone(history);
		sameModel.messages.user.models = ['gpt-6-luna', 'gpt-6-luna'];
		const first = addBillingReservation({}, 'chat', 'reply', payload);
		const both = addBillingReservation(first, 'chat', 'sibling', { ...payload, request_id: 'second' });
		expect(currentBillingReservations(both, 'chat', sameModel).map((n) => n.message_id)).toEqual([
			'reply',
			'sibling'
		]);
	});
	it('does not confuse a paid model with exhausted free quota', () => {
		expect(billingReservationMessage('paid_model')).not.toContain('quota');
		expect(billingReservationMessage('free_quota_insufficient')).toContain('whole reply');
		expect(billingReservationMessage('free_quota_exhausted')).toContain('exhausted');
	});
});
