import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { test, facts, signIn, openSidebar, type Account } from './onboarding-paths.fixture';

async function pendingChat(
	request: APIRequestContext,
	account: Account,
	mode: 'root' | 'orphan' | 'valid',
	title: string
): Promise<string> {
	const question = randomUUID(),
		answer = randomUUID();
	const messages = [
		...(mode === 'valid'
			? [
					{
						id: question,
						role: 'user',
						content: 'Saved question',
						parentId: null,
						childrenIds: [answer],
						timestamp: 1
					}
				]
			: []),
		{
			id: answer,
			role: 'assistant',
			model: 'gpt-5.6-luna',
			content: title + ' partial answer',
			parentId: mode === 'root' ? null : question,
			childrenIds: [],
			done: false,
			timestamp: 2
		}
	];
	const created = await request.post('/api/v1/chats/new', {
		headers: { Authorization: `Bearer ${account.token}` },
		data: {
			chat: {
				title,
				models: ['gpt-5.6-luna'],
				messages,
				history: {
					currentId: answer,
					messages: Object.fromEntries(messages.map((m) => [m.id, m]))
				},
				params: {},
				timestamp: 1
			}
		}
	});
	expect(created.ok()).toBe(true);
	return ((await created.json()) as { id: string }).id;
}

async function retainPending(page: Page): Promise<void> {
	await page.route('**/api/tasks/chat/**', async (route) => {
		if (route.request().method() === 'GET')
			await route.fulfill({ json: { task_ids: ['compiled-pending-fixture'] } });
		else await route.continue();
	});
}

for (const mode of ['root', 'orphan'] as const) {
	test(`stop repaired ${mode} assistant preserves partial text and releases input`, async ({
		page,
		request,
		account
	}) => {
		const id = await pendingChat(request, account, mode, 'Cancellation fixture');
		await retainPending(page);
		await page.addInitScript(({ token }) => localStorage.setItem('token', token), account);
		await page.goto(`/c/${id}`);
		await expect(page.getByRole('log')).toContainText('Cancellation fixture partial answer');
		await page.getByRole('button', { name: 'Stop', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0);
		await expect(page.getByRole('log')).toContainText('Cancellation fixture partial answer');
		expect(await facts(request, account)).toEqual({ successes: 0, usage: [], ledger: [] });
	});
}

test('refused stop preserves pending response and a retry completes it', async ({
	page,
	request,
	account
}) => {
	const id = await pendingChat(request, account, 'valid', 'Retry fixture');
	await retainPending(page);
	let refused = true;
	await page.route('**/api/tasks/chat/**/stop', async (route) => {
		if (refused) {
			refused = false;
			await route.fulfill({ status: 503, json: { detail: 'Fixture stop refused' } });
		} else await route.continue();
	});
	await page.addInitScript(({ token }) => localStorage.setItem('token', token), account);
	await page.goto(`/c/${id}`);
	await page.getByRole('button', { name: 'Stop', exact: true }).click();
	await expect(page.getByText('Fixture stop refused', { exact: false })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
	await expect(page.getByRole('log')).toContainText('Retry fixture partial answer');
	await page.getByRole('button', { name: 'Stop', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0);
	expect(await facts(request, account)).toEqual({ successes: 0, usage: [], ledger: [] });
});

test('delayed stop cannot complete the next chat response', async ({ page, request, account }) => {
	const oldId = await pendingChat(request, account, 'valid', 'Old cancellation fixture');
	const nextId = await pendingChat(request, account, 'valid', 'Next cancellation fixture');
	await retainPending(page);
	let release: () => void = () => {};
	const wait = new Promise<void>((resolve) => {
		release = resolve;
	});
	let requested: () => void = () => {};
	const started = new Promise<void>((resolve) => {
		requested = resolve;
	});
	await page.route(`**/api/tasks/chat/${oldId}/stop`, async (route) => {
		requested();
		await wait;
		await route.fulfill({ json: { status: true } });
	});
	await page.addInitScript(({ token }) => localStorage.setItem('token', token), account);
	await page.goto(`/c/${oldId}`);
	await page.getByRole('button', { name: 'Stop', exact: true }).click();
	await started;
	await openSidebar(page);
	await page.locator(`a[href="/c/${nextId}"]`).click();
	await expect(page.getByRole('log')).toContainText('Next cancellation fixture partial answer');
	const completed = page.waitForResponse((response) =>
		response.url().includes(`/api/tasks/chat/${oldId}/stop`)
	);
	release();
	await completed;
	await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
	await expect(page.getByRole('log')).not.toContainText('Old cancellation fixture partial answer');
	expect(await facts(request, account)).toEqual({ successes: 0, usage: [], ledger: [] });
});

test('native streaming task cancellation preserves partial answer without completed success', async ({
	page,
	request,
	account
}) => {
	await page.goto('/auth?form=1');
	await signIn(page, account);
	await page.goto('/?model=gpt-5.6-luna&q=E2E_WAIT_CANCEL&submit=false');
	await page.getByLabel(/^(Send a Message|How can I help you today\?)$/).press('Enter');
	await expect(page.getByRole('log')).toContainText('AIRIS deterministic answer.');
	const stopped = page.waitForResponse(
		(response) =>
			response.request().method() === 'POST' &&
			response.url().includes('/api/tasks/chat/') &&
			response.url().endsWith('/stop')
	);
	await page.getByRole('button', { name: 'Stop', exact: true }).click();
	const response = await stopped;
	expect(response.ok()).toBe(true);
	expect(await response.json()).toMatchObject({ status: true });
	await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0);
	await expect(page.getByRole('log')).toContainText('AIRIS deterministic answer.');
	const f = await facts(request, account);
	expect(f.successes).toBe(0);
	expect(f.ledger).toEqual([]);
});
