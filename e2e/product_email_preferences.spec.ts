import { expect, test } from '@playwright/test';
import { getUserMenuTrigger } from './helpers/auth';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en-US');
		localStorage.setItem('airis.analytics.consent.v1', 'denied');
	});
});

test('public unsubscribe keeps GET passive and strips its token before any bootstrap or analytics', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('airis.analytics.consent.v1', 'granted'));
	const token = 'u'.repeat(43);
	const forbidden: string[] = [];
	const unsubscribeBodies: string[] = [];
	page.on('request', (request) => {
		if (/\/api\/config|metrika\/tag|googletagmanager|\/api\/v1\/analytics/.test(request.url()))
			forbidden.push(request.url());
		expect(request.url()).not.toContain(token);
		if (request.url().endsWith('/email-preferences/unsubscribe'))
			unsubscribeBodies.push(request.postData() ?? '');
	});
	await page.route('**/email-preferences/unsubscribe', (route) =>
		route.fulfill({ json: { success: true } })
	);
	await page.goto(`/unsubscribe#token=${token}`);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Отписка от продуктовых писем AIRIS'
	);
	await expect(page).toHaveURL(/\/unsubscribe$/);
	expect(unsubscribeBodies).toHaveLength(0);
	for (const width of [320, 390, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
		await expect(page.getByRole('button', { name: 'Отписаться', exact: true })).toBeVisible();
	}
	await page.getByRole('button', { name: 'Отписаться', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Запрос на отписку обработан');
	expect(unsubscribeBodies).toEqual([JSON.stringify({ token })]);
	expect(forbidden).toEqual([]);
});

test('registration presents a separate unchecked optional choice', async ({ page }) => {
	await page.goto('/auth?form=1');
	await page
		.getByRole('button', { name: /sign up|зарегистрироваться|create account/i })
		.first()
		.click();
	const choice = page.getByRole('checkbox', { name: /Хочу получать советы/ });
	await expect(choice).not.toBeChecked();
	await expect(page.locator('#legal-accept')).not.toBeChecked();
	await choice.check();
	await expect(page.locator('#legal-accept')).not.toBeChecked();
	await expect(page.getByRole('link', { name: 'Условия согласия', exact: true })).toHaveAttribute(
		'href',
		'/documents/product-email-consent'
	);
});

test.describe('saved account choice', () => {
	test.use({ storageState: 'e2e/.auth/admin.json' });
	test('explicit save survives opening settings again and opt-out works', async ({ page }) => {
		const openAccount = async (): Promise<void> => {
			await page.goto('/');
			await (await getUserMenuTrigger(page)).first().click();
			await page.getByRole('button', { name: /Settings|Настройки/, exact: true }).click();
			await page.getByRole('tab', { name: /Account|Аккаунт/ }).click();
		};
		await openAccount();
		const choice = page.getByRole('checkbox', { name: /Хочу получать советы/ });
		await expect(choice).not.toBeChecked();
		await choice.check();
		const saved = page.waitForResponse(
			(response) =>
				response.url().endsWith('/api/v1/email-preferences') &&
				response.request().method() === 'POST'
		);
		await page.getByRole('button', { name: 'Сохранить выбор писем' }).click();
		expect((await saved).status()).toBe(200);
		await expect(page.getByRole('status')).toContainText('Согласие сохранено');
		await openAccount();
		await expect(choice).toBeChecked();
		await choice.uncheck();
		await page.getByRole('button', { name: 'Сохранить выбор писем' }).click();
		await expect(page.getByRole('status')).toContainText('Продуктовые письма отключены');
	});
});
