import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { test, openSidebar } from './onboarding-paths.fixture';

test('aborted folder list keeps chat usable and a subsequent load recovers', async ({
	page,
	request,
	account
}) => {
	const headers = { Authorization: `Bearer ${account.token}` };
	const name = `Folder recovery ${randomUUID()}`;
	const created = await request.post('/api/v1/folders/', { headers, data: { name } });
	expect(created.ok()).toBe(true);
	const folder = (await created.json()) as { id: string };
	let aborted = 0;
	await page.addInitScript((token: string) => localStorage.setItem('token', token), account.token);
	await page.route('**/api/v1/folders/', async (route) => {
		aborted += 1;
		await route.abort('aborted');
	});
	try {
		await page.goto('/');
		const input = page.getByLabel(/^(Send a Message|How can I help you today\?)$/);
		await expect(input).toBeVisible();
		await openSidebar(page);
		await expect.poll(() => aborted).toBeGreaterThan(0);
		await page.getByRole('button', { name: 'Close Sidebar', exact: true }).click();
		await input.fill('Draft remains usable after cancelled folder request');
		await expect(input).toContainText('Draft remains usable after cancelled folder request');
		for (const prefix of ['#', '@']) {
			await input.fill('');
			await Promise.all([
				page.waitForResponse(
					(response) => new URL(response.url()).pathname === '/api/v1/knowledge/search'
				),
				input.pressSequentially(prefix)
			]);
			await expect(input).toContainText(prefix);
		}

		await page.unroute('**/api/v1/folders/');
		await page.goto(`/folders/${folder.id}`);
		await expect(page).toHaveURL(new RegExp(`/folders/${folder.id}$`));
		await expect(page.getByText(name, { exact: true }).last()).toBeVisible();
		const current = await request.get(`/api/v1/folders/${folder.id}`, { headers });
		expect(current.ok()).toBe(true);
		expect(await current.json()).toMatchObject({ id: folder.id, name });
	} finally {
		const deleted = await request.delete(`/api/v1/folders/${folder.id}?delete_contents=false`, {
			headers
		});
		expect(deleted.ok()).toBe(true);
	}
});
