import { expect, test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/admin.json' });

const leadMagnetInfoResponse = {
	enabled: true,
	cycle_start: 1710000000,
	cycle_end: 1712592000,
	usage: {
		tokens_input: 1200,
		tokens_output: 800,
		images: 0,
		tts_seconds: 0,
		stt_seconds: 0
	},
	quotas: {
		tokens_input: 5000,
		tokens_output: 3000,
		images: 0,
		tts_seconds: 0,
		stt_seconds: 0
	},
	remaining: {
		tokens_input: 3800,
		tokens_output: 2200,
		images: 0,
		tts_seconds: 0,
		stt_seconds: 0
	},
	config_version: 1
};

const billingInfoResponse = {
	subscription: null,
	plan: null,
	usage: {},
	transactions: [],
	lead_magnet: leadMagnetInfoResponse
};

const balanceResponse = {
	balance_topup_kopeks: 25000,
	balance_included_kopeks: 5000,
	included_expires_at: 1710000000,
	max_reply_cost_kopeks: 10000,
	daily_cap_kopeks: 50000,
	daily_spent_kopeks: 1200,
	auto_topup_enabled: false,
	auto_topup_threshold_kopeks: 5000,
	auto_topup_amount_kopeks: 19900,
	auto_topup_fail_count: 0,
	auto_topup_last_failed_at: null,
	currency: 'RUB'
};

test.describe('Billing Lead Magnet', () => {
	test.beforeEach(async ({ page }) => {
		await page.route('**/api/v1/legal/status', async (route) => {
			await route.fulfill({
				json: {
					needs_accept: false,
					docs: [],
					accepted: {}
				}
			});
		});

		await page.route('**/api/v1/billing/me', async (route) => {
			await route.fulfill({ json: billingInfoResponse });
		});
		await page.route('**/api/v1/billing/lead-magnet', async (route) => {
			await route.fulfill({ json: leadMagnetInfoResponse });
		});
		await page.route('**/api/v1/billing/balance', async (route) => {
			await route.fulfill({ json: balanceResponse });
		});
		await page.route('**/api/v1/users/user/info', async (route) => {
			await route.fulfill({ json: { billing_contact_email: '', billing_contact_phone: '' } });
		});
		await page.route('**/api/v1/billing/ledger*', async (route) => {
			await route.fulfill({ json: [] });
		});
	});

	test('dashboard redirects to wallet and shows free limit', async ({ page }) => {
		await page.goto('/billing/dashboard');
		await page.waitForURL(/\/billing\/balance/);
		await page.waitForResponse('**/api/v1/billing/lead-magnet');

		const leadMagnetSection = page.getByTestId('lead-magnet-section');
		await expect(leadMagnetSection.getByText('Free limit')).toBeVisible();
		await expect(leadMagnetSection.getByText('Next reset')).toBeVisible();
		await expect(leadMagnetSection.getByText('Text', { exact: true })).toBeVisible();
		await expect(leadMagnetSection.getByText('Input', { exact: true })).toBeVisible();
	});

	test('wallet shows free limit summary', async ({ page }) => {
		await page.goto('/billing/balance');
		await page.waitForResponse('**/api/v1/billing/lead-magnet');

		const leadMagnetSection = page.getByTestId('lead-magnet-section');
		await expect(leadMagnetSection.getByText('Free limit')).toBeVisible();
		await expect(leadMagnetSection.getByText('Next reset')).toBeVisible();
		await expect(leadMagnetSection.getByText('Output', { exact: true })).toBeVisible();
	});
});
