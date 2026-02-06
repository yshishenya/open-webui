import { expect, test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/admin.json' });

const lowBalanceResponse = {
	balance_topup_kopeks: 0,
	balance_included_kopeks: 0,
	included_expires_at: null,
	max_reply_cost_kopeks: null,
	daily_cap_kopeks: null,
	daily_spent_kopeks: 0,
	auto_topup_enabled: false,
	auto_topup_threshold_kopeks: 5000,
	auto_topup_amount_kopeks: 19900,
	auto_topup_fail_count: 0,
	auto_topup_last_failed_at: null,
	currency: 'RUB'
};

const leadMagnetInfoResponse = {
	enabled: true,
	cycle_start: 1710000000,
	cycle_end: 1712592000,
	usage: {
		tokens_input: 0,
		tokens_output: 0,
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
		tokens_input: 5000,
		tokens_output: 3000,
		images: 0,
		tts_seconds: 0,
		stt_seconds: 0
	},
	config_version: 1
};

test.describe('Billing wallet recovery (smoke)', () => {
	test.beforeEach(async ({ page }) => {
		await page.route('**/api/v1/legal/status', async (route) => {
			await route.fulfill({
				json: {
					needs_accept: false,
					docs: [
						{
							key: 'terms_offer',
							required: true,
							title: 'Terms',
							version: '2026-02-05',
							accepted_version: '2026-02-05',
							url: '/legal/terms'
						},
						{
							key: 'privacy_policy',
							required: true,
							title: 'Privacy',
							version: '2026-02-05',
							accepted_version: '2026-02-05',
							url: '/legal/privacy'
						}
					],
					accepted: {
						terms_offer: '2026-02-05',
						privacy_policy: '2026-02-05'
					}
				}
			});
		});

		await page.route('**/api/v1/billing/balance', async (route) => {
			await route.fulfill({ json: lowBalanceResponse });
		});
		await page.route('**/api/v1/billing/lead-magnet', async (route) => {
			await route.fulfill({ json: leadMagnetInfoResponse });
		});
		await page.route('**/api/v1/billing/ledger*', async (route) => {
			await route.fulfill({ json: [] });
		});
		await page.route('**/api/v1/billing/usage-events*', async (route) => {
			await route.fulfill({ json: [] });
		});
		await page.route('**/api/v1/users/user/info', async (route) => {
			await route.fulfill({ json: { billing_contact_email: '', billing_contact_phone: '' } });
		});
		await page.route('**/api/v1/billing/topup', async (route) => {
			await route.fulfill({
				json: {
					payment_id: 'pay_1',
					status: 'pending',
					confirmation_url: '/billing/balance?topup=1'
				}
			});
		});
	});

	test('shows low-balance UX, lead magnet section, and topup wiring works', async ({ page }) => {
		await page.goto('/billing/balance');
		await page.waitForResponse('**/api/v1/billing/balance');
		await page.waitForResponse('**/api/v1/billing/lead-magnet');

		const whatsNewDialog = page.getByRole('dialog').filter({ hasText: "What's New" });
		const whatsNewCloseButton = whatsNewDialog.getByRole('button', { name: 'Close' });
		if ((await whatsNewCloseButton.count()) > 0) {
			await whatsNewCloseButton.first().click();
		}

		await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
		await expect(page.getByText('Low balance')).toBeVisible();
		await expect(page.getByText('Wallet balance is low. Free limit:')).toBeVisible();
		const heroHeading = page.getByRole('heading', { name: 'Wallet' });
		const heroRow = heroHeading.locator('xpath=../../..');
		await expect(heroRow.getByRole('button', { name: 'Top up' })).toBeVisible();

		const leadMagnetSection = page.getByTestId('lead-magnet-section');
		await expect(leadMagnetSection.getByText('Free limit')).toBeVisible();

		const topupSection = page.locator('#topup-section');
		const topupRequest = page.waitForRequest('**/api/v1/billing/topup');
		await topupSection.getByRole('button').first().click();
		await topupSection.getByRole('button', { name: 'Proceed to payment' }).click();

		const request = await topupRequest;
		const body = JSON.parse(request.postData() ?? '{}');
		expect(body).toHaveProperty('amount_kopeks');
		expect(body).toHaveProperty('return_url');

		await expect(page).toHaveURL(/\/billing\/balance\?topup=1/);
	});
});
