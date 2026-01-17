import { test } from '@playwright/test';
import { getUserMenuTrigger } from './helpers/auth';

test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('Settings', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		const userMenuButton = await getUserMenuTrigger(page);
		await userMenuButton.first().click();
		await page.getByRole('menuitem', { name: 'Settings' }).click();
		await page.getByRole('tab', { name: 'General' }).waitFor();
	});

	test('user can open the General modal and hit save', async ({ page }) => {
		await page.getByRole('tab', { name: 'General' }).click();
		await page.getByRole('button', { name: 'Save' }).click();
	});

	test('user can open the Interface modal and hit save', async ({ page }) => {
		await page.getByRole('tab', { name: 'Interface' }).click();
		await page.getByRole('button', { name: 'Save' }).click();
	});

	test('user can open the Audio modal and hit save', async ({ page }) => {
		await page.getByRole('tab', { name: 'Audio' }).click();
		await page.getByRole('button', { name: 'Save' }).click();
	});

	test('user can open the Data Controls modal', async ({ page }) => {
		await page.getByRole('tab', { name: 'Data Controls' }).click();
	});

	test('user can open the Account modal and hit save', async ({ page }) => {
		await page.getByRole('tab', { name: 'Account' }).click();
		await page.getByRole('button', { name: 'Save' }).click();
	});

	test('user can open the About modal', async ({ page }) => {
		await page.getByRole('tab', { name: 'About' }).click();
	});
});
