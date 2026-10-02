import { expect, test } from '@playwright/test';
import { ensureAdmin, getUserMenuTrigger, loginAdmin } from './helpers/auth';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('locale', 'en-US');
		HTMLCanvasElement.prototype.getContext = (): null => null;
	});
});

test('registration reaches the signup API with the default avatar without Canvas', async ({
	page,
	request
}) => {
	await ensureAdmin(request);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/auth?form=1');
	await page
		.getByRole('button', { name: /sign up|create account/i })
		.first()
		.click();
	await page.locator('input[autocomplete="name"]').fill('Canvas Signup');
	await page.locator('input[autocomplete="email"]').fill(`canvas-${Date.now()}@example.com`);
	await page.locator('input[type="password"]').fill('password');
	await page.locator('#legal-accept').check();
	const response = page.waitForResponse(
		(res) => res.url().endsWith('/api/v1/auths/signup') && res.request().method() === 'POST'
	);
	await page.locator('button[type="submit"]').click();
	const signup = await response;
	expect(signup.status()).toBe(200);
	expect(signup.request().postDataJSON().profile_image_url).toBe('/user.png');
	expect((await signup.json()).profile_image_url).toMatch(/\/profile\/image$/);
	await expect((await getUserMenuTrigger(page)).first()).toBeVisible();
	expect(errors).toEqual([]);
});

test('account name update reaches the profile API without Canvas', async ({ page, request }) => {
	await ensureAdmin(request);
	await loginAdmin(page);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await (await getUserMenuTrigger(page)).first().click();
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	await page.getByRole('tab', { name: 'Account', exact: true }).click();
	const name = page.getByPlaceholder('Enter your name');
	await expect(name).toHaveValue('Admin User');
	await name.fill('Canvas Profile');
	const response = page.waitForResponse(
		(res) => res.url().endsWith('/api/v1/auths/update/profile') && res.request().method() === 'POST'
	);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const profile = await response;
	expect(profile.status()).toBe(200);
	expect((await profile.json()).name).toBe('Canvas Profile');
	expect(errors).toEqual([]);
	const restored = await request.post('/api/v1/auths/signin', {
		data: { email: 'admin@example.com', password: 'password' }
	});
	const session = await restored.json();
	const reset = await request.post('/api/v1/auths/update/profile', {
		headers: { Authorization: `Bearer ${session.token}` },
		data: { name: 'Admin User', profile_image_url: '/user.png' }
	});
	expect(reset.ok()).toBe(true);
});
