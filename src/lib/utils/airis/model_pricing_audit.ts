import type { ModelRateDisplay } from '$lib/utils/airis/rate_cards';

export type PricingFocus = 'text' | 'image' | 'audio' | 'all';

export type PricingSortKey =
	| 'model'
	| 'status'
	| 'lead'
	| 'text_in'
	| 'text_out'
	| 'image'
	| 'tts'
	| 'stt';

export type SortDirection = 'asc' | 'desc';

export const getDefaultSortForFocus = (
	focus: PricingFocus
): { sortKey: PricingSortKey; sortDirection: SortDirection } => {
	if (focus === 'text') return { sortKey: 'text_in', sortDirection: 'asc' };
	if (focus === 'image') return { sortKey: 'image', sortDirection: 'asc' };
	if (focus === 'audio') return { sortKey: 'tts', sortDirection: 'asc' };
	return { sortKey: 'model', sortDirection: 'asc' };
};

export const isPriceSortKey = (key: PricingSortKey): boolean => {
	return ['text_in', 'text_out', 'image', 'tts', 'stt'].includes(key);
};

export const getModelPriceSortValue = (
	displayRates: Record<string, ModelRateDisplay | undefined>,
	modelId: string,
	sortKey: PricingSortKey
): number | null => {
	const rates = displayRates[modelId];
	if (!rates) return null;

	if (sortKey === 'text_in') return rates.text_in_1000_tokens ?? null;
	if (sortKey === 'text_out') return rates.text_out_1000_tokens ?? null;
	if (sortKey === 'image') return rates.image_1024 ?? null;
	if (sortKey === 'tts') return rates.tts_1000_chars ?? null;
	if (sortKey === 'stt') return rates.stt_minute ?? null;

	return null;
};

export const compareNullableNumbersMissingLast = (
	left: number | null,
	right: number | null,
	direction: SortDirection
): number => {
	if (left === null && right === null) return 0;
	if (left === null) return 1;
	if (right === null) return -1;
	const delta = left - right;
	return direction === 'asc' ? delta : -delta;
};

