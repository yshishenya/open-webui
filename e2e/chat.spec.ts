import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
test.use({ storageState: 'e2e/.auth/admin.json' });

const getModelItems = async (page: Page) => {
	let modelItems = page.getByTestId('model-item');
	if ((await modelItems.count()) === 0) {
		modelItems = page.locator('button[aria-roledescription="model-item"]');
	}
	return modelItems;
};

const getAssistantMessages = async (page: Page) => {
	let assistantMessages = page.getByTestId('assistant-message');
	if ((await assistantMessages.count()) === 0) {
		assistantMessages = page.locator('.chat-assistant');
	}
	return assistantMessages;
};

const getUserMessages = async (page: Page) => {
	let userMessages = page.getByTestId('user-message');
	if ((await userMessages.count()) === 0) {
		userMessages = page.locator('.chat-user');
	}
	return userMessages;
};

const getResponseModelNames = async (page: Page) => {
	let modelNames = page.getByTestId('assistant-message-model');
	if ((await modelNames.count()) === 0) {
		modelNames = page.locator('#response-message-model-name');
	}
	return modelNames;
};

const getGenerateImageButton = async (page: Page) => {
	let imageButton = page.getByTestId('generate-image-button');
	if ((await imageButton.count()) === 0) {
		imageButton = page.locator('[aria-label="Generate Image"]');
	}
	return imageButton;
};

const selectFirstModelOrSkip = async (page: Page) => {
	await page.getByRole('button', { name: 'Select a model' }).click();
	const modelItems = await getModelItems(page);
	const emptyState = page.getByText('No results found');

	await Promise.race([
		modelItems.first().waitFor({ state: 'visible', timeout: 10_000 }),
		emptyState.waitFor({ state: 'visible', timeout: 10_000 })
	]);

	if ((await modelItems.count()) === 0) {
		test.skip(true, 'No models configured in this environment');
	}

	await modelItems.first().click();
};

const waitForChatResponseOrSkip = async (page: Page): Promise<void> => {
	const assistantMessage = await getAssistantMessages(page);
	const billingError = page.getByText(/insufficient_funds/i);

	await Promise.race([
		assistantMessage.first().waitFor({ state: 'visible', timeout: 120_000 }),
		billingError.first().waitFor({ state: 'visible', timeout: 120_000 })
	]);

	if ((await billingError.count()) > 0) {
		test.skip(true, 'Insufficient funds to run chat in this environment');
	}
};

test.describe('Chat', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('user can select a model', async ({ page }) => {
		await selectFirstModelOrSkip(page);
	});

	test('user can perform text chat', async ({ page }) => {
		test.slow();
		await selectFirstModelOrSkip(page);
		await page
			.locator('#chat-input')
			.fill('Hi, what can you do? A single sentence only please.');
		await page.locator('button[type="submit"]').click();

		const userMessages = await getUserMessages(page);
		await expect(userMessages.first()).toBeVisible();
		await waitForChatResponseOrSkip(page);
		const modelNames = await getResponseModelNames(page);
		await expect(modelNames.first()).toBeVisible({
			timeout: 120_000
		});
	});

	test('user can share chat', async ({ page }) => {
		test.slow();
		await selectFirstModelOrSkip(page);
		await page
			.locator('#chat-input')
			.fill('Hi, what can you do? A single sentence only please.');
		await page.locator('button[type="submit"]').click();

		const userMessages = await getUserMessages(page);
		await expect(userMessages.first()).toBeVisible();
		await waitForChatResponseOrSkip(page);
		const modelNames = await getResponseModelNames(page);
		await expect(modelNames.first()).toBeVisible({
			timeout: 120_000
		});

		await page.locator('#chat-context-menu-button').click();
		await page.locator('#chat-share-button').click();
		await expect(page.locator('#copy-and-share-chat-button')).toBeVisible();

		const shareRequestPromise = page.waitForRequest('**/api/v1/chats/**/share');
		await page.locator('#copy-and-share-chat-button').click();
		const shareRequest = await shareRequestPromise;
		expect(shareRequest.method()).toBe('POST');
	});

	test('user can generate image', async ({ page }) => {
		test.slow();
		await selectFirstModelOrSkip(page);
		await page
			.locator('#chat-input')
			.fill('Hi, what can you do? A single sentence only please.');
		await page.locator('button[type="submit"]').click();

		const userMessages = await getUserMessages(page);
		await expect(userMessages.first()).toBeVisible();
		await waitForChatResponseOrSkip(page);
		const modelNames = await getResponseModelNames(page);
		await expect(modelNames.first()).toBeVisible({
			timeout: 120_000
		});
		const imageButton = await getGenerateImageButton(page);
		if ((await imageButton.count()) === 0) {
			test.skip(true, 'Image generation is not available for this model');
		}
		await imageButton.click();
		await Promise.race([
			page.locator('img[data-cy="image"]').first().waitFor({ state: 'visible', timeout: 60_000 }),
			page.getByText(/insufficient_funds/i).first().waitFor({ state: 'visible', timeout: 60_000 })
		]);
		if ((await page.getByText(/insufficient_funds/i).count()) > 0) {
			test.skip(true, 'Insufficient funds to generate images');
		}
	});
});
