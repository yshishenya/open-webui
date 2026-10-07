import { expect, test } from '@playwright/test';

test('model defaults retain failed edits, recover Save and persist retry', async ({
	page,
	request,
	baseURL
}) => {
	if (!baseURL || new URL(baseURL).origin !== 'http://localhost:8082')
		throw new Error('Requires disposable onboarding-paths fixture');
	const login = await request.post('/api/v1/auths/signin', {
		data: { email: 'fullpaths-admin@airis.you', password: 'local-fixture-only' }
	});
	expect(login.ok()).toBe(true);
	const admin = (await login.json()) as { token: string; role: string };
	expect(admin.role).toBe('admin');
	const headers = { Authorization: `Bearer ${admin.token}` };
	const settings = await request.get('/api/v1/users/user/settings', { headers });
	expect(settings.ok()).toBe(true);
	const savedSettings = (await settings.json()) as { ui?: Record<string, unknown> } | null;
	const prepared = await request.post('/api/v1/users/user/settings/update', {
		headers,
		data: { ...savedSettings, ui: { ...savedSettings?.ui, showChangelog: false } }
	});
	expect(prepared.ok()).toBe(true);
	await page.addInitScript(
		({ token }) => {
			localStorage.setItem('token', token);
			localStorage.setItem('locale', 'en-US');
			localStorage.setItem('airis.analytics.consent.v1', 'denied');
		},
		{ token: admin.token }
	);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	for (const loadFailure of ['refused', 'null']) {
		let reads = 0;
		await page.route('**/api/v1/configs/models', async (route) => {
			if (route.request().method() === 'GET' && ++reads === 2) {
				await route.fulfill({
					status: loadFailure === 'refused' ? 503 : 200,
					json: loadFailure === 'refused' ? { detail: 'private fixture refusal' } : null
				});
			} else await route.continue();
		});
		await page.goto('/?settings=admin%3Ageneral');
		await page.locator('[role="tab"][aria-controls="tab-admin-models"]').click();
		await expect(page.locator('[id="model-item-gpt-5.6-luna"]')).toBeVisible();
		await page.getByRole('button', { name: 'Model Defaults', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: /^Model Capabilities/ })).toHaveCount(0);
		await expect(
			page.locator('[data-sonner-toast]').filter({ hasText: 'Something went wrong :/' })
		).toHaveCount(1);
		await page.unroute('**/api/v1/configs/models');
		await page.getByRole('button', { name: 'Retry', exact: true }).click();
		await expect(page.getByRole('button', { name: /^Model Capabilities/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
		await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15000 });
	}
	await page.getByRole('button', { name: /^Model Capabilities/ }).click();
	const vision = page.getByRole('checkbox', { name: 'Vision', exact: true });
	const save = page.getByRole('button', { name: 'Save', exact: true });
	for (const step of [
		{ path: '/api/v1/configs/models', method: 'POST' },
		{ path: '/api/v1/configs/suggestions', method: 'POST' },
		{ path: '/api/config', method: 'GET' },
		{ path: '/api/v1/models/base/tags', method: 'GET' }
	]) {
		const before = await request.get('/api/v1/configs/models', { headers });
		expect(before.ok()).toBe(true);
		const config = (await before.json()) as { MODEL_ORDER_LIST: string[] };
		const expectedVision = (await vision.getAttribute('aria-checked')) !== 'true';
		await vision.click();
		await expect(save).toBeEnabled();
		let refused = 0;
		await page.route(`**${step.path}`, async (route) => {
			if (route.request().method() === step.method && refused === 0) {
				refused++;
				await route.fulfill({ status: 503, json: { detail: 'private fixture refusal' } });
			} else await route.continue();
		});
		await save.click();
		await expect.poll(() => refused).toBe(1);
		await expect(save).toBeEnabled();
		await expect(vision).toHaveAttribute('aria-checked', String(expectedVision));
		await expect(
			page.locator('[data-sonner-toast]').filter({ hasText: 'Something went wrong :/' })
		).toHaveCount(1);
		await expect(
			page
				.locator('[data-sonner-toast]')
				.filter({ hasText: 'Models configuration saved successfully' })
		).toHaveCount(0);
		await page.unroute(`**${step.path}`);
		await save.click();
		await expect(
			page
				.locator('[data-sonner-toast]')
				.filter({ hasText: 'Models configuration saved successfully' })
		).toHaveCount(1);
		await expect(save).toBeDisabled();
		const persisted = await request.get('/api/v1/configs/models', { headers });
		expect(persisted.ok()).toBe(true);
		const result = (await persisted.json()) as {
			MODEL_ORDER_LIST: string[];
			DEFAULT_MODEL_METADATA: { capabilities: { vision: boolean } };
		};
		expect(result.DEFAULT_MODEL_METADATA.capabilities.vision).toBe(expectedVision);
		expect(result.MODEL_ORDER_LIST).toEqual(config.MODEL_ORDER_LIST);
		await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15000 });
	}
	expect(errors).toEqual([]);
});
