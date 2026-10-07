import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { adminUser, ensureAdmin, getUserMenuTrigger, loginAdmin } from './helpers/auth';

const openUserMenu = async (page: Page, name: string): Promise<void> => {
	const userMenuButton = await getUserMenuTrigger(page);
	await expect(userMenuButton.first()).toBeVisible();
	await userMenuButton.first().click();
	await expect(page.getByRole('menu').getByRole('button', { name, exact: true })).toBeVisible();
};

test.describe('Registration and Login', () => {
	test('registers a new user and displays the name in the account menu', async ({ page }) => {
		await page.addInitScript(() => {
			window.localStorage.setItem('locale', 'en-US');
		});
		await page.goto('/auth?form=1');

		const userName = `Test User - ${Date.now()}`;
		const userEmail = `e2e-${Date.now()}@example.com`;
		const userNameInput = page.locator('input[autocomplete="name"]');
		const signupButton = page.getByRole('button', {
			name: /sign up|зарегистрироваться|create account/i
		});

		await expect(page.locator('input[autocomplete="email"]')).toBeVisible();
		if (!(await userNameInput.isVisible())) {
			await expect(signupButton.first()).toBeVisible();
			await signupButton.first().click();
			await expect(userNameInput).toBeVisible({ timeout: 15_000 });
		}

		await userNameInput.fill(userName);
		await page.locator('input[autocomplete="email"]').fill(userEmail);
		await page.locator('input[type="password"]').fill('password');
		const legalCheckbox = page.locator('input#legal-accept');
		if ((await legalCheckbox.count()) > 0 && !(await legalCheckbox.isChecked())) {
			await legalCheckbox.check();
		}
		await page.locator('button[type="submit"]').click();

		await page.waitForSelector(
			'#chat-input, [data-testid="user-menu-trigger"], button[aria-label="User menu"], button[aria-label="Open User Profile Menu"]',
			{
				timeout: 15_000
			}
		);
		await openUserMenu(page, userName);
	});

	test('can login with the admin user', async ({ page, request }) => {
		await ensureAdmin(request);
		await loginAdmin(page);
		await openUserMenu(page, adminUser.name);
	});
});
