import { test as base, expect } from '@playwright/test';

// These regression tests use disposable local accounts and mock all payment writes.
export const test = base.extend({
	storageState: process.env.BILLING_UI_DISPOSABLE_AUTH === '1' ? undefined : 'e2e/.auth/admin.json',
	page: async ({ page, request }, use) => {
		if (process.env.BILLING_UI_DISPOSABLE_AUTH !== '1') {
			await use(page);
			return;
		}
		const url = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');
		if (!['localhost', '127.0.0.1', 'host.docker.internal', 'airis-e2e'].includes(url.hostname))
			throw new Error('Billing UI fixtures require a disposable local app');
		const response = await request.post('/api/v1/auths/signin', {
			data: { email: 'analytics-ui-user@example.com', password: 'local-test-only' }
		});
		expect(response.ok()).toBe(true);
		const { token } = (await response.json()) as { token: string };
		await page.addInitScript((token) => {
			localStorage.setItem('token', token);
			localStorage.setItem('locale', 'en-US');
			localStorage.setItem('settings', JSON.stringify({ version: '0.11.0' }));
			localStorage.setItem('airis.analytics.consent.v1', 'denied');
		}, token);
		await use(page);
	}
});
export { expect };
