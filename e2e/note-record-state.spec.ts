import { expect, test } from '@playwright/test';

test('notes preserve sparse content and recover malformed persisted fields', async ({
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
	const savedSettings = (await settings.json()) as { ui?: Record<string, unknown> } | null;
	const prepared = await request.post('/api/v1/users/user/settings/update', {
		headers,
		data: { ...savedSettings, ui: { ...savedSettings?.ui, showChangelog: false } }
	});
	expect(prepared.ok()).toBe(true);
	const created = await request.post('/api/v1/notes/create', {
		headers,
		data: {
			title: 'Contract fixture',
			data: {
				content: {
					md: 'Preserved note text',
					html: '<p>Preserved note text</p>',
					json: {
						type: 'doc',
						content: [
							{ type: 'paragraph', content: [{ type: 'text', text: 'Preserved note text' }] }
						]
					}
				},
				files: null,
				versions: [{ md: 'Earlier version', custom: { keep: true } }],
				custom: { keep: true }
			},
			access_grants: []
		}
	});
	expect(created.ok()).toBe(true);
	const note = (await created.json()) as { id: string };
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
	try {
		for (const broken of ['versions', 'json']) {
			let refused = 0;
			await page.route(`**/api/v1/notes/${note.id}`, async (route) => {
				if (route.request().method() === 'GET' && refused === 0) {
					refused++;
					const response = await route.fetch({
						headers: { ...route.request().headers(), 'accept-encoding': 'identity' }
					});
					const original = await response.json();
					if (broken === 'versions') original.data.versions = 'broken';
					else original.data.content.json = { type: 'doc', content: [null] };
					await route.fulfill({ response, json: original });
				} else await route.continue();
			});
			await page.goto(`/notes/${note.id}`);
			await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
			await expect(page.locator('#note-editor input[type="text"]')).toHaveCount(0);
			expect(refused).toBe(1);
			await page.unroute(`**/api/v1/notes/${note.id}`);
			await page.getByRole('button', { name: 'Retry', exact: true }).click();
			await expect(page.locator('#note-editor input[type="text"]')).toHaveValue('Contract fixture');
			await expect(page.locator('#note-editor [contenteditable="true"]')).toContainText(
				'Preserved note text'
			);
		}
		const title = page.locator('#note-editor input[type="text"]');
		await title.fill('Retained title');
		await title.blur();
		await expect
			.poll(async () => {
				const saved = await request.get(`/api/v1/notes/${note.id}`, { headers });
				return (await saved.json()).title;
			})
			.toBe('Retained title');
		const saved = await request.get(`/api/v1/notes/${note.id}`, { headers });
		const persisted = await saved.json();
		expect(persisted.data.content.md).toBe('Preserved note text');
		expect(persisted.data.custom).toEqual({ keep: true });
		expect(persisted.data.versions).toEqual([{ md: 'Earlier version', custom: { keep: true } }]);
		await page.reload();
		await expect(title).toHaveValue('Retained title');
		await expect(page.locator('#note-editor [contenteditable="true"]')).toContainText(
			'Preserved note text'
		);
		expect(errors).toEqual([]);
	} finally {
		await request.delete(`/api/v1/notes/${note.id}/delete`, { headers });
	}
});
