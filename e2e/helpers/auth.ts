import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const signupUrl = new URL('/api/v1/auths/signup', baseURL).toString();

export const adminUser = {
	name: 'Admin User',
	email: 'admin@example.com',
	password: 'password'
};

type UserCredentials = {
	name: string;
	email: string;
	password: string;
};

export const registerUser = async (
	request: APIRequestContext,
	user: UserCredentials
): Promise<void> => {
	const response = await request.post(signupUrl, {
		data: user
	});

	expect([200, 400]).toContain(response.status());
};

export const ensureAdmin = async (request: APIRequestContext): Promise<void> => {
	await registerUser(request, adminUser);
};

export const getUserMenuTrigger = async (page: Page): Promise<Locator> => {
	const testIdTrigger = page.getByTestId('user-menu-trigger');
	if ((await testIdTrigger.count()) > 0) {
		return testIdTrigger;
	}

	return page.getByRole('button', { name: /user menu|open user profile menu/i });
};

export const login = async (page: Page, email: string, password: string): Promise<void> => {
	await page.addInitScript(() => {
		window.localStorage.setItem('locale', 'en-US');
	});
	await page.goto('/auth?form=1');
	await expect(page.locator('input[autocomplete="email"]')).toBeVisible();
	await page.locator('input[autocomplete="email"]').fill(email);
	await page.locator('input[type="password"]').fill(password);
	await page.locator('button[type="submit"]').click();
	const userMenuButton = await getUserMenuTrigger(page);
	await expect(userMenuButton.first()).toBeVisible({ timeout: 15_000 });

	const changelogButton = page.getByRole('button', { name: "Okay, Let's Go!" });
	if ((await changelogButton.count()) > 0) {
		await changelogButton.click();
	}
};

export const loginAdmin = async (page: Page): Promise<void> => {
	await login(page, adminUser.email, adminUser.password);
};
