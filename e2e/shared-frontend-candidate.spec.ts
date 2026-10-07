import { expect, test, type Page } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/admin.json' });

const prepare = async (page: Page): Promise<string[]> => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en-US');
		localStorage.setItem('airis.analytics.consent.v1', 'denied');
	});
	await page.route('**/api/models**', (route) =>
		route.fulfill({
			json: {
				data: [{ id: 'gpt-5.6-luna', name: 'gpt-5.6-luna', owned_by: 'openai' }]
			}
		})
	);
	await page.route('**/api/chat/completions', (route) =>
		route.fulfill({ status: 503, json: { detail: 'Isolated test: provider disabled' } })
	);
	await page.route('**/api/v1/tasks/**', (route) =>
		route.fulfill({ status: 503, json: { detail: 'Isolated test: provider disabled' } })
	);
	return errors;
};

const authHeaders = async (page: Page): Promise<{ Authorization: string }> => ({
	Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}`
});

test('knowledge editor keeps nullable files, lazy content, rename and read-only controls', async ({
	page
}) => {
	const errors = await prepare(page);
	const id = 'isolated-knowledge-contract';
	let writeAccess = true;
	let name = 'Document';
	let contentReads = 0;
	const renames: string[] = [];
	const file = () => ({
		id: 'stored',
		user_id: 'owner',
		filename: 'document.txt',
		hash: null,
		meta: { name },
		data: null,
		created_at: 0,
		updated_at: null
	});
	// Known server response shapes; these routes validate compiled UI, not live API storage.
	await page.route(`**/api/v1/knowledge/${id}**`, async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/files/pending')) return route.fulfill({ json: [] });
		if (path.endsWith('/files'))
			return route.fulfill({
				json: {
					items: [file(), { ...file(), id: 'legacy', meta: null }],
					total: 2,
					directories: [
						{
							id: 'folder',
							knowledge_id: id,
							name: 'Folder',
							parent_id: null,
							user_id: 'owner',
							created_at: 0,
							updated_at: 0
						}
					],
					breadcrumbs: []
				}
			});
		return route.fulfill({
			json: {
				id,
				user_id: 'owner',
				name: 'Contract knowledge',
				description: 'Compiled acceptance',
				meta: null,
				access_grants: [],
				files: null,
				created_at: 0,
				updated_at: 0,
				write_access: writeAccess
			}
		});
	});
	await page.route('**/api/v1/files/stored**', async (route) => {
		if (new URL(route.request().url()).pathname.endsWith('/rename')) {
			const body = route.request().postDataJSON() as { filename: string };
			renames.push(body.filename);
			name = body.filename;
			return route.fulfill({ json: file() });
		}
		contentReads++;
		return route.fulfill({ json: { ...file(), data: { content: 'Lazy extracted content' } } });
	});
	await page.goto(`/workspace/knowledge/${id}`);
	await expect(page.getByLabel('Knowledge Name', { exact: true })).toHaveValue(
		'Contract knowledge'
	);
	const list = page
		.getByRole('list')
		.filter({ has: page.getByRole('listitem').filter({ hasText: 'Folder' }) });
	const rows = list.getByRole('listitem');
	await expect(rows).toHaveCount(3);
	await expect(rows.nth(0)).toContainText('Folder');
	await expect(rows.nth(1)).toContainText('Document');
	expect(contentReads).toBe(0);
	await rows.nth(1).getByRole('button', { name: 'Document', exact: true }).click();
	await expect(page.getByLabel('File content', { exact: true })).toHaveValue(
		'Lazy extracted content'
	);
	expect(contentReads).toBe(1);
	await page.getByRole('button', { name: 'Close', exact: true }).click();
	await rows.nth(1).getByRole('button').last().click();
	await page.getByRole('button', { name: 'Rename', exact: true }).click();
	const rename = rows.nth(1).locator('input');
	await rename.fill('Renamed document');
	await rename.press('Enter');
	await expect.poll(() => renames).toEqual(['Renamed document']);
	await expect(rows.nth(1)).toContainText('Renamed document');
	writeAccess = false;
	await page.reload();
	await expect(page.getByLabel('Knowledge Name', { exact: true })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Add Content', exact: true })).toHaveCount(0);
	await rows.nth(1).getByRole('button', { name: 'Renamed document', exact: true }).click();
	await expect(page.getByLabel('File content', { exact: true })).toBeDisabled();
	expect(errors).toEqual([]);
});

test('stored assistant message renders inline and block math in the built chat', async ({
	page
}) => {
	const errors = await prepare(page);
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Selected model' })).toBeVisible();
	const headers = await authHeaders(page);
	const now = Math.floor(Date.now() / 1000);
	const message = {
		id: 'math-response',
		parentId: null,
		childrenIds: [],
		role: 'assistant',
		model: 'gpt-5.6-luna',
		content: 'Inline $x^2$.\n\n$$\n\\frac{1}{2}\n$$',
		timestamp: now,
		done: true
	};
	const response = await page.request.post('/api/v1/chats/new', {
		headers,
		data: {
			chat: {
				title: 'Isolated math acceptance',
				models: ['gpt-5.6-luna'],
				messages: [message],
				history: { messages: { 'math-response': message }, currentId: 'math-response' }
			}
		}
	});
	expect(response.ok()).toBe(true);
	const record = (await response.json()) as { id: string };
	try {
		await page.goto(`/c/${record.id}`);
		await expect(page.locator('.katex')).toHaveCount(2);
		await expect(page.locator('.katex-display')).toHaveCount(1);
		expect(errors).toEqual([]);
	} finally {
		expect((await page.request.delete(`/api/v1/chats/${record.id}`, { headers })).ok()).toBe(true);
	}
});

test('empty-data note accepts title and collaborative text and survives reload', async ({
	page
}) => {
	const errors = await prepare(page);
	await page.goto('/notes');
	await expect(page.getByLabel('User menu', { exact: true })).toBeVisible();
	const headers = await authHeaders(page);
	const response = await page.request.post('/api/v1/notes/create', {
		headers,
		data: { title: 'Isolated note acceptance', data: {} }
	});
	expect(response.ok()).toBe(true);
	const record = (await response.json()) as { id: string };
	try {
		await page.goto(`/notes/${record.id}`);
		const title = page.getByPlaceholder('Title', { exact: true });
		await expect(title).toHaveValue('Isolated note acceptance');
		const editor = page.locator(`#note-${record.id}`);
		await expect(editor).toBeVisible();
		await title.fill('Accepted title');
		await editor.click();
		await editor.fill('Accepted collaborative text');
		await expect
			.poll(async () => {
				const r = await page.request.get(`/api/v1/notes/${record.id}`, { headers });
				expect(r.ok()).toBe(true);
				return (await r.json()) as { title: string; data: { content: { md: string } } };
			})
			.toMatchObject({
				title: 'Accepted title',
				data: { content: { md: 'Accepted collaborative text' } }
			});
		await page.reload();
		await expect(title).toHaveValue('Accepted title');
		await expect(editor).toContainText('Accepted collaborative text');
		expect(errors).toEqual([]);
	} finally {
		expect((await page.request.delete(`/api/v1/notes/${record.id}/delete`, { headers })).ok()).toBe(
			true
		);
	}
});

test('actual template form preserves false and zero, requires selection, and tears down the map', async ({
	page
}) => {
	const errors = await prepare(page);
	await page.route('**://*.tile.openstreetmap.org/**', (route) => route.abort());
	const query =
		'Flag={{FLAG | checkbox:default="false"}}; Count={{COUNT | number:default=0}}; Choice={{CHOICE | select:options=["one","two"]:required}}; Point={{POINT | map:default="51.505, -0.09"}}';
	await page.goto(`/?model=gpt-5.6-luna&q=${encodeURIComponent(query)}&submit=false`);
	await expect(page.locator('#input-variable-0')).not.toBeChecked();
	await expect(page.locator('#input-variable-1')).toHaveValue('0');
	await expect(page.locator('#input-variable-2')).toHaveValue('');
	expect(
		await page
			.locator('form')
			.filter({ has: page.locator('#input-variable-2') })
			.evaluate((form: HTMLFormElement) => form.checkValidity())
	).toBe(false);
	await page.locator('#input-variable-2').selectOption('one');
	await expect(page.locator('.leaflet-container')).toBeVisible();
	await page.locator('.leaflet-container').click({ position: { x: 180, y: 160 } });
	await expect(page.locator('#input-variable-3')).toHaveValue(/^-?\d+(\.\d+)?, -?\d+(\.\d+)?$/);
	await page.locator('.leaflet-control-zoom-in').click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('.leaflet-container')).toHaveCount(0);
	await expect(page.locator('#chat-input')).toContainText(
		'Flag=false; Count=0; Choice=one; Point='
	);
	await expect(page.locator('#chat-input')).not.toContainText('{{');
	await page.waitForTimeout(700);
	expect(errors).toEqual([]);
	await expect(page.locator('.user-message')).toHaveCount(0);
});
