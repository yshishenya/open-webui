import { expect } from '@playwright/test';
import { test, facts, signIn } from './onboarding-paths.fixture';

for (const mode of ['backend-created', 'explicit-created']) {
	test(`${mode} chat and new-chat reset retain native navigation state`, async ({
		page,
		request,
		account
	}) => {
		await page.goto('/auth?form=1');
		await signIn(page, account);
		await page.goto('/?model=gpt-5.6-luna&q=Navigation%20fixture&submit=false');
		await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toContainText(
			'Navigation fixture'
		);
		await page.evaluate(() => {
			window.history.replaceState({ ...window.history.state, airisFixture: 'preserved' }, '');
			const replace = window.history.replaceState.bind(window.history);
			window.history.replaceState = (
				data: unknown,
				unused: string,
				url?: string | URL | null
			): void => {
				const before: unknown = window.history.state;
				replace(data, unused, url);
				const records = JSON.parse(sessionStorage.getItem('native-replacements') || '[]');
				records.push({ before, after: window.history.state, url: String(url) });
				sessionStorage.setItem('native-replacements', JSON.stringify(records));
			};
		});
		if (mode === 'backend-created') {
			await page.getByLabel(/^(Send a Message|How can I help you today\?)$/).press('Enter');
			await expect(page.getByRole('log')).toContainText('AIRIS deterministic answer.');
		} else {
			// Existing message-pair control invokes the real explicit creation handler.
			await page
				.locator('#generate-message-pair-button')
				.evaluate((button: HTMLButtonElement) => button.click());
			await expect(page.getByRole('log')).toContainText('[RESPONSE]');
		}
		await expect(page).toHaveURL(/\/c\/[^/]+$/);
		const records = await page.evaluate(
			() =>
				JSON.parse(sessionStorage.getItem('native-replacements') || '[]') as {
					before: object;
					after: object;
					url: string;
				}[]
		);
		const creation = records.filter((record) => record.url.startsWith('/c/'));
		expect(creation).toHaveLength(1);
		expect(creation[0].after).toEqual(creation[0].before);
		expect(creation[0].after).toMatchObject({ airisFixture: 'preserved' });
		// Invoke the same hidden control used by the native new-chat shortcut.
		await page.locator('#new-chat-button').evaluate((button: HTMLButtonElement) => button.click());
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toHaveText('');
		const reset = await page.evaluate(() =>
			(
				JSON.parse(sessionStorage.getItem('native-replacements') || '[]') as {
					before: object;
					after: object;
					url: string;
				}[]
			).filter((record) => record.url === '/')
		);
		expect(reset).toHaveLength(1);
		expect(reset[0].after).toEqual(reset[0].before);
		expect(reset[0].after).toMatchObject({ airisFixture: 'preserved' });
		const f = await facts(request, account);
		expect(f.ledger).toEqual([]);
		if (mode === 'explicit-created') expect(f).toEqual({ successes: 0, usage: [], ledger: [] });
		else await expect.poll(async () => (await facts(request, account)).successes).toBe(1);
	});
}
