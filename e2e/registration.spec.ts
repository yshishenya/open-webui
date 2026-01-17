import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { adminUser, ensureAdmin, loginAdmin } from './helpers/auth';

const openUserMenu = async (page: Page): Promise<void> => {
	const userMenuButton = page.locator(
		'button[aria-label="User menu"], button[aria-label="Open User Profile Menu"]'
	);
	await expect(userMenuButton).toBeVisible();
	await userMenuButton.click();
};

test.describe('Registration and Login', () => {
	test('should register a new user as pending', async ({ page }) => {
		await page.addInitScript(() => {
			window.localStorage.setItem('locale', 'en-US');
		});
		await page.goto('/auth?form=1');

		const userName = `Test User - ${Date.now()}`;
		const userEmail = `e2e-${Date.now()}@example.com`;

		if ((await page.locator('input[autocomplete="name"]').count()) === 0) {
			await page.getByRole('button', { name: /sign up|зарегистрироваться/i }).click();
		}
		await page.locator('input[autocomplete="name"]').fill(userName);
		await page.locator('input[autocomplete="email"]').fill(userEmail);
		await page.locator('input[type="password"]').fill('password');
		await page.locator('button[type="submit"]').click();

		await page.waitForSelector(
			'#chat-input, #chat-search, button[aria-label="User menu"], button[aria-label="Open User Profile Menu"]',
			{ timeout: 15_000 }
		);
		await openUserMenu(page);
		await expect(page.getByText(userName)).toBeVisible();
	});

	test('can login with the admin user', async ({ page, request }) => {
		await ensureAdmin(request);
		await loginAdmin(page);
		await openUserMenu(page);
		await expect(page.getByText(adminUser.name)).toBeVisible();
	});
});
