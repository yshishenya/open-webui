import { describe, expect, it } from 'vitest';

import type { RateCard } from '$lib/apis/admin/billing';
import { getRateCardKey } from '$lib/utils/rate-card-models';

import { buildModelRateDisplayIndex } from './rate_cards';

const buildRateCard = (overrides: Partial<RateCard>): RateCard => ({
	id: 'rate_1',
	model_id: 'model-a',
	modality: 'text',
	unit: 'token_in',
	raw_cost_per_unit_kopeks: 10,
	version: 'v1',
	created_at: 100,
	provider: null,
	model_tier: null,
	is_default: false,
	is_active: true,
	...overrides
});

describe('airis/rate_cards', () => {
	it('buildModelRateDisplayIndex maps and scales display units', () => {
		const index: Record<string, Record<string, RateCard>> = {
			'model-a': {
				[getRateCardKey('text', 'token_in')]: buildRateCard({
					modality: 'text',
					unit: 'token_in',
					raw_cost_per_unit_kopeks: 5
				}),
				[getRateCardKey('text', 'token_out')]: buildRateCard({
					modality: 'text',
					unit: 'token_out',
					raw_cost_per_unit_kopeks: 9
				}),
				[getRateCardKey('image', 'image_1024')]: buildRateCard({
					modality: 'image',
					unit: 'image_1024',
					raw_cost_per_unit_kopeks: 250
				}),
				[getRateCardKey('tts', 'tts_char')]: buildRateCard({
					modality: 'tts',
					unit: 'tts_char',
					raw_cost_per_unit_kopeks: 2
				}),
				[getRateCardKey('stt', 'stt_second')]: buildRateCard({
					modality: 'stt',
					unit: 'stt_second',
					raw_cost_per_unit_kopeks: 3
				})
			}
		};

		const display = buildModelRateDisplayIndex(index);

		expect(display['model-a']?.text_in_1000_tokens).toBe(5);
		expect(display['model-a']?.text_out_1000_tokens).toBe(9);
		expect(display['model-a']?.image_1024).toBe(250);
		expect(display['model-a']?.tts_1000_chars).toBe(2000);
		expect(display['model-a']?.stt_minute).toBe(180);
	});

	it('buildModelRateDisplayIndex ignores inactive entries', () => {
		const index: Record<string, Record<string, RateCard>> = {
			'model-a': {
				[getRateCardKey('text', 'token_in')]: buildRateCard({
					modality: 'text',
					unit: 'token_in',
					raw_cost_per_unit_kopeks: 10,
					is_active: false
				})
			}
		};

		const display = buildModelRateDisplayIndex(index);

		expect(display['model-a']?.text_in_1000_tokens).toBeUndefined();
	});
});

