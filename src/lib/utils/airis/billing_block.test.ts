import { describe, expect, it } from 'vitest';
import { parseBillingBlockedDetail } from './billing_block';

describe('daily-cap explanation facts', () => {
	it('preserves zero caps and known holds, while missing or invalid holds remain unknown', () => {
		const detail = {
			error: 'daily_cap_exceeded',
			daily_cap_kopeks: 0,
			daily_spent_kopeks: 0,
			daily_reserved_kopeks: 750,
			required_kopeks: 250
		};
		expect(parseBillingBlockedDetail(detail)).toMatchObject({
			daily_cap_kopeks: 0,
			daily_reserved_kopeks: 750,
			required_kopeks: 250
		});
		for (const value of [undefined, NaN, '750']) {
			expect(parseBillingBlockedDetail({ ...detail, daily_reserved_kopeks: value })).toMatchObject({
				daily_reserved_kopeks: null
			});
		}
	});
});
