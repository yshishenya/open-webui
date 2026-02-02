import { expect, test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/admin.json' });

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
	auto_topup_fail_count: 1,
	auto_topup_last_failed_at: null,
	currency: 'RUB'
};

const ledgerResponse = [
	{
		id: 'entry_1',
		user_id: 'user_1',
		wallet_id: 'wallet_1',
		currency: 'RUB',
		type: 'topup',
		amount_kopeks: 19900,
		balance_included_after: 0,
		balance_topup_after: 19900,
		reference_id: 'pay_123456',
		reference_type: 'topup',
		created_at: 1710000000
	},
	{
		id: 'entry_2',
		user_id: 'user_1',
		wallet_id: 'wallet_1',
		currency: 'RUB',
		type: 'charge',
		amount_kopeks: -500,
		balance_included_after: 0,
		balance_topup_after: 19400,
		reference_id: 'req_abc',
		reference_type: 'chat_completion',
		created_at: 1710001000
	}
];

const userInfoResponse = {
	billing_contact_email: 'billing@example.com',
	billing_contact_phone: '+7 999 000-00-00'
};

test.describe('Billing Wallet', () => {
	test.beforeEach(async ({ page }) => {
		await page.route('**/api/v1/billing/balance', async (route) => {
			await route.fulfill({ json: balanceResponse });
		});
		await page.route('**/api/v1/billing/lead-magnet', async (route) => {
			await route.fulfill({ json: { enabled: false } });
		});
		await page.route('**/api/v1/billing/ledger*', async (route) => {
			await route.fulfill({ json: ledgerResponse });
		});
		await page.route('**/api/v1/billing/usage-events*', async (route) => {
			await route.fulfill({ json: [] });
		});
		await page.route('**/api/v1/users/user/info', async (route) => {
			await route.fulfill({ json: userInfoResponse });
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
		await page.route('**/api/v1/billing/auto-topup', async (route) => {
			await route.fulfill({ json: { status: 'ok' } });
		});
		await page.route('**/api/v1/billing/settings', async (route) => {
			await route.fulfill({ json: { status: 'ok' } });
		});
	});

	test('user can update auto-topup settings', async ({ page }) => {
		await page.goto('/billing/balance');
		await expect(page.getByText('Available now')).toBeVisible();

		const autoTopupSection = page.getByText('Auto-topup').locator('xpath=../..');
		await autoTopupSection.getByRole('switch').click();
		await autoTopupSection.getByText('Threshold').locator('xpath=..').locator('input').fill('50');
		await autoTopupSection.getByText('Amount').locator('xpath=..').locator('input').fill('199');

		const updateRequest = page.waitForRequest('**/api/v1/billing/auto-topup');
		await autoTopupSection.getByRole('button', { name: 'Save' }).click();
		const request = await updateRequest;
		const body = JSON.parse(request.postData() ?? '{}');

		expect(body).toEqual({
			enabled: true,
			threshold_kopeks: 5000,
			amount_kopeks: 19900
		});
	});

	test('user can start a top-up flow', async ({ page }) => {
		await page.goto('/billing/balance');
		await page.waitForResponse('**/api/v1/billing/balance');

		const topupSection = page.locator('#topup-section');
		const topupRequest = page.waitForRequest('**/api/v1/billing/topup');
		await topupSection.locator('button').first().click();
		await topupRequest;

		await expect(page).toHaveURL(/\/billing\/balance\?topup=1/);
	});

	test('user can view ledger history', async ({ page }) => {
		await page.goto('/billing/history');
		await page.waitForResponse('**/api/v1/billing/ledger*');
		await expect(page.locator('#billing-container').getByText('History')).toBeVisible();
		await expect(page.getByText('All activity in one place')).toBeVisible();
		await expect(page.getByRole('button', { name: 'All activity' })).toBeVisible();
		await expect(page.getByText('Top-up', { exact: true })).toBeVisible();
		await expect(page.getByText('Charge', { exact: true })).toBeVisible();
	});

	test('user can update billing settings', async ({ page }) => {
		await page.goto('/billing/settings');
		await page.waitForURL(/\/billing\/balance/);
		await page.waitForResponse('**/api/v1/billing/balance');
		await page.waitForResponse('**/api/v1/users/user/info');
		await expect(page.getByText('Spend controls')).toBeVisible();

		await page.getByText('Max reply cost').locator('xpath=..').locator('input').fill('125');
		await page.getByText('Daily cap').locator('xpath=..').locator('input').fill('250');
		await page.getByText('Email').locator('xpath=..').locator('input').fill('ops@example.com');
		await page.getByText('Phone').locator('xpath=..').locator('input').fill('+7 999 123-45-67');

		const updateRequest = page.waitForRequest('**/api/v1/billing/settings');
		const preferencesSection = page.getByText('Spend controls').locator('xpath=..');
		await preferencesSection.getByRole('button', { name: 'Save' }).click();
		const request = await updateRequest;
		const body = JSON.parse(request.postData() ?? '{}');

		expect(body).toEqual({
			max_reply_cost_kopeks: 12500,
			daily_cap_kopeks: 25000,
			billing_contact_email: 'ops@example.com',
			billing_contact_phone: '+7 999 123-45-67'
		});
	});

	test('wallet hero shows topup and advanced settings start collapsed', async ({ page }) => {
		await page.route('**/api/v1/billing/balance', async (route) => {
			await route.fulfill({
				json: {
					...balanceResponse,
					max_reply_cost_kopeks: null,
					daily_cap_kopeks: null,
					auto_topup_enabled: false
				}
			});
		});
		await page.route('**/api/v1/users/user/info', async (route) => {
			await route.fulfill({
				json: { billing_contact_email: '', billing_contact_phone: '' }
			});
		});

		await page.goto('/billing/balance');
		const heroHeading = page.getByRole('heading', { name: 'Wallet' });
		await expect(heroHeading).toBeVisible();
		const heroRow = heroHeading.locator('xpath=../../..');
		await expect(heroRow.getByRole('button', { name: 'Top up' })).toBeVisible();

		const advancedToggle = page.getByRole('button', { name: 'Manage limits & auto-topup' });
		await expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');

		const autoTopupHeader = page.getByText('Auto-topup', { exact: true });
		await expect(autoTopupHeader).toHaveCount(0);

		await advancedToggle.click();
		await expect(advancedToggle).toHaveAttribute('aria-expanded', 'true');
		await expect(autoTopupHeader).toBeVisible();

		await page.getByRole('link', { name: 'View history' }).click();
		await expect(page).toHaveURL(/\/billing\/history/);
	});
});
