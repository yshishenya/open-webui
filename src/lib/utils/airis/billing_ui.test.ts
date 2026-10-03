import { describe, expect, it } from 'vitest';
import {
	hasFreeTextQuota,
	isTechnicalBillingEntry,
	parseBillingMoney,
	paymentReturnState
} from './billing_ui';
import type { LeadMagnetInfo, LedgerEntry, TopupReconcileResponse } from '$lib/apis/billing';
const reconcile = (overrides: Partial<TopupReconcileResponse>): TopupReconcileResponse => ({
	payment_id: 'payment',
	credited: false,
	...overrides
});
const ledger = (overrides: Partial<LedgerEntry>): LedgerEntry => ({
	id: 'entry',
	user_id: 'user',
	wallet_id: 'wallet',
	balance_included_after: 0,
	balance_topup_after: 0,
	type: 'adjustment',
	amount_kopeks: -200,
	currency: 'RUB',
	created_at: 1,
	...overrides
});
describe('billing money and confirmed states', () => {
	it('parses whole money input without truncating invalid suffixes or rounding fractions', () => {
		expect(parseBillingMoney('12,50')).toBe(1250);
		expect(parseBillingMoney(' 0 ')).toBe(0);
		for (const invalid of ['12abc', '1.234', '1,2,3', '-1', '1e3', '', '9007199254740991'])
			expect(parseBillingMoney(invalid)).toBeNull();
	});
	it('does not claim credit for a canceled, pending, or provider-only success', () => {
		expect(paymentReturnState(null)).toBe('unknown');
		expect(paymentReturnState(reconcile({ provider_status: 'canceled' }))).toBe('canceled');
		expect(paymentReturnState(reconcile({ provider_status: 'pending' }))).toBe('pending');
		expect(paymentReturnState(reconcile({ provider_status: 'succeeded' }))).toBe('uncredited');
		expect(paymentReturnState(reconcile({ credited: true, provider_status: 'succeeded' }))).toBe(
			'success'
		);
	});
	it('hides only reserve machinery and the settlement delta already included in usage', () => {
		expect(isTechnicalBillingEntry(ledger({ type: 'hold' }))).toBe(true);
		expect(isTechnicalBillingEntry(ledger({ metadata_json: { reason: 'hold_overage' } }))).toBe(
			true
		);
		expect(
			isTechnicalBillingEntry(ledger({ metadata_json: { reason: 'manual_correction' } }))
		).toBe(false);
	});
	it('does not promise a free text reply when only an unrelated quota remains', () => {
		const quotas = {
			tokens_input: 0,
			tokens_output: 100,
			images: 10,
			tts_seconds: 0,
			stt_seconds: 0
		};
		const info: LeadMagnetInfo = {
			enabled: true,
			cycle_start: null,
			cycle_end: null,
			usage: quotas,
			quotas,
			remaining: quotas,
			config_version: 1
		};
		expect(hasFreeTextQuota(info)).toBe(false);
		expect(hasFreeTextQuota({ ...info, remaining: { ...quotas, tokens_input: 100 } })).toBe(true);
	});
});
