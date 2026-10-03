import { expect, test } from '@playwright/test';
import { registerUser } from './helpers/auth';

const exampleNames = ['написать текст', 'разобраться в теме', 'составить план'];
const freeConfig = {
	enabled: true,
	cycle_days: 30,
	quotas: {
		tokens_input: 1000000,
		tokens_output: 1000000,
		images: 0,
		tts_seconds: 0,
		stt_seconds: 0
	},
	config_version: 2
};

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('airis.analytics.consent.v1', 'denied');
		localStorage.setItem('locale', 'en-US');
	});
	await page.route('**/api/v1/billing/public/lead-magnet', (route) =>
		route.fulfill({ json: freeConfig })
	);
	await page.route('**/api/v1/billing/public/pricing-config', (route) =>
		route.fulfill({ json: { topup_amounts_rub: [500, 1000, 2000] } })
	);
});

test.describe('public guide', () => {
	test('public guide is readable without backend bootstrap or analytics', async ({
		page
	}, testInfo) => {
		const bootstrapRequests: string[] = [];
		page.on('request', (request) => {
			if (/\/api\/config|metrika\/tag|googletagmanager/.test(request.url()))
				bootstrapRequests.push(request.url());
		});
		await page.route('**/api/config', (route) => route.abort());
		await page.goto('/guide');
		const video = page.locator('video');
		await expect(video).toHaveAttribute('preload', 'none');
		await expect(video).not.toHaveAttribute('autoplay');
		await expect(video).toHaveAttribute('controls', '');
		await expect(video.locator('track')).toHaveAttribute('srclang', 'ru');
		await expect(video.locator('track')).toHaveAttribute('default', '');
		const media = await page.request.get('/airis/guide/first-task-20261002.mp4', {
			headers: { Range: 'bytes=0-31' }
		});
		expect([200, 206]).toContain(media.status());
		expect(media.headers()['content-type']).toContain('video/mp4');
		const captions = await page.request.get('/airis/guide/first-task-20261002.vtt');
		expect(captions.ok()).toBe(true);
		expect(await captions.text()).toContain('WEBVTT');
		await expect(page.getByRole('link', { name: 'Все действия текстом →' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Начните с одной задачи');
		await expect(
			page.getByText('Лимиты обновляются каждые 30 дней.', { exact: false })
		).toBeVisible();
		for (const width of [320, 390, 768, 1440]) {
			await page.setViewportSize({ width, height: 900 });
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
			).toBe(true);
			for (const name of exampleNames) {
				const link = page.getByRole('link', { name: `Открыть задачу: ${name}` });
				await link.scrollIntoViewIfNeeded();
				await expect(link).toBeVisible();
				const box = await link.boundingBox();
				expect(box?.height).toBeGreaterThanOrEqual(44);
				expect(box?.x).toBeGreaterThanOrEqual(0);
				expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
			}
		}
		await page.goto('/guide');
		const choose = page.getByRole('link', { name: 'Выбрать задачу' });
		for (
			let index = 0;
			index < 30 && !(await choose.evaluate((node) => node === document.activeElement));
			index++
		) {
			await page.keyboard.press('Tab');
		}
		await expect(choose).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/#examples$/);
		expect(bootstrapRequests).toEqual([]);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
		await page.screenshot({ path: testInfo.outputPath('guide-mobile.png') });
	});

	test('instructions and task links survive failed public configuration', async ({ page }) => {
		await page.route('**/api/v1/billing/public/**', (route) =>
			route.fulfill({ status: 503, json: { detail: 'Unavailable' } })
		);
		await page.goto('/guide');
		await expect(
			page.getByText('Не удалось загрузить условия бесплатного доступа.', { exact: false })
		).toBeVisible();
		await expect(page.getByRole('link', { name: /Открыть задачу:/ })).toHaveCount(3);
		await page.getByRole('link', { name: 'Открыть задачу: написать текст' }).click();
		await expect(page).toHaveURL(/\/auth\?/);
		const redirect = new URL(
			new URL(page.url()).searchParams.get('redirect') ?? '',
			'http://localhost'
		);
		expect(redirect.searchParams.get('submit')).toBe('false');
		expect(redirect.searchParams.get('model')).toBe('gpt-5.6-luna');
		expect(redirect.searchParams.get('q')).toContain('деловое письмо');
	});
});

for (const name of exampleNames) {
	test(`draft survives login: ${name}`, async ({ page, request }) => {
		const credentials = {
			name: 'Guide User',
			email: `guide-${Date.now()}@example.com`,
			password: 'guide-test-password'
		};
		expect(await registerUser(request, credentials)).toBe(true);
		await page.route('**/api/models**', (route) =>
			route.fulfill({
				json: { data: [{ id: 'gpt-5.6-luna', name: 'gpt-5.6-luna', owned_by: 'openai' }] }
			})
		);
		let completionRequests = 0;
		await page.route('**/api/chat/completions', (route) => {
			completionRequests++;
			return route.abort();
		});
		await page.goto('/guide');
		await page.getByRole('link', { name: `Открыть задачу: ${name}` }).click();
		await expect(page).toHaveURL(/\/auth\?/);
		const redirect = new URL(
			new URL(page.url()).searchParams.get('redirect') ?? '',
			'http://localhost'
		);
		const prompt = redirect.searchParams.get('q') ?? '';
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toBeVisible();
		await page.getByRole('textbox', { name: /email/i }).fill(credentials.email);
		await page.getByPlaceholder('Enter Your Password').fill(credentials.password);
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toContainText(
			prompt
		);
		await expect(page.getByRole('button', { name: /Selected model: gpt-5.6-luna/ })).toBeVisible();
		await expect(page.getByTestId('user-message')).toHaveCount(0);
		expect(completionRequests).toBe(0);
	});
}

test('unavailable explicit model never selects a paid default', async ({ page, request }) => {
	const credentials = {
		name: 'Guide Missing Model',
		email: `guide-missing-${Date.now()}@example.com`,
		password: 'guide-test-password'
	};
	expect(await registerUser(request, credentials)).toBe(true);
	const signin = await request.post('/api/v1/auths/signin', { data: credentials });
	expect(signin.ok()).toBe(true);
	const session = (await signin.json()) as { token: string };
	await page.addInitScript((token: string) => localStorage.setItem('token', token), session.token);
	await page.route('**/api/models**', (route) =>
		route.fulfill({
			json: { data: [{ id: 'paid-default', name: 'Paid default', owned_by: 'openai' }] }
		})
	);
	await page.goto('/?model=gpt-5.6-luna&q=Unsent%20draft&submit=false');
	await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toContainText(
		'Unsent draft'
	);
	await expect(
		page.getByText(/The requested model is unavailable|Указанная модель недоступна/)
	).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Select a model', exact: true })).toBeVisible();
	await expect(page.getByTestId('user-message')).toHaveCount(0);
});

test('draft survives new account registration', async ({ page }) => {
	await page.route('**/api/models**', (route) =>
		route.fulfill({
			json: { data: [{ id: 'gpt-5.6-luna', name: 'gpt-5.6-luna', owned_by: 'openai' }] }
		})
	);
	await page.goto('/guide');
	await page.getByRole('link', { name: 'Открыть задачу: написать текст' }).click();
	await expect(page).toHaveURL(/\/auth\?/);
	const redirect = new URL(
		new URL(page.url()).searchParams.get('redirect') ?? '',
		'http://localhost'
	);
	await page.getByRole('textbox', { name: 'Name', exact: true }).fill('New Guide User');
	await page
		.getByRole('textbox', { name: 'Email', exact: true })
		.fill(`guide-signup-${Date.now()}@example.com`);
	await page.getByPlaceholder('Enter Your Password').fill('guide-test-password');
	await page.locator('#legal-accept').check();
	await expect(page.getByRole('checkbox', { name: /Хочу получать советы/ })).not.toBeChecked();
	await page.getByRole('button', { name: 'Create Account', exact: true }).click();
	await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toContainText(
		redirect.searchParams.get('q') ?? ''
	);
	await expect(page.getByRole('button', { name: /Selected model: gpt-5.6-luna/ })).toBeVisible();
	await expect(page.getByTestId('user-message')).toHaveCount(0);
});

test('measured comparison shows both answers and distinguishes free quota from price illustration', async ({
	page
}) => {
	await page.goto('/guide');
	const comparison = page.locator('#model-comparison');
	await expect(
		comparison.getByRole('heading', { name: 'Когда стоит сравнить модели' })
	).toBeVisible();
	await expect(
		comparison.getByText('Luna уже решила основную задачу.', { exact: false })
	).toBeVisible();
	const rows = comparison.locator('tbody tr');
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toContainText('gpt-5.6-luna');
	await expect(rows.nth(0)).toContainText('376');
	await expect(rows.nth(0)).toContainText('1 065');
	await expect(rows.nth(0)).toContainText('0,42 ₽');
	await expect(rows.nth(1)).toContainText('1 276');
	await expect(rows.nth(1)).toContainText('12,06 ₽');
	await expect(
		comparison.getByText('Расход проверен в тестовом кошельке.', { exact: false })
	).toBeVisible();
	await expect(
		comparison.getByText('в пределах бесплатной квоты деньги с кошелька не списываются.', {
			exact: false
		})
	).toBeVisible();
	await expect(
		comparison.getByText('Более высокая цена сама по себе не гарантирует', { exact: false })
	).toBeVisible();
	await comparison.locator('summary').click();
	await expect(comparison.getByRole('heading', { name: 'Запрос', exact: true })).toBeVisible();
	await expect(comparison.locator('pre')).toHaveCount(2);
	await expect(comparison.locator('pre').nth(0)).toContainText('510 минут');
	await expect(comparison.locator('pre').nth(1)).toContainText(
		'Это изменение требует вашего согласия.'
	);
	for (const width of [320, 390, 768, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	}
	await expect(page.getByText(/Условия пополнения загружены \d+ .+ \d{4} г\./)).toBeVisible();
});

for (const invalid of ['unavailable', 'empty', 'invalid'] as const) {
	test(`pricing ${invalid} never displays a fresh date or misleading amounts`, async ({ page }) => {
		await page.route('**/api/v1/billing/public/pricing-config', (route) =>
			invalid === 'unavailable'
				? route.abort()
				: route.fulfill({
						json: { topup_amounts_rub: invalid === 'empty' ? [] : [-1, null, '500'] }
					})
		);
		await page.goto('/guide');
		await expect(
			page.getByText('Доступные суммы пополнения можно проверить в кошельке.')
		).toBeVisible();
		await expect(page.getByText('Условия пополнения загружены', { exact: false })).toHaveCount(0);
		await expect(page.getByText('Действующие суммы пополнения:', { exact: false })).toHaveCount(0);
		await expect(
			page.getByText('Лимиты обновляются каждые 30 дней.', { exact: false })
		).toBeVisible();
		await expect(page.getByRole('link', { name: 'Кошелёк →', exact: true })).toHaveAttribute(
			'href',
			'/billing/balance'
		);
		await expect(page.locator('#model-comparison')).toContainText('3 октября 2026 года');
	});
}

test('pricing success remains readable when free conditions fail', async ({ page }) => {
	await page.route('**/api/v1/billing/public/lead-magnet', (route) => route.abort());
	await page.goto('/guide');
	await expect(
		page.getByText('Не удалось загрузить условия бесплатного доступа.', { exact: false })
	).toBeVisible();
	await expect(page.getByText('Условия пополнения загружены', { exact: false })).toBeVisible();
	for (const name of exampleNames) {
		const link = page.getByRole('link', { name: `Открыть задачу: ${name}` });
		const query = new URL((await link.getAttribute('href')) ?? '', 'http://localhost').searchParams;
		expect(query.get('model')).toBe('gpt-5.6-luna');
		expect(query.get('submit')).toBe('false');
	}
});
