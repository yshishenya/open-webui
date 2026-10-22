import type { ChatHistory } from './chat_history';

export type BillingReservation = {
	request_id: string;
	model_id: string;
	billing_source: 'lead_magnet' | 'payg';
	reason: 'free_quota' | 'free_quota_insufficient' | 'free_quota_exhausted' | 'paid_model';
	free_reset_at: number | null;
};
export type BillingReservationNotice = BillingReservation & { chat_id: string; message_id: string };

export function parseBillingReservation(value: unknown): BillingReservation | null {
	if (!value || typeof value !== 'object') return null;
	const data = value as Record<string, unknown>;
	if (
		typeof data.request_id !== 'string' ||
		!data.request_id ||
		typeof data.model_id !== 'string' ||
		!data.model_id ||
		typeof data.reason !== 'string' ||
		!['free_quota', 'free_quota_insufficient', 'free_quota_exhausted', 'paid_model'].includes(
			String(data.reason)
		) ||
		(data.reason === 'free_quota'
			? data.billing_source !== 'lead_magnet'
			: data.billing_source !== 'payg') ||
		(data.free_reset_at !== null &&
			data.free_reset_at !== undefined &&
			(typeof data.free_reset_at !== 'number' ||
				!Number.isSafeInteger(data.free_reset_at) ||
				data.free_reset_at < 0))
	)
		return null;
	return {
		request_id: data.request_id,
		model_id: data.model_id,
		billing_source: data.billing_source as BillingReservation['billing_source'],
		reason: data.reason as BillingReservation['reason'],
		free_reset_at: typeof data.free_reset_at === 'number' ? data.free_reset_at : null
	};
}

export function addBillingReservation(
	notices: Record<string, BillingReservationNotice>,
	chatId: string,
	messageId: string,
	value: unknown
): Record<string, BillingReservationNotice> {
	const reservation = parseBillingReservation(value);
	if (!reservation || notices[reservation.request_id]) return notices;
	return {
		...notices,
		[reservation.request_id]: { ...reservation, chat_id: chatId, message_id: messageId }
	};
}

/** Only the latest reservation for each reply in the currently viewed response group. */
export function currentBillingReservations(
	notices: Record<string, BillingReservationNotice>,
	chatId: string,
	history: ChatHistory
): BillingReservationNotice[] {
	const current = history.currentId ? history.messages[history.currentId] : undefined;
	if (!current || current.role !== 'assistant') return [];
	const visibleIds = new Set([current.id]);
	const parent = current.parentId ? history.messages[current.parentId] : undefined;
	if ((parent?.models?.length ?? 1) > 1) {
		// MultiResponseMessages.initHandler selects current in its slot, latest in other slots.
		const children = (parent?.childrenIds ?? [])
			.map((id) => history.messages[id])
			.filter((message) => message?.role === 'assistant' && message.parentId === current.parentId);
		parent?.models?.forEach((model, modelIdx) => {
			const indexed = children.filter((message) => message.modelIdx === modelIdx);
			const group = indexed.length ? indexed : children.filter((message) => message.model === model);
			const selected = group.find((message) => message.id === current.id) ?? group.at(-1);
			if (selected) visibleIds.add(selected.id);
		});
	}
	const latest = new Map<string, BillingReservationNotice>();
	for (const notice of Object.values(notices)) {
		if (notice.chat_id === chatId && visibleIds.has(notice.message_id)) {
			latest.set(notice.message_id, notice);
		}
	}
	return [...latest.values()].filter((notice) => notice.billing_source === 'payg');
}

export function billingReservationMessage(reason: BillingReservation['reason']): string {
	if (reason === 'free_quota_insufficient')
		return 'The remaining free quota cannot cover this request. The whole reply will use your wallet.';
	if (reason === 'free_quota_exhausted')
		return 'Free quota for this request is exhausted. This reply will use your wallet.';
	return 'This request will use your wallet.';
}
