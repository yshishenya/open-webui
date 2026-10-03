import { expect, test } from './helpers/billing-ui-local-auth';

const balanceResponse = {
	balance_topup_kopeks: 25000,
	balance_included_kopeks: 5000,
	included_expires_at: 1710000000,
	max_reply_cost_kopeks: 10000,
	daily_cap_kopeks: 50000,
	daily_spent_kopeks: 1200,
	auto_topup_enabled: false,
	auto_topup_threshold_kopeks: 5000,
	auto_topup_amount_kopeks: 50000,
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
		await page.addInitScript(() => {
			localStorage.setItem('locale', 'en-US');
			localStorage.setItem('settings', JSON.stringify({ version: '0.11.0' }));
		});
		await page.route('**/api/v1/users/user/settings', (route) =>
			route.fulfill({ json: { ui: { version: '0.11.0' } } })
		);
		await page.route('**/api/v1/billing/summary?*', (route) =>
			route.fulfill({
				json: { currency: 'RUB', topup_kopeks: 19900, spent_kopeks: 500, refund_kopeks: 0 }
			})
		);
		await page.route('**/api/v1/billing/refunds?*', (route) =>
			route.fulfill({ json: { items: [], total: 0 } })
		);
		await page.route('**/api/v1/billing/public/pricing-config', (route) =>
			route.fulfill({ json: { topup_amounts_rub: [500, 1000, 2000] } })
		);
		await page.route('**/api/v1/billing/topup/reconcile', (route) =>
			route.fulfill({ json: { credited: false, provider_status: 'pending' } })
		);

		await page.route('**/api/v1/legal/status', async (route) => {
			await route.fulfill({
				json: {
					needs_accept: false,
					docs: [],
					accepted: {}
				}
			});
		});

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
		await page.goto('/billing/balance?focus=auto_topup');
		await expect(
			page.getByRole('heading', { name: 'Payment settings', exact: true })
		).toBeVisible();

		const autoTopupSection = page.locator('#auto-topup-section');
		await autoTopupSection.getByRole('switch').click();
		await autoTopupSection.locator('input[name=auto_topup_threshold]').fill('50');
		await autoTopupSection.locator('select[name=auto_topup_amount]').selectOption('500.00');

		const updateRequest = page.waitForRequest('**/api/v1/billing/auto-topup');
		await autoTopupSection.getByRole('button', { name: 'Save auto-topup', exact: true }).click();
		const request = await updateRequest;
		const body = JSON.parse(request.postData() ?? '{}');

		expect(body).toEqual({
			enabled: true,
			threshold_kopeks: 5000,
			amount_kopeks: 50000
		});
	});

	test('user can start a top-up flow', async ({ page }) => {
		await page.goto('/billing/balance');

		const topupSection = page.locator('#topup-section');
		const topupRequest = page.waitForRequest('**/api/v1/billing/topup');
		await topupSection.getByTestId('topup-preset').first().click();
		await topupSection.getByTestId('topup-proceed').click();
		const request = await topupRequest;
		const body = JSON.parse(request.postData() ?? '{}');
		expect(body).toHaveProperty('amount_kopeks');
		expect(body).toHaveProperty('return_url');
		const returnUrl = new URL(String(body.return_url));
		expect(['http:', 'https:']).toContain(returnUrl.protocol);
		expect(returnUrl.origin).toBe(new URL(page.url()).origin);
		expect(returnUrl.pathname.endsWith('/billing/balance')).toBeTruthy();
		expect(returnUrl.searchParams.get('topup_return')).toBe('1');
		expect(returnUrl.hash).toBe('');

		await expect(page).toHaveURL(/\/billing\/balance\?topup=1/);
	});

	test('user can view ledger history', async ({ page }) => {
		await page.goto('/billing/history?from_date=2024-03-09&to_date=2024-03-10');
		await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible();
		await expect(page.getByText('All activity in one place')).toBeVisible();
		await expect(page.getByRole('button', { name: 'All activity' })).toBeVisible();
		await expect(page.getByText('Top-up', { exact: true })).toBeVisible();
		await expect(page.getByText('Charge', { exact: true })).toBeVisible();
	});

	test('user can update billing settings', async ({ page }) => {
		await page.goto('/billing/settings');
		await page.waitForURL(/\/billing\/balance/);
		await expect(page.getByText('Spend controls')).toBeVisible();

		await page.locator('input[name=max_reply_cost]').fill('125');
		await page.locator('input[name=daily_cap]').fill('250');
		await page.getByText('Email').locator('xpath=..').locator('input').fill('ops@example.com');
		await page.getByText('Phone').locator('xpath=..').locator('input').fill('+7 999 123-45-67');

		const spendControlsSection = page.getByText('Spend controls').locator('xpath=..');
		const contactsSection = page.getByText('Where to send receipts').locator('xpath=..');

		const limitsRequest = page.waitForRequest('**/api/v1/billing/settings');
		const limitsResponse = page.waitForResponse('**/api/v1/billing/settings');
		await spendControlsSection.getByRole('button', { name: 'Save limits', exact: true }).click();
		const limitsReq = await limitsRequest;
		await limitsResponse;
		const limitsBody = JSON.parse(limitsReq.postData() ?? '{}');

		expect(limitsBody).toEqual({
			max_reply_cost_kopeks: 12500,
			daily_cap_kopeks: 25000
		});

		await expect(
			contactsSection.getByRole('button', { name: 'Save contacts', exact: true })
		).toBeEnabled();

		const contactsRequest = page.waitForRequest('**/api/v1/billing/settings');
		const contactsResponse = page.waitForResponse('**/api/v1/billing/settings');
		await contactsSection.getByRole('button', { name: 'Save contacts', exact: true }).click();
		const contactsReq = await contactsRequest;
		await contactsResponse;
		const contactsBody = JSON.parse(contactsReq.postData() ?? '{}');

		expect(contactsBody).toEqual({
			billing_contact_email: 'ops@example.com',
			billing_contact_phone: '+7 999 123-45-67'
		});
	});

	test('wallet hero shows topup and payment settings are a separate destination', async ({
		page
	}) => {
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
		const heroHeading = page.getByRole('heading', { name: 'Balance and spending' });
		await expect(heroHeading).toBeVisible();
		const heroRow = heroHeading.locator('xpath=../../..');
		await expect(
			heroRow.getByRole('button', { name: 'Top up balance', exact: true })
		).toBeVisible();

		await expect(page.getByText('Auto-topup', { exact: true })).toHaveCount(0);
		await page.getByRole('link', { name: 'Payment settings', exact: true }).click();
		await expect(
			page.getByRole('heading', { name: 'Payment settings', exact: true })
		).toBeVisible();
		await expect(page.getByText('Auto-topup', { exact: true })).toBeVisible();
		await page.getByRole('link', { name: 'Balance and spending', exact: true }).click();

		await page.getByRole('link', { name: 'View history' }).click();
		await expect(page).toHaveURL(/\/billing\/history/);
	});
});
