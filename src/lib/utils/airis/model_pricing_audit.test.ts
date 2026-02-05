import { describe, expect, it } from 'vitest';

import type { ModelRateDisplay } from '$lib/utils/airis/rate_cards';
import {
	compareNullableNumbersMissingLast,
	getDefaultSortForFocus,
	getModelPriceSortValue,
	isPriceSortKey
} from './model_pricing_audit';

describe('airis/model_pricing_audit', () => {
	it('getDefaultSortForFocus defaults to text input sorting', () => {
		expect(getDefaultSortForFocus('text')).toEqual({ sortKey: 'text_in', sortDirection: 'asc' });
		expect(getDefaultSortForFocus('all')).toEqual({ sortKey: 'model', sortDirection: 'asc' });
	});

	it('isPriceSortKey identifies numeric price keys', () => {
		expect(isPriceSortKey('text_in')).toBe(true);
		expect(isPriceSortKey('model')).toBe(false);
	});

	it('getModelPriceSortValue returns null for missing model rates', () => {
		const index: Record<string, ModelRateDisplay | undefined> = {};
		expect(getModelPriceSortValue(index, 'model-a', 'text_in')).toBeNull();
	});

	it('getModelPriceSortValue maps display fields', () => {
		const index: Record<string, ModelRateDisplay | undefined> = {
			'model-a': {
				text_in_1000_tokens: 10,
				text_out_1000_tokens: 20,
				image_1024: 300,
				tts_1000_chars: 4000,
				stt_minute: 500
			}
		};

		expect(getModelPriceSortValue(index, 'model-a', 'text_in')).toBe(10);
		expect(getModelPriceSortValue(index, 'model-a', 'text_out')).toBe(20);
		expect(getModelPriceSortValue(index, 'model-a', 'image')).toBe(300);
		expect(getModelPriceSortValue(index, 'model-a', 'tts')).toBe(4000);
		expect(getModelPriceSortValue(index, 'model-a', 'stt')).toBe(500);
	});

	it('compareNullableNumbersMissingLast keeps missing values last in both directions', () => {
		expect(compareNullableNumbersMissingLast(null, 1, 'asc')).toBeGreaterThan(0);
		expect(compareNullableNumbersMissingLast(null, 1, 'desc')).toBeGreaterThan(0);
		expect(compareNullableNumbersMissingLast(1, null, 'asc')).toBeLessThan(0);
		expect(compareNullableNumbersMissingLast(1, null, 'desc')).toBeLessThan(0);
	});

	it('compareNullableNumbersMissingLast sorts numerics based on direction', () => {
		expect(compareNullableNumbersMissingLast(1, 2, 'asc')).toBeLessThan(0);
		expect(compareNullableNumbersMissingLast(1, 2, 'desc')).toBeGreaterThan(0);
	});
});

