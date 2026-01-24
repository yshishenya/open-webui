import { describe, expect, it } from 'vitest';

import type { RateCard } from '$lib/apis/admin/billing';
import { buildLatestRateCardIndex, buildModelRows, getRateCardKey } from './rate-card-models';

const buildRateCard = (overrides: Partial<RateCard>): RateCard => ({
	id: 'rate_1',
	model_id: 'model-a',
	modality: 'text',
	unit: 'token_in',
	raw_cost_per_unit_kopeks: 10,
	version: 'v1',
	effective_from: 100,
	effective_to: null,
	provider: null,
	model_tier: null,
	is_default: false,
	is_active: true,
	...overrides
});

describe('rate-card-models', () => {
	it('getRateCardKey combines modality and unit', () => {
		expect(getRateCardKey('text', 'token_in')).toBe('text:token_in');
	});

	it('buildLatestRateCardIndex keeps latest effective_from', () => {
		const entries = [
			buildRateCard({ id: 'rate_old', effective_from: 100, raw_cost_per_unit_kopeks: 5 }),
			buildRateCard({ id: 'rate_new', effective_from: 200, raw_cost_per_unit_kopeks: 8 })
		];

		const index = buildLatestRateCardIndex(entries);

		expect(index['model-a']).toBeDefined();
		expect(index['model-a']['text:token_in']?.id).toBe('rate_new');
		expect(index['model-a']['text:token_in']?.raw_cost_per_unit_kopeks).toBe(8);
	});

	it('buildLatestRateCardIndex prefers active entries', () => {
		const entries = [
			buildRateCard({ id: 'rate_inactive', effective_from: 200, is_active: false }),
			buildRateCard({ id: 'rate_active', effective_from: 100, is_active: true })
		];

		const index = buildLatestRateCardIndex(entries);

		expect(index['model-a']['text:token_in']?.id).toBe('rate_active');
	});

	it('buildModelRows marks configured models', () => {
		const models = [
			{ id: 'model-a', name: 'Alpha' },
			{ id: 'model-b', name: 'Beta' }
		];
		const entries = [buildRateCard({ model_id: 'model-b', id: 'rate_b' })];

		const rows = buildModelRows(models, entries);

		expect(rows.map((row) => row.id)).toEqual(['model-a', 'model-b']);
		expect(rows.find((row) => row.id === 'model-a')?.status).toBe('new');
		expect(rows.find((row) => row.id === 'model-b')?.status).toBe('configured');
	});
});
