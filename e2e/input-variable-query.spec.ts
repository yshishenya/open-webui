import { expect, test, type Page } from '@playwright/test';

type DesktopQueryEvent = {
	type: string;
	data: { query?: string; files?: { dataUrl: string; name: string }[] };
};
type QueryTestWindow = Window & {
	electronAPI?: {
		send: () => Promise<null>;
		onEvent: (callback: (event: DesktopQueryEvent) => Promise<void>) => void;
	};
	queryTestEvent?: (event: DesktopQueryEvent) => Promise<void>;
};

test.use({ storageState: 'e2e/.auth/admin.json' });

const prepare = async (
	page: Page,
	desktop: boolean
): Promise<{ requests: string[]; errors: string[] }> => {
	const requests: string[] = [];
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript((desktop) => {
		localStorage.setItem('airis.analytics.consent.v1', 'denied');
		localStorage.setItem('locale', 'en-US');
		if (desktop) {
			// Exercise the real event consumer through a test Electron bridge.
			const host = window as QueryTestWindow;
			host.electronAPI = {
				send: async () => null,
				onEvent: (callback) => {
					host.queryTestEvent = callback;
				}
			};
		}
	}, desktop);
	await page.route('**/api/models**', (route) =>
		route.fulfill({
			json: {
				data: [{ id: 'gpt-5.6-luna', name: 'gpt-5.6-luna', owned_by: 'openai' }]
			}
		})
	);
	await page.route('**/api/chat/completions', (route) => {
		requests.push(route.request().postData() ?? '');
		return route.fulfill({ status: 503, json: { detail: 'Isolated test: provider disabled' } });
	});
	return { requests, errors };
};

const openQuery = async (
	page: Page,
	desktop: boolean,
	query: string,
	submit = true
): Promise<void> => {
	if (desktop) {
		await page.goto('/notes');
		await page.waitForFunction(
			() => typeof (window as QueryTestWindow).queryTestEvent === 'function'
		);
		await page.evaluate(
			(query) => (window as QueryTestWindow).queryTestEvent!({ type: 'query', data: { query } }),
			query
		);
	} else {
		await page.goto(`/?model=gpt-5.6-luna&q=${encodeURIComponent(query)}&submit=${submit}`);
	}
	await expect(page.getByRole('button', { name: 'Selected model' })).toBeVisible();
};

for (const desktop of [false, true]) {
	for (const action of ['Cancel', 'Save'] as const) {
		test(`${desktop ? 'desktop' : 'URL'} query waits for form and ${action.toLowerCase()} controls submission`, async ({
			page
		}) => {
			const { requests, errors } = await prepare(page, desktop);
			await openQuery(page, desktop, 'Before {{NAME}}');
			await page.waitForTimeout(400);
			expect(requests).toHaveLength(0);
			await expect(page.locator('.user-message')).toHaveCount(0);
			const field = page.locator('#input-variable-0');
			await expect(field).toBeVisible();
			await field.fill('Alice');
			await page.getByRole('button', { name: action, exact: true }).click();
			await expect(field).not.toBeVisible();
			if (action === 'Save') {
				await expect.poll(() => requests.length).toBe(1);
				const payload = JSON.parse(requests[0]) as { user_message: { content: string } };
				expect(payload.user_message.content).toBe('Before Alice');
				await expect(page.locator('.user-message')).toHaveCount(1);
				await expect(page.locator('.user-message')).toContainText('Before Alice');
			}
			await page.waitForTimeout(400);
			expect(requests).toHaveLength(action === 'Save' ? 1 : 0);
			if (action === 'Cancel') await expect(page.locator('.user-message')).toHaveCount(0);
			expect(errors).toEqual([]);
		});
	}
	test(`${desktop ? 'desktop' : 'URL'} plain query still submits exactly once`, async ({
		page
	}) => {
		const { requests, errors } = await prepare(page, desktop);
		await openQuery(page, desktop, 'Plain query');
		await expect.poll(() => requests.length).toBe(1);
		const payload = JSON.parse(requests[0]) as { user_message: { content: string } };
		expect(payload.user_message.content).toBe('Plain query');
		await page.waitForTimeout(400);
		expect(requests).toHaveLength(1);
		expect(errors).toEqual([]);
	});
}

test('submit=false saves a filled draft without sending it', async ({ page }) => {
	const { requests, errors } = await prepare(page, false);
	await openQuery(page, false, 'Before {{NAME}}', false);
	await page.locator('#input-variable-0').fill('Alice');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('#chat-input')).toContainText('Before Alice');
	await page.waitForTimeout(400);
	expect(requests).toHaveLength(0);
	await expect(page.locator('.user-message')).toHaveCount(0);
	expect(errors).toEqual([]);
});
