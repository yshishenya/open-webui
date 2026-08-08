import { describe, expect, it } from 'vitest';

import type { PublicRateCardModel } from '$lib/apis/billing';

import { calculateTextEstimate, pickCheapestTextModel } from './pricing_estimator';

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

	it('does not produce a negative estimate for invalid message counts', () => {
		const estimate = calculateTextEstimate(model('cheap', 1, 3), 80, 80, -1.5, {
			min: 0.85,
			max: 1.2
		});

		expect(estimate).toEqual({ min: 0, max: 0 });
	});
});
