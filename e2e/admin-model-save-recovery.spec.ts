import { randomUUID } from 'node:crypto';
import { expect, request as apiRequest, test } from '@playwright/test';

type ModelGrant = { principal_type: string; principal_id: string; permission: string };

for (const mode of ['create', 'update'] as const) {
	test(`admin ${mode}: HTTP and transport refusals retain fields; retry persists`, async ({
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
		const id = 'gpt-6-luna';
		const before = await request.get('/api/v1/models/model', { headers, params: { id } });
		expect(before.ok()).toBe(true);
		const original = (await before.json()) as { access_grants: ModelGrant[] };
		const originalGrants = original.access_grants.map(
			({ principal_type, principal_id, permission }) => ({
				principal_type,
				principal_id,
				permission
			})
		);
		const settings = await request.get('/api/v1/users/user/settings', { headers });
		expect(settings.ok()).toBe(true);
		const savedSettings = (await settings.json()) as { ui?: Record<string, unknown> } | null;
		// An independent API context survives a timed-out test closing its browser/request fixtures.
		const cleanupClient = await apiRequest.newContext({
			baseURL,
			extraHTTPHeaders: headers,
			timeout: 10000
		});
		let testFailed = false;
		const cleanupErrors: string[] = [];
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		try {
			const prepared = await request.post('/api/v1/users/user/settings/update', {
				headers,
				data: { ...savedSettings, ui: { ...savedSettings?.ui, showChangelog: false } }
			});
			expect(prepared.ok()).toBe(true);
			if (mode === 'create') {
				const deleted = await request.post('/api/v1/models/model/delete', {
					headers,
					data: { id }
				});
				expect(deleted.ok()).toBe(true);
			}
			await page.addInitScript(
				({ token }) => {
					localStorage.setItem('token', token);
					localStorage.setItem('locale', 'en-US');
					localStorage.setItem('airis.analytics.consent.v1', 'denied');
				},
				{ token: admin.token }
			);
			await page.goto('/?settings=admin%3Amodels');
			await page
				.locator(`#model-item-${id.replaceAll('.', '\\.')}`)
				.getByRole('button')
				.first()
				.click();
			const save = page.getByRole('button', { name: 'Save & Update', exact: true });
			await expect(save).toBeVisible();
			if (mode === 'update') await expect(save).toBeDisabled();
			const name = page.getByPlaceholder('Model Name', { exact: true });
			const description = page.getByPlaceholder(
				'Add a short description about what this model does'
			);
			const system = page.getByPlaceholder(/Write your model system prompt content here/);
			const newName = `Admin retry ${randomUUID()}`;
			await name.fill(newName);
			const defaultDescription = page.getByRole('button', {
				name: 'Description Default',
				exact: true
			});
			if ((await defaultDescription.count()) > 0) await defaultDescription.click();
			await description.fill('Keep this description');
			await system.fill('Keep this instruction');
			await expect(save).toBeEnabled();
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
		} catch (error) {
			testFailed = true;
			throw error;
		} finally {
			const cleanup = async (label: string, action: () => Promise<void>): Promise<void> => {
				try {
					await action();
				} catch (error) {
					cleanupErrors.push(`${label}: ${String(error)}`);
				}
			};
			// No page calls here: browser teardown must not prevent restoring shared fixture state.
			await cleanup('model configuration', async () => {
				const current = await cleanupClient.get('/api/v1/models/model', { params: { id } });
				expect([200, 404]).toContain(current.status());
				const restored = await cleanupClient.post(
					current.ok() ? '/api/v1/models/model/update' : '/api/v1/models/create',
					{ data: original }
				);
				expect(restored.ok()).toBe(true);
			});
			// Configuration updates preserve the current grants; restore access separately after create.
			await cleanup('model access', async () => {
				const access = await cleanupClient.post('/api/v1/models/model/access/update', {
					data: { id, access_grants: originalGrants }
				});
				expect(access.ok()).toBe(true);
				const restoredGrants = (
					(await access.json()) as { access_grants: ModelGrant[] }
				).access_grants.map(({ principal_type, principal_id, permission }) => ({
					principal_type,
					principal_id,
					permission
				}));
				expect(restoredGrants).toEqual(expect.arrayContaining(originalGrants));
				expect(restoredGrants).toHaveLength(originalGrants.length);
			});
			await cleanup('user settings', async () => {
				const restored = await cleanupClient.post('/api/v1/users/user/settings/update', {
					data: savedSettings ?? {}
				});
				expect(restored.ok()).toBe(true);
			});
			await cleanup('API context', () => cleanupClient.dispose());
			if (cleanupErrors.length && testFailed) {
				await testInfo.attach('fixture-restoration-errors', {
					body: cleanupErrors.join('\n'),
					contentType: 'text/plain'
				});
			}
		}
		expect(cleanupErrors).toEqual([]);
	});
}
