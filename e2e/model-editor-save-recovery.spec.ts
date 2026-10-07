import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

for (const mode of ['create', 'edit'] as const) {
	test(`model ${mode}: failed save keeps form usable and retry persists`, async ({
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
		const suffix = randomUUID();
		const initialId = `retry-${suffix}`;
		const finalId = mode === 'edit' ? initialId : `created-${suffix}`;
		const model = {
			id: initialId,
			name: `Retry ${suffix}`,
			base_model_id: 'gpt-5.6-luna',
			meta: { description: '', tags: [] },
			params: { system: 'Preserve instruction' },
			access_grants: []
		};
		const seeded = await request.post('/api/v1/models/create', { headers, data: model });
		expect(seeded.ok()).toBe(true);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.addInitScript(
			({ token, model, mode }) => {
				localStorage.setItem('token', token);
				localStorage.setItem('locale', 'en-US');
				localStorage.setItem('airis.analytics.consent.v1', 'denied');
				if (mode === 'create') sessionStorage.setItem('model', JSON.stringify(model));
			},
			{ token: admin.token, model, mode }
		);
		try {
			await page.goto(
				mode === 'create' ? '/workspace/models/create' : `/workspace/models/edit?id=${initialId}`
			);
			const save = page.getByRole('button', {
				name: mode === 'create' ? 'Save & Create' : 'Save & Update',
				exact: true
			});
			await expect(save).toBeEnabled();
			const changelog = page.getByRole('button', { name: "Okay, Let's Go!" });
			if ((await changelog.count()) > 0) await changelog.click();
			if (mode === 'create') {
				await save.click(); // Actual duplicate callback returns without navigating.
				await expect(page.getByText(/already exists\. Please select/)).toBeVisible();
				await expect(save).toBeEnabled();
				await page.getByPlaceholder('Model ID', { exact: true }).fill(finalId);
			}
			const mutation =
				mode === 'create' ? '**/api/v1/models/create' : '**/api/v1/models/model/update';
			let calls = 0;
			await page.route(mutation, async (route) => {
				calls++;
				if (calls === 1)
					await route.fulfill({
						status: 503,
						contentType: 'application/json',
						body: JSON.stringify({ detail: 'Fixture save unavailable' })
					});
				else await route.continue();
			});
			await save.click();
			await expect.poll(() => calls).toBe(1);
			await expect(save).toBeEnabled();
			await expect(page.locator('[data-sonner-toast]').last()).toBeVisible();
			await save.click();
			await expect(page).toHaveURL(/\/workspace\/models$/);
			expect(calls).toBe(2);
			const stored = await request.get('/api/v1/models/model', {
				headers,
				params: { id: finalId }
			});
			expect(stored.ok()).toBe(true);
			expect(await stored.json()).toMatchObject({
				id: finalId,
				meta: { description: null },
				params: { system: 'Preserve instruction' }
			});
			expect(errors).toEqual([]);
		} finally {
			for (const id of new Set([initialId, finalId])) {
				const deleted = await request.post('/api/v1/models/model/delete', {
					headers,
					data: { id }
				});
				expect(deleted.ok()).toBe(true);
			}
		}
	});
}
