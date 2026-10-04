import { describe, it, expect } from 'vitest';
import {
	moneyRange,
	moneyFilters,
	moneyQuery,
	moneyPage,
	reportingBack,
	priceToKopeks,
	paymentLabel,
	ledgerLabel
} from './billing_reporting_ui';
describe('financial report semantics', () => {
	it('normalizes fractional pages and rejects invalid pagination values', () => {
		expect(moneyPage('1.5')).toBe(1);
		expect(moneyPage('3.8')).toBe(3);
		expect(moneyPage('25')).toBe(25);
		for (const value of [null, '', '-5', '0', 'NaN', 'Infinity', '9007199254740992'])
			expect(moneyPage(value)).toBe(1);
	});
	it('uses inclusive UTC start and exclusive next UTC day across month boundaries', () => {
		expect(moneyRange({ currency: 'RUB', fromDate: '2026-09-30', toDate: '2026-10-01' })).toEqual({
			currency: 'RUB',
			from: 1790726400,
			to: 1790899200
		});
	});
	it('rejects reversed, normalized invalid dates and excessive ranges', () => {
		for (const [fromDate, toDate] of [
			['2026-10-02', '2026-10-01'],
			['2026-02-30', '2026-03-01'],
			['2024-01-01', '2026-01-01']
		])
			expect(() => moneyRange({ currency: 'RUB', fromDate, toDate })).toThrow();
	});
	it('has explicit default dates and preserves filters in URL', () => {
		const filters = moneyFilters(
			new URL('https://example/admin/billing?currency=USD'),
			new Date('2026-10-04T10:00:00Z')
		);
		expect(filters).toEqual({ currency: 'USD', fromDate: '2026-09-05', toDate: '2026-10-04' });
		expect(new URLSearchParams(moneyQuery(filters, { page: 3, query: 'Иван' })).get('query')).toBe(
			'Иван'
		);
	});
	it('accepts only local known return destinations', () => {
		expect(reportingBack('https://evil.example')).toBe('/admin/billing/customers');
		expect(reportingBack('//evil.example')).toBe('/admin/billing/customers');
		expect(reportingBack('/admin/billing/customers?page=3')).toBe(
			'/admin/billing/customers?page=3'
		);
	});
	it('converts rubles exactly and rejects ambiguous precision', () => {
		expect(priceToKopeks('12,30')).toBe(1230);
		expect(priceToKopeks('0.01')).toBe(1);
		expect(priceToKopeks('0')).toBe(0);
		for (const value of ['', '12.345', '-1', 'NaN', 'Infinity', '0x10'])
			expect(priceToKopeks(value)).toBeNull();
	});
	it('does not describe zero charge as free or canceled payment as wallet credit', () => {
		expect(ledgerLabel('charge')).toBe('Usage settled');
		expect(paymentLabel('canceled')).toBe('Payment canceled');
	});
});

it('accepts shared analytics dates while money-specific dates take priority', () => {
	expect(
		moneyFilters(new URL('https://example/admin/billing?from=2026-09-01&to=2026-09-30')).fromDate
	).toBe('2026-09-01');
	expect(
		moneyFilters(new URL('https://example/admin/billing?from=2026-09-01&from_date=2026-10-01'))
			.fromDate
	).toBe('2026-10-01');
});

it('distinguishes a wallet ledger refund from a provider payment refund', () => {
	expect(ledgerLabel('refund')).toBe('Wallet credit adjustment');
});
