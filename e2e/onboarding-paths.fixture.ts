import { randomUUID } from 'node:crypto';
import {
	expect,
	request as apiRequest,
	test as base,
	type APIRequestContext,
	type Page
} from '@playwright/test';

export type Account = { id: string; email: string; password: string; token: string };
type Facts = {
	successes: number;
	usage: { model: string; input: number; output: number; source: string; charged: number }[];
	ledger: { amount: number; reference: string }[];
};
export type Mail = { subject: string; text: string; message_id: string; reply_to: string };
type State = {
	calls: {
		model: string;
		failed: boolean;
		usage: { prompt_tokens: number; completion_tokens: number } | null;
	}[];
	mail: Mail[];
};

export const test = base.extend<{ account: Account }>({
	page: async ({ page }, use) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.addInitScript(() => {
			localStorage.setItem('locale', 'en-US');
			localStorage.setItem('settings', JSON.stringify({ version: '0.11.0' }));
			localStorage.setItem('airis.analytics.consent.v1', 'denied');
		});
		await use(page);
		expect(errors).toEqual([]);
	},
	account: async ({ baseURL }, use) => {
		const client = await apiRequest.newContext({ baseURL });
		try {
			const credentials = {
				email: `fullpaths-${randomUUID()}@airis.you`,
				password: 'local-fixture-only'
			};
			const signup = await client.post('/api/v1/auths/signup', {
				data: {
					...credentials,
					name: 'Local ordinary fixture',
					terms_accepted: true,
					privacy_accepted: true,
					product_emails_opt_in: false
				}
			});
			expect(signup.ok()).toBe(true);
			const account = (await signup.json()) as Account & { role: string };
			expect(account.role).toBe('user');
			const captured = await state(client, credentials.email);
			const verification = captured.mail
				.flatMap((mail) => mail.text.match(/https?:\/\/[^\s<>]+/g) || [])
				.find((url) => url.includes('/verify-email'));
			expect(verification).toBeTruthy();
			const verified = await client.get('/api/v1/auths/verify-email', {
				params: { token: new URL(verification!).searchParams.get('token')! }
			});
			expect(verified.ok()).toBe(true);
			await use({ ...account, ...credentials });
		} finally {
			await client.dispose();
		}
	}
});

export async function state(client: APIRequestContext, recipient = ''): Promise<State> {
	const response = await client.get('/_fixture/state', { params: { recipient } });
	expect(response.ok()).toBe(true);
	return response.json() as Promise<State>;
}
export async function facts(client: APIRequestContext, account: Account): Promise<Facts> {
	const response = await client.get(`/_fixture/facts/${account.id}`);
	expect(response.ok()).toBe(true);
	return response.json() as Promise<Facts>;
}
export async function billing(
	client: APIRequestContext,
	account: Account,
	path: string
): Promise<Record<string, unknown>> {
	const response = await client.get(`/api/v1/billing/${path}`, {
		headers: { Authorization: `Bearer ${account.token}` }
	});
	expect(response.ok()).toBe(true);
	return response.json() as Promise<Record<string, unknown>>;
}
export async function signIn(page: Page, account: Account): Promise<void> {
	await expect(page.getByPlaceholder('Enter Your Password')).toBeVisible();
	if (await page.getByRole('textbox', { name: 'Name', exact: true }).isVisible())
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page.getByRole('textbox', { name: /email/i }).fill(account.email);
	await page.getByPlaceholder('Enter Your Password').fill(account.password);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toBeVisible();
}

export async function openSidebar(page: Page): Promise<void> {
	const button = page.getByRole('button', { name: 'Open Sidebar', exact: true });
	await expect(button).toBeVisible();
	await expect.poll(async () => (await button.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0);
	const bounds = await button.boundingBox();
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
	await button.click();
}
