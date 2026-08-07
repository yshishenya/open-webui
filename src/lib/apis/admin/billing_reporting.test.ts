// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	(globalThis as typeof globalThis & { APP_VERSION: string }).APP_VERSION = 'test';
	(globalThis as typeof globalThis & { APP_BUILD_HASH: string }).APP_BUILD_HASH = 'test';
});
import {
	getBillingReportingCustomers,
	getBillingReportingExportUrl
} from './billing_reporting';

describe('billing reporting API', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ items: [], total: 0 })
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('sends currency and date filters to customer reporting', async () => {
		await getBillingReportingCustomers('token', {
			currency: 'USD',
			from: 100,
			to: 200,
			page: 2,
			page_size: 50
		});

		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining(
				'/admin/billing/reporting/customers?currency=USD&from=100&to=200&page=2&page_size=50'
			),
			expect.objectContaining({ headers: { Authorization: 'Bearer token' } })
		);
	});

	it('builds bounded export URLs with the active reporting context', () => {
		const url = getBillingReportingExportUrl({
			dataset: 'payments',
			currency: 'EUR',
			from: 100,
			to: 200,
			user_id: 'user/1',
			status: 'succeeded'
		});

		expect(url).toContain('dataset=payments');
		expect(url).toContain('currency=EUR');
		expect(url).toContain('from=100');
		expect(url).toContain('to=200');
		expect(url).toContain('user_id=user%2F1');
		expect(url).toContain('status=succeeded');
	});
});
