import { describe, expect, test } from 'vitest';
import { parseWsBillingBlockedDetail } from '$lib/utils/airis/ws_billing_block';

describe('parseWsBillingBlockedDetail', () => {
	test('returns null for irrelevant inputs', () => {
		expect(parseWsBillingBlockedDetail(null)).toBeNull();
		expect(parseWsBillingBlockedDetail(undefined)).toBeNull();
		expect(parseWsBillingBlockedDetail('nope')).toBeNull();
	});

	test('parses structured billing blocked object', () => {
		const parsed = parseWsBillingBlockedDetail({
			error: 'insufficient_funds',
			available_kopeks: 0,
			required_kopeks: 7,
			currency: 'RUB'
		});
		expect(parsed?.error).toBe('insufficient_funds');
	});

	test('parses python-repr string error tail', () => {
		const value = "402: {'error': 'insufficient_funds', 'available_kopeks': 0, 'required_kopeks': 7, 'currency': 'RUB'}";
		expect(parseWsBillingBlockedDetail(value)?.error).toBe('insufficient_funds');
	});

	test('parses error wrapper with content string', () => {
		const value = {
			content:
				"402: {'error': 'max_reply_cost_exceeded', 'max_reply_cost_kopeks': 100, 'required_kopeks': 200}"
		};
		expect(parseWsBillingBlockedDetail(value)?.error).toBe('max_reply_cost_exceeded');
	});

	test('parses structured backend task payload with detail', () => {
		const value = {
			content: 'Top up to keep working',
			detail: { error: 'insufficient_funds', available_kopeks: 0, required_kopeks: 7, currency: 'RUB' },
			status_code: 402
		};
		expect(parseWsBillingBlockedDetail(value)?.error).toBe('insufficient_funds');
	});
});
