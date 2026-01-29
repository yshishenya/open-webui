import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { registerUser } from './helpers/auth';

const getUserMessages = async (page: Page) => {
	let userMessages = page.getByTestId('user-message');
	if ((await userMessages.count()) === 0) {
		userMessages = page.locator('.chat-user');
	}
	return userMessages;
};

const loginWithRedirect = async (
	page: Page,
	email: string,
	password: string,
	redirectPath: string
): Promise<void> => {
	const params = new URLSearchParams({ redirect: redirectPath, form: '1' });
	await page.goto(`/auth?${params.toString()}`);
	await expect(page.locator('input[autocomplete="email"]')).toBeVisible();
	await page.locator('input[autocomplete="email"]').fill(email);
	await page.locator('input[type="password"]').fill(password);
	await page.locator('button[type="submit"]').click();
	await page.waitForSelector('#chat-input', { timeout: 15_000 });

	const changelogButton = page.getByRole('button', { name: "Okay, Let's Go!" });
	if ((await changelogButton.count()) > 0) {
		await changelogButton.click();
	}
};

test.describe('Welcome Hero', () => {
	test('unauth preset redirects and prefills after login', async ({ page, request }) => {
		const timestamp = Date.now();
		const user = {
			name: `Preset User ${timestamp}`,
			email: `preset-${timestamp}@example.com`,
			password: 'password'
		};
		await registerUser(request, user);

		await page.addInitScript(() => {
			window.localStorage.setItem('locale', 'en-US');
		});

		await page.goto('/welcome');
		await page.getByRole('button', { name: 'Пост для соцсетей' }).click();

		await page.waitForURL(/\/auth/);
		const redirectParam = new URL(page.url()).searchParams.get('redirect');
		expect(redirectParam).not.toBeNull();

		await loginWithRedirect(page, user.email, user.password, redirectParam ?? '/');

		await expect(page.locator('#chat-input')).toContainText('Напиши пост для соцсетей');
		const userMessages = await getUserMessages(page);
		await expect(userMessages).toHaveCount(0);
	});

	test('auth preset fills input without auto-send', async ({ page, request }) => {
		const timestamp = Date.now();
		const user = {
			name: `Preset Auth ${timestamp}`,
			email: `preset-auth-${timestamp}@example.com`,
			password: 'password'
		};
		await registerUser(request, user);

		await page.addInitScript(() => {
			window.localStorage.setItem('locale', 'en-US');
		});

		await loginWithRedirect(page, user.email, user.password, '/');
		await page.goto('/welcome');

		await page.getByRole('button', { name: 'Резюме' }).click();
		await page.waitForURL(/\?src=welcome_hero_preset/);

		await expect(page.locator('#chat-input')).toContainText('Составь резюме по фактам');
		const userMessages = await getUserMessages(page);
		await expect(userMessages).toHaveCount(0);
	});

	test('hero primary CTA keeps redirect source', async ({ page }) => {
		await page.goto('/welcome');
		const heroHeading = page.getByRole('heading', {
			name: 'Тексты и изображения за минуты — в одном чате'
		});
		const heroContainer = heroHeading.locator('..');
		await heroContainer.getByRole('link', { name: 'Начать бесплатно' }).click();

		await page.waitForURL(/\/(auth|signup)/);
		const url = new URL(page.url());
		const redirectParam = url.searchParams.get('redirect');
		expect(redirectParam).not.toBeNull();
		expect(redirectParam ?? '').toContain('src=welcome_hero_primary');
	});

	test('header CTA keeps redirect source', async ({ page }) => {
		await page.goto('/welcome');
		const nav = page.locator('nav');
		await nav.getByRole('link', { name: 'Начать бесплатно' }).click();

		await page.waitForURL(/\/(auth|signup)/);
		const url = new URL(page.url());
		const redirectParam = url.searchParams.get('redirect');
		expect(redirectParam).not.toBeNull();
		expect(redirectParam ?? '').toContain('src=welcome_header_cta');
	});

	test('examples CTA scrolls to scenarios section', async ({ page }) => {
		await page.goto('/welcome');
		await page.getByRole('link', { name: 'Посмотреть примеры' }).click();
		await page.waitForFunction(() => {
			const target = document.getElementById('examples');
			if (!target) return false;
			const rect = target.getBoundingClientRect();
			return rect.top >= 0 && rect.top <= window.innerHeight * 1.2;
		});

		const inViewport = await page.evaluate(() => {
			const target = document.getElementById('examples');
			if (!target) return false;
			const rect = target.getBoundingClientRect();
			return rect.top >= 0 && rect.top <= window.innerHeight * 1.2;
		});
		expect(inViewport).toBe(true);
	});
});
