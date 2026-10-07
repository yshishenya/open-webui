import { expect } from '@playwright/test';
import {
	test,
	state,
	facts,
	billing,
	signIn,
	openSidebar,
	type Mail
} from './onboarding-paths.fixture';

for (const example of ['написать текст', 'разобраться в теме', 'составить план']) {
	test(`guide → login → answer → exact free quota: ${example}`, async ({
		page,
		request,
		account
	}) => {
		const before = (await billing(request, account, 'lead-magnet')).usage;
		const providerBefore = (await state(request)).calls.length;
		await page.goto('/guide');
		await page.getByRole('link', { name: `Открыть задачу: ${example}` }).click();
		await expect(page).toHaveURL(/\/auth\?/);
		const draft = new URL(
			new URL(page.url()).searchParams.get('redirect')!,
			page.url()
		).searchParams.get('q')!;
		await signIn(page, account);
		await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toContainText(
			draft
		);
		await expect(page.getByRole('button', { name: 'Selected model: gpt-5.6-luna' })).toBeVisible();
		expect((await state(request)).calls.length).toBe(providerBefore);
		await expect(page.getByRole('log').getByRole('listitem')).toHaveCount(0);
		await page.getByLabel(/^(Send a Message|How can I help you today\?)$/).press('Enter');
		await expect(page.getByRole('log').getByRole('listitem')).toHaveCount(2);
		await expect(
			page.getByRole('log').getByText('AIRIS deterministic answer.', { exact: true })
		).toBeVisible();
		await expect
			.poll(() => facts(request, account))
			.toEqual({
				successes: 1,
				usage: [{ model: 'gpt-5.6-luna', input: 17, output: 3, source: 'lead_magnet', charged: 0 }],
				ledger: []
			});
		const usage = (await billing(request, account, 'lead-magnet')).usage as {
			tokens_input: number;
			tokens_output: number;
		};
		expect(before).toMatchObject({ tokens_input: 0, tokens_output: 0 });
		expect(usage).toMatchObject({ tokens_input: 17, tokens_output: 3 });
		expect((await billing(request, account, 'balance')).balance_topup_kopeks).toBe(0);
		expect((await state(request)).calls.slice(providerBefore)).toEqual([
			{
				model: 'gpt-5.6-luna',
				failed: false,
				usage: { prompt_tokens: 17, completion_tokens: 3, total_tokens: 20 }
			}
		]);
		await openSidebar(page);
		await page.getByRole('button', { name: 'Close Sidebar', exact: true }).click();
		await page.reload();
		await expect(
			page.getByRole('log').getByText('AIRIS deterministic answer.', { exact: true })
		).toBeVisible();
		expect((await facts(request, account)).successes).toBe(1);
		await openSidebar(page);
		await page.getByRole('link', { name: 'New Chat', exact: true }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toHaveText('');
		expect((await state(request)).calls.length).toBe(providerBefore + 1);
	});
}

test('failed provider response consumes no quota, money or completed success', async ({
	page,
	request,
	account
}) => {
	await page.goto('/auth?form=1');
	await signIn(page, account);
	await page.goto('/?model=gpt-5.6-luna&q=E2E_FORCE_ERROR&submit=false');
	await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toContainText(
		'E2E_FORCE_ERROR'
	);
	await page.getByLabel(/^(Send a Message|How can I help you today\?)$/).press('Enter');
	await expect(page.getByText('Fixture provider failed', { exact: false }).first()).toBeVisible();
	expect(await facts(request, account)).toEqual({ successes: 0, usage: [], ledger: [] });
	expect((await billing(request, account, 'lead-magnet')).usage).toMatchObject({
		tokens_input: 0,
		tokens_output: 0
	});
	expect((await billing(request, account, 'balance')).balance_topup_kopeks).toBe(0);
});

test('empty chat sidebar and embedded note chat fit their available width without sending', async ({
	page,
	request,
	account
}) => {
	const providerBefore = (await state(request)).calls.length;
	await page.goto('/auth?form=1');
	await signIn(page, account);
	await openSidebar(page);
	await page.getByRole('button', { name: 'Close Sidebar', exact: true }).click();
	const created = await request.post('/api/v1/notes/create', {
		headers: { Authorization: `Bearer ${account.token}` },
		data: { title: 'Local sidebar layout note' }
	});
	expect(created.ok()).toBe(true);
	const note = (await created.json()) as { id: string };
	await page.goto(`/notes/${note.id}`);
	await page.getByRole('button', { name: 'Chat', exact: true }).click();
	const embedded = page.locator('#note-chat-container');
	await expect(embedded).toBeVisible();
	const bounds = await embedded.boundingBox();
	expect(bounds!.width).toBeGreaterThan(0);
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
	await expect(embedded.getByRole('log').getByRole('listitem')).toHaveCount(0);
	expect((await state(request)).calls.length).toBe(providerBefore);
	expect(await facts(request, account)).toEqual({ successes: 0, usage: [], ledger: [] });
});

for (const context of ['ordinary', 'embedded']) {
	test(`required constructor variable opens and retains an own value in ${context} chat`, async ({
		page,
		request,
		account
	}) => {
		const providerBefore = (await state(request)).calls.length;
		const headers = { Authorization: `Bearer ${account.token}` };
		const settings = await request.post('/api/v1/users/user/settings/update', {
			headers,
			data: { ui: { models: ['airis-constructor-form'] } }
		});
		expect(settings.ok()).toBe(true);
		await page.goto('/auth?form=1');
		await signIn(page, account);
		if (context === 'embedded') {
			const created = await request.post('/api/v1/notes/create', {
				headers,
				data: { title: 'Local constructor form note' }
			});
			expect(created.ok()).toBe(true);
			const note = (await created.json()) as { id: string };
			await page.goto(`/notes/${note.id}`);
			await page.getByRole('button', { name: 'Chat', exact: true }).click();
			await expect(page.locator('#note-chat-container')).toBeVisible();
		} else {
			await page.goto('/?models=airis-constructor-form&submit=false');
		}
		const chat = context === 'embedded' ? page.locator('#note-chat-container') : page;
		const variables = chat.getByRole('button', { name: 'Chat Variables', exact: true });
		await variables.click();
		const field = page.locator('#input-variable-0');
		await expect(field).toBeVisible();
		await expect(field).toHaveValue('');
		await expect(field).toHaveAttribute('required', '');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(field).toBeVisible();
		await expect(field).toHaveValue('');
		await field.fill('Entered constructor value');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(field).toBeHidden();
		await variables.click();
		await expect(field).toHaveValue('Entered constructor value');
		await page.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(chat.getByRole('log').getByRole('listitem')).toHaveCount(0);
		expect((await state(request)).calls.length).toBe(providerBefore);
		expect(await facts(request, account)).toEqual({ successes: 0, usage: [], ledger: [] });
	});
}

test('checkout → exact credit → visible history → one service email, replay gives zero duplicates', async ({
	page,
	request,
	account
}) => {
	const headers = { Authorization: `Bearer ${account.token}` };
	const providerBefore = (await state(request)).calls.length;
	await page.goto('/auth?form=1');
	await signIn(page, account);
	await page.goto('/?model=gpt-5.6-luna&q=Payment%20return%20test&submit=false');
	await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toContainText(
		'Payment return test'
	);
	await page.getByLabel(/^(Send a Message|How can I help you today\?)$/).press('Enter');
	await expect(
		page.getByRole('log').getByText('AIRIS deterministic answer.', { exact: true })
	).toBeVisible();
	await expect(page).toHaveURL(/\/c\//);
	const chatURL = page.url();
	if ((page.viewportSize()?.width ?? 1000) < 640) {
		await openSidebar(page);
		await page.getByRole('button', { name: 'User menu', exact: true }).last().click();
		await page.getByTestId('user-menu-billing').click();
	} else {
		await page.getByRole('link', { name: /^Open wallet:/ }).click();
	}
	const created = page.waitForResponse(
		(response) => response.url().endsWith('/api/v1/billing/topup') && response.status() === 200
	);
	await page.getByTestId('topup-preset').first().click();
	await page.getByTestId('topup-proceed').click();
	await created;
	await expect(page.getByRole('button', { name: 'Pay 500 RUB in local fixture' })).toBeVisible();
	const payment = { payment_id: new URL(page.url()).pathname.split('/').at(-1)! };
	const pending = await request.post('/api/v1/billing/topup/reconcile', { headers, data: payment });
	expect(pending.ok()).toBe(true);
	expect(await pending.json()).toMatchObject({ credited: false, provider_status: 'pending' });
	expect((await facts(request, account)).ledger).toEqual([]);
	await request.post('/_fixture/drain');
	const notices = async (): Promise<Mail[]> =>
		(await state(request, account.email)).mail.filter(
			(mail) => mail.subject === 'Баланс AIRIS пополнен'
		);
	expect(await notices()).toEqual([]);
	await page.getByRole('button', { name: 'Pay 500 RUB in local fixture' }).click();
	await expect(page.getByText('Top-up successful', { exact: true })).toBeVisible();
	expect((await billing(request, account, 'balance')).balance_topup_kopeks).toBe(50000);
	await expect
		.poll(async () => (await facts(request, account)).ledger)
		.toEqual([{ amount: 50000, reference: payment.payment_id }]);
	await expect(page.getByText('Top-up', { exact: true }).first()).toBeVisible();
	await page.getByRole('link', { name: 'Operations', exact: true }).click();
	await expect(
		page.getByRole('article', { name: /^Top-up,/ }).getByText('+RUB 500.00', { exact: true })
	).toBeVisible();
	await page
		.getByRole('link', { name: /^Back( to chat)?$/ })
		.first()
		.click();
	await expect(page).toHaveURL(chatURL);
	await expect(
		page.getByRole('log').getByText('AIRIS deterministic answer.', { exact: true })
	).toBeVisible();
	await request.post('/_fixture/drain');
	await expect.poll(notices).toHaveLength(1);
	const first = (await notices())[0];
	expect(first.reply_to).toBe('support@airis.you');
	expect(first.text).toContain('500');
	expect(first.message_id).toMatch(/^<.+>$/);
	for (let index = 0; index < 2; index++) {
		const replay = await request.post('/api/v1/billing/topup/reconcile', {
			headers,
			data: payment
		});
		expect(replay.ok()).toBe(true);
		expect(await replay.json()).toMatchObject({ credited: true });
		await request.post('/_fixture/drain');
	}
	expect((await facts(request, account)).ledger).toEqual([
		{ amount: 50000, reference: payment.payment_id }
	]);
	expect(await notices()).toEqual([first]);
	expect((await facts(request, account)).successes).toBe(1);
	expect((await state(request)).calls.length).toBe(providerBefore + 1);
});
