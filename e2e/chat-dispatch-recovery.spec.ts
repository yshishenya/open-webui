import { expect, type Locator, type Page } from '@playwright/test';
import { test, state, facts, signIn } from './onboarding-paths.fixture';

const composer = (page: Page): Locator =>
	page.getByLabel(/^(Send a Message|How can I help you today\?)$/);

async function saved(page: Page, actor: string, scope: string, pending = false): Promise<unknown> {
	return page.evaluate(
		({ actor, scope, pending }) => {
			const name = `${pending ? 'airis-pending-dispatch' : 'airis-chat-draft'}:${JSON.stringify([actor, scope])}`;
			const raw = (pending && scope !== 'temporary' ? localStorage : sessionStorage).getItem(name);
			return raw === null ? null : JSON.parse(raw);
		},
		{ actor, scope, pending }
	);
}

test('long composer and image survive reload; accepted guide draft does not return', async ({
	page,
	request,
	account
}) => {
	await page.goto('/auth?form=1');
	await signIn(page, account);
	await page.goto('/?model=gpt-5.6-luna&submit=false');
	const text = 'Draft: ' + 'x'.repeat(6000);
	await composer(page).fill(text);
	await page.locator('input[type="file"][multiple]').setInputFiles('static/favicon.png');
	await expect
		.poll(() => saved(page, account.id, 'home'))
		.toMatchObject({
			prompt: text,
			selectedModels: ['gpt-5.6-luna'],
			files: [{ type: 'file', content_type: 'image/png', status: 'uploaded' }]
		});
	const snapshot = await saved(page, account.id, 'home');
	await page.reload();
	await expect(composer(page)).toHaveText(text);
	expect(await saved(page, account.id, 'home')).toEqual(snapshot);
	expect(await facts(request, account)).toEqual({ successes: 0, usage: [], ledger: [] });
	await composer(page).press('Enter');
	await expect(page.getByRole('log')).toContainText('AIRIS deterministic answer.');
	await expect.poll(() => facts(request, account)).toMatchObject({ successes: 1, ledger: [] });
	await page.goto('/');
	await expect(composer(page)).toHaveText('');
	await page.reload();
	await expect(composer(page)).toHaveText('');
});

for (const accepted of [true, false]) {
	test(`lost ${accepted ? 'accepted' : 'unsent'} acknowledgement retains the operation across reload`, async ({
		page,
		request,
		account
	}) => {
		await page.goto('/auth?form=1');
		await signIn(page, account);
		await page.goto('/?model=gpt-5.6-luna&submit=false');
		const callsBefore = (await state(request)).calls.length;
		const bodies: Record<string, unknown>[] = [];
		await page.route('**/api/chat/completions', async (route) => {
			bodies.push(route.request().postDataJSON() as Record<string, unknown>);
			if (bodies.length === 1) {
				if (accepted) expect((await route.fetch()).ok()).toBe(true);
				await route.abort('failed');
			} else await route.continue();
		});
		await composer(page).fill('Keep this original request');
		await composer(page).press('Enter');
		await expect(
			page.getByRole('button', { name: 'Check request status', exact: true })
		).toBeVisible();
		await expect.poll(() => bodies.length).toBe(1);
		const pending = await saved(page, account.id, 'home', true);
		expect(pending).toMatchObject({
			composer: { draft: { prompt: 'Keep this original request' } }
		});
		if (accepted) await expect.poll(() => facts(request, account)).toMatchObject({ successes: 1 });
		await page.reload();
		await expect(composer(page)).toHaveText('Keep this original request');
		expect(await saved(page, account.id, 'home', true)).toEqual(pending);
		await page.getByRole('button', { name: 'Retry saved request', exact: true }).click();
		await expect(page.getByRole('log')).toContainText('AIRIS deterministic answer.');
		await expect(page).toHaveURL(/\/c\//);
		await expect
			.poll(() => facts(request, account))
			.toEqual({
				successes: 1,
				usage: [{ model: 'gpt-5.6-luna', input: 17, output: 3, source: 'lead_magnet', charged: 0 }],
				ledger: []
			});
		expect((await state(request)).calls.length).toBe(callsBefore + 1);
		expect(bodies).toHaveLength(accepted ? 1 : 2);
		if (!accepted) {
			const meaningful = (body: Record<string, unknown>): Record<string, unknown> => {
				const copy = { ...body };
				delete copy.session_id;
				return copy;
			};
			expect(meaningful(bodies[1])).toEqual(meaningful(bodies[0]));
		}
		expect(await saved(page, account.id, 'home', true)).toBeNull();
		await page.goto('/');
		await expect(composer(page)).toHaveText('');
	});
}

test('lost note creation acknowledgement reuses its UUID and keeps the draft on reload', async ({
	page,
	request,
	account
}) => {
	await page.goto('/auth?form=1');
	await signIn(page, account);
	const headers = { Authorization: `Bearer ${account.token}` };
	const providerBefore = (await state(request)).calls.length;
	const created = await request.post('/api/v1/notes/create', {
		headers,
		data: { title: 'Recovery note' }
	});
	expect(created.ok()).toBe(true);
	const note = (await created.json()) as { id: string };
	await page.goto(`/notes/${note.id}`);
	await page.getByRole('button', { name: 'Chat', exact: true }).click();
	const embedded = page.locator('#note-chat-container');
	await composer(page).fill('First note question');
	await composer(page).press('Enter');
	await expect(embedded.getByRole('log')).toContainText('AIRIS deterministic answer.');
	await embedded.getByLabel('Chat history', { exact: true }).click();
	await page.getByRole('button', { name: 'New chat', exact: true }).click();
	const operations: string[] = [];
	const chats: string[] = [];
	await page.route(`**/api/v1/notes/${note.id}/chat?*`, async (route) => {
		operations.push(new URL(route.request().url()).searchParams.get('operation_id')!);
		const response = await route.fetch();
		expect(response.ok()).toBe(true);
		chats.push(((await response.json()) as { id: string }).id);
		if (operations.length === 1) await route.abort('failed');
		else await route.fulfill({ response });
	});
	await composer(page).fill('Keep the second note question');
	await composer(page).press('Enter');
	await expect.poll(() => operations.length).toBe(1);
	await expect(composer(page)).toHaveText('Keep the second note question');
	await page.reload();
	await page.getByRole('button', { name: 'Chat', exact: true }).click();
	await expect(composer(page)).toHaveText('Keep the second note question');
	await composer(page).press('Enter');
	await expect(embedded.getByRole('log')).toContainText('AIRIS deterministic answer.');
	expect(operations).toHaveLength(2);
	expect(operations[1]).toBe(operations[0]);
	expect(chats[1]).toBe(chats[0]);
	await expect
		.poll(() => facts(request, account))
		.toEqual({
			successes: 2,
			usage: [0, 1].map(() => ({
				model: 'gpt-5.6-luna',
				input: 17,
				output: 3,
				source: 'lead_magnet',
				charged: 0
			})),
			ledger: []
		});
	expect((await state(request)).calls.length).toBe(providerBefore + 2);
	const list = await request.get(`/api/v1/notes/${note.id}/chats`, { headers });
	expect(list.ok()).toBe(true);
	expect((await list.json()) as object[]).toHaveLength(2);
});

for (const accepted of [true, false]) {
	test(`temporary ${accepted ? 'accepted' : 'unknown'} request is never blindly sent again`, async ({
		page,
		request,
		account
	}) => {
		await page.goto('/auth?form=1');
		await signIn(page, account);
		await page.goto('/?model=gpt-5.6-luna&temporary-chat=true&submit=false');
		let posts = 0;
		const before = (await state(request)).calls.length;
		await page.route('**/api/chat/completions', async (route) => {
			posts++;
			if (accepted) expect((await route.fetch()).ok()).toBe(true);
			await route.abort('failed');
		});
		if (!accepted) {
			// Only the unknown status is simulated; this checks the browser's refusal to retry.
			await page.route('**/api/v1/chat/dispatches/*', (route) =>
				route.fulfill({ json: { state: 'unknown', receipt: null } })
			);
		}
		await composer(page).fill('Private temporary request');
		await composer(page).press('Enter');
		await expect(
			page.getByRole('button', { name: 'Check request status', exact: true })
		).toBeVisible();
		await expect.poll(() => posts).toBe(1);
		const pending = await saved(page, account.id, 'temporary', true);
		expect(pending).toMatchObject({ scope: 'temporary' });
		await page.reload();
		await expect(composer(page)).toHaveText('Private temporary request');
		for (let i = 0; i < 2; i++) {
			await page.getByRole('button', { name: 'Retry saved request', exact: true }).click();
			await expect(page.getByRole('status')).toContainText(
				accepted ? 'The temporary request was accepted.' : 'The request may have started.'
			);
		}
		expect(posts).toBe(1);
		expect((await state(request)).calls.length).toBe(before + (accepted ? 1 : 0));
		await expect
			.poll(() => facts(request, account))
			.toEqual({
				successes: accepted ? 1 : 0,
				usage: accepted
					? [{ model: 'gpt-5.6-luna', input: 17, output: 3, source: 'lead_magnet', charged: 0 }]
					: [],
				ledger: []
			});
		expect(await saved(page, account.id, 'temporary', true)).toEqual(pending);
		expect(
			await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('temporary')))
		).toEqual([]);
	});
}
