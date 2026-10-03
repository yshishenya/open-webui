import { describe, expect, it } from 'vitest';

import type { PublicRateCardModel } from '$lib/apis/billing';

import {
	calculateTextEstimate,
	calculateUsageEstimate,
	pickCheapestTextModel
} from './pricing_estimator';

const model = (id: string, input: number, output: number): PublicRateCardModel => ({
	id,
	display_name: id,
	capabilities: ['text'],
	rates: {
		text_in_1000_tokens: input,
		text_out_1000_tokens: output,
		image_1024: null,
		tts_1000_chars: null,
		stt_minute: null
	}
});

describe('pricing estimator', () => {
	it('uses the explicit model recommendation when it has text rates', () => {
		const models = [model('cheap', 1, 3), model('recommended', 30, 150)];

		expect(pickCheapestTextModel(models, 'recommended')?.id).toBe('recommended');
	});

	it('falls back to the cheapest text model without mutating catalog order', () => {
		const models = [model('expensive', 30, 150), model('cheap', 1, 3)];

		expect(pickCheapestTextModel(models)?.id).toBe('cheap');
		expect(models.map((item) => item.id)).toEqual(['expensive', 'cheap']);
	});

	it('calculates a cumulative-context monthly estimate', () => {
		const estimate = calculateTextEstimate(model('balanced', 10, 39), 80, 80, 10, {
			min: 0.85,
			max: 1.2
		});

		expect(estimate).toEqual({ min: 62322, max: 87984 });
	});

	it('separates independent chats from a cumulative long chat', () => {
		expect(
			calculateTextEstimate(model('balanced', 10, 39), 80, 80, 10, { min: 1, max: 1 }, 'separate')
		).toEqual({ min: 1500, max: 1500 });
	});

	it('does not produce a negative estimate for invalid message counts', () => {
		const estimate = calculateTextEstimate(model('cheap', 1, 3), 80, 80, -1.5, {
			min: 0.85,
			max: 1.2
		});

		expect(estimate).toEqual({ min: 0, max: 0 });
	});
	it('rejects negative, infinite, and fractional indivisible quantities', () => {
		for (const kind of ['image', 'tts', 'stt'] as const)
			for (const value of [-1, Infinity, Number('1e309'), NaN, 0])
				expect(calculateUsageEstimate(10, value, kind, { min: 1, max: 1 })).toBeNull();
		expect(calculateUsageEstimate(10, 1.5, 'image', { min: 1, max: 1 })).toBeNull();
		expect(calculateUsageEstimate(10, 1.5, 'tts', { min: 1, max: 1 })).toBeNull();
		expect(calculateUsageEstimate(10, 0.5, 'stt', { min: 1, max: 1 })).toEqual({ min: 5, max: 5 });
		expect(calculateUsageEstimate(10, 43201, 'stt', { min: 1, max: 1 })).toBeNull();
	});
});
