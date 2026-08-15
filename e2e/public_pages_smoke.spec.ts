import { expect, test } from '@playwright/test';

const rateCard = {
	currency: 'RUB',
	updated_at: '2026-08-07T00:00:00Z',
	models: [
		{
			id: 'smoke-model',
			display_name: 'Smoke model',
			capabilities: ['text'],
			rates: {
				text_in_1000_tokens: 10,
				text_out_1000_tokens: 20,
				image_1024: null,
				tts_1000_chars: null,
				stt_minute: null
			}
		}
	]
};

test.describe('Public pages', () => {
	test.beforeEach(async ({ page }) => {
		await page.route('**/api/v1/billing/public/rate-cards', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(rateCard)
			})
		);
		await page.route('**/api/v1/billing/public/pricing-config', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					topup_amounts_rub: [500, 1000],
					free_limits: { text_in: 1000, text_out: 1000, images: 0, tts_minutes: 0, stt_minutes: 0 },
					popular_model_ids: ['smoke-model'],
					recommended_model_ids: { text: 'smoke-model' }
				})
			})
		);
		await page.route('**/api/v1/billing/public/lead-magnet', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					enabled: true,
					cycle_days: 30,
					quotas: {
						tokens_input: 1000,
						tokens_output: 1000,
						images: 0,
						tts_seconds: 0,
						stt_seconds: 0
					}
				})
			})
		);
	});

	test('features is task-first and opens a real preset path', async ({ page }) => {
		await page.goto('/features');
		await expect(
			page.getByRole('heading', { name: 'AI-модели — в одном понятном чате' })
		).toBeVisible();
		await page.getByRole('button', { name: 'Открыть в Airis' }).first().click();
		await page.waitForURL(/\/auth\?/);
		const url = new URL(page.url());
		expect(url.searchParams.get('preset')).toBeTruthy();
		expect(url.searchParams.get('q')).toBeTruthy();
	});

	test('login from welcome bootstraps auth configuration', async ({ page }) => {
		await page.goto('/welcome');
		const configResponse = page.waitForResponse(
			(response) => new URL(response.url()).pathname === '/api/config' && response.ok()
		);

		await page.getByRole('link', { name: 'Войти' }).click();
		await configResponse;
		await expect(page.locator('#auth-page')).toBeVisible();
	});

	test('pricing never shows an unavailable estimate', async ({ page }) => {
		await page.goto('/pricing');
		await expect(
			page.getByRole('heading', { name: 'Оплата по использованию — без подписки' })
		).toBeVisible();
		await expect(page.getByText('≈ —')).toHaveCount(0);
	});

	test('secondary pages have one path back to the product', async ({ page }) => {
		for (const path of ['/about', '/contact', '/documents']) {
			await page.goto(path);
			await expect(page.locator('a[href="/welcome"]').first()).toBeVisible();
		}
		await page.goto('/documents/consent');
		await expect(page.getByRole('link', { name: 'Документы' })).toHaveAttribute(
			'href',
			'/documents'
		);
	});
});
