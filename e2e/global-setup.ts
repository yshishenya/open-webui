import { chromium, request } from '@playwright/test';
import { adminUser, ensureAdmin } from './helpers/auth';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const storageStatePath = path.join('e2e', '.auth', 'admin.json');

const globalSetup = async (): Promise<void> => {
	const requestContext = await request.newContext({ baseURL });
	await ensureAdmin(requestContext);
	await requestContext.dispose();

	await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

	const browser = await chromium.launch();
	const page = await browser.newPage();

	await page.addInitScript(() => {
		window.localStorage.setItem('locale', 'en-US');
	});

	await page.goto(new URL('/auth?form=1', baseURL).toString());
	await page.locator('input[autocomplete="email"]').fill(adminUser.email);
	await page.locator('input[type="password"]').fill(adminUser.password);
	await page.locator('button[type="submit"]').click();

	await page.waitForSelector(
		'#chat-input, [data-testid="user-menu-trigger"], button[aria-label="User menu"], button[aria-label="Open User Profile Menu"]',
		{ timeout: 30_000 }
	);

	const changelogButton = page.getByRole('button', { name: "Okay, Let's Go!" });
	if ((await changelogButton.count()) > 0) {
		await changelogButton.click();
	}

	await page.context().storageState({ path: storageStatePath });
	await browser.close();
};

export default globalSetup;
