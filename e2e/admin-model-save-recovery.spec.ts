import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

for (const mode of ['create', 'update'] as const) {
	test(`admin ${mode}: HTTP and transport refusals retain fields; retry persists`, async ({
		page,
		request,
		baseURL
	}) => {
		if (!baseURL || new URL(baseURL).hostname !== 'onboarding-paths')
			throw new Error('Requires disposable onboarding-paths fixture');
		const login = await request.post('/api/v1/auths/signin', {
			data: { email: 'fullpaths-admin@airis.you', password: 'local-fixture-only' }
		});
		expect(login.ok()).toBe(true);
		const admin = (await login.json()) as { token: string; role: string };
		expect(admin.role).toBe('admin');
		const headers = { Authorization: `Bearer ${admin.token}` };
		const id = 'gpt-5.6-luna';
		const before = await request.get('/api/v1/models/model', { headers, params: { id } });
		expect(before.ok()).toBe(true);
		const original = (await before.json()) as object;
		if (mode === 'create') {
			const deleted = await request.post('/api/v1/models/model/delete', { headers, data: { id } });
			expect(deleted.ok()).toBe(true);
		}
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.addInitScript(
			({ token }) => {
				localStorage.setItem('token', token);
				localStorage.setItem('locale', 'en-US');
				localStorage.setItem('airis.analytics.consent.v1', 'denied');
			},
			{ token: admin.token }
		);
		try {
			await page.goto('/?settings=admin%3Amodels');
			const changelog = page.getByRole('button', { name: "Okay, Let's Go!" });
			if ((await changelog.count()) > 0) await changelog.click();
			await page
				.locator(`#model-item-${id.replaceAll('.', '\\.')}`)
				.getByRole('button')
				.first()
				.click();
			const save = page.getByRole('button', { name: 'Save & Update', exact: true });
			await expect(save).toBeEnabled();
			const name = page.getByPlaceholder('Model Name', { exact: true });
			const description = page.getByPlaceholder(
				'Add a short description about what this model does'
			);
			const system = page.getByPlaceholder(/Write your model system prompt content here/);
			const newName = `Admin retry ${randomUUID()}`;
			await name.fill(newName);
			await description.fill('Keep this description');
			await system.fill('Keep this instruction');
			let calls = 0;
			await page.route(
				mode === 'create' ? '**/api/v1/models/create' : '**/api/v1/models/model/update',
				async (route) => {
					calls++;
					if (calls === 1)
						await route.fulfill({
							status: 503,
							contentType: 'application/json',
							body: JSON.stringify({ detail: 'Fixture save unavailable' })
						});
					else if (calls === 2) await route.abort('failed');
					else await route.continue();
				}
			);
			for (let attempt = 1; attempt <= 2; attempt++) {
				await save.click();
				await expect.poll(() => calls).toBe(attempt);
				await expect(save).toBeEnabled();
				await expect(page.locator('[data-sonner-toast][data-type="error"]').last()).toBeVisible();
				await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
				await expect(name).toHaveValue(newName);
				await expect(description).toHaveValue('Keep this description');
				await expect(system).toHaveValue('Keep this instruction');
			}
			await save.click();
			await expect(save).toHaveCount(0);
			expect(calls).toBe(3);
			const stored = await request.get('/api/v1/models/model', { headers, params: { id } });
			expect(stored.ok()).toBe(true);
			expect(await stored.json()).toMatchObject({
				id,
				name: newName,
				meta: { description: 'Keep this description' },
				params: { system: 'Keep this instruction' }
			});
			const row = page.locator(`[id="model-item-${id}"]`);
			const active = row.getByRole('switch');
			await expect(active).toBeChecked();
			await page.route('**/api/v1/models/model/toggle?*', (route) =>
				route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({ detail: 'Fixture toggle unavailable' })
				})
			);
			const refusedToggle = page.waitForResponse(
				(response) =>
					response.url().includes('/api/v1/models/model/toggle?') && response.status() === 503
			);
			await active.click();
			await refusedToggle;
			await expect(active).toBeChecked();
			expect(errors).toEqual([]);
		} finally {
			await page.unrouteAll({ behavior: 'wait' });
			const current = await request.get('/api/v1/models/model', { headers, params: { id } });
			const restored = await request.post(
				current.ok() ? '/api/v1/models/model/update' : '/api/v1/models/create',
				{ headers, data: original }
			);
			expect(restored.ok()).toBe(true);
		}
	});
}
