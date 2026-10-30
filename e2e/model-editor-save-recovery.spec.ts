import { randomUUID } from 'node:crypto';
import { expect, request as apiRequest, test } from '@playwright/test';

for (const mode of ['create', 'edit'] as const) {
	test(`model ${mode}: failed save keeps form usable and retry persists`, async ({
		page,
		request,
		baseURL
	}, testInfo) => {
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
			base_model_id: 'gpt-6-luna',
			meta: { description: '', tags: [] },
			params: { system: 'Preserve instruction' },
			access_grants: []
		};
		const seeded = await request.post('/api/v1/models/create', { headers, data: model });
		expect(seeded.ok()).toBe(true);
		const cleanupClient = await apiRequest.newContext({
			baseURL,
			extraHTTPHeaders: headers,
			timeout: 10000
		});
		const cleanupErrors: string[] = [];
		let testFailed = false;
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		try {
			await page.addInitScript(
				({ token, model, mode }) => {
					localStorage.setItem('token', token);
					localStorage.setItem('locale', 'en-US');
					localStorage.setItem('airis.analytics.consent.v1', 'denied');
					if (mode === 'create') sessionStorage.setItem('model', JSON.stringify(model));
				},
				{ token: admin.token, model, mode }
			);
			await page.goto(
				mode === 'create' ? '/workspace/models/create' : `/workspace/models/edit?id=${initialId}`
			);
			const save = page.getByRole('button', {
				name: mode === 'create' ? 'Save & Create' : 'Save & Update',
				exact: true
			});
			await expect(save).toBeVisible();
			if (mode === 'edit') await expect(save).toBeDisabled();
			const changelog = page.getByRole('button', { name: "Okay, Let's Go!" });
			if ((await changelog.count()) > 0) await changelog.click();
			if (mode === 'create') {
				await save.click(); // Actual duplicate callback returns without navigating.
				await expect(page.getByText(/already exists\. Please select/)).toBeVisible();
				await expect(save).toBeEnabled();
			}
			const changedName = `Retried ${suffix}`;
			await page.getByPlaceholder('Model Name', { exact: true }).fill(changedName);
			// New model names generate an ID; apply the explicit ID after changing the name.
			if (mode === 'create') await page.getByPlaceholder('Model ID', { exact: true }).fill(finalId);
			await expect(save).toBeEnabled();
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
			await expect(page.getByPlaceholder('Model Name', { exact: true })).toHaveValue(changedName);
			await expect(page.getByPlaceholder('Model ID', { exact: true })).toHaveValue(finalId);
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
				name: changedName,
				meta: { description: null },
				params: { system: 'Preserve instruction' }
			});
			expect(errors).toEqual([]);
		} catch (error) {
			testFailed = true;
			throw error;
		} finally {
			for (const id of new Set([initialId, finalId])) {
				try {
					const current = await cleanupClient.get('/api/v1/models/model', { params: { id } });
					expect([200, 404]).toContain(current.status());
					if (current.status() === 404) continue;
					const deleted = await cleanupClient.post('/api/v1/models/model/delete', { data: { id } });
					expect(deleted.ok()).toBe(true);
				} catch (error) {
					cleanupErrors.push(`${id}: ${String(error)}`);
				}
			}
			try {
				await cleanupClient.dispose();
			} catch (error) {
				cleanupErrors.push(`API context: ${String(error)}`);
			}
			if (cleanupErrors.length && testFailed) {
				await testInfo.attach('fixture-cleanup-errors', {
					body: cleanupErrors.join('\n'),
					contentType: 'text/plain'
				});
			}
		}
		expect(cleanupErrors).toEqual([]);
	});
}
