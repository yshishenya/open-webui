import { expect, test } from '@playwright/test';
import { ensureAdmin, getUserMenuTrigger, loginAdmin } from './helpers/auth';

const photo = {
	name: 'synthetic.png',
	mimeType: 'image/png',
	buffer: Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8DA8J8BAAf/Af8Bf4mnAAAAAElFTkSuQmCC',
		'base64'
	)
};

for (const form of ['account', 'administrator'] as const) {
	test(`${form} keeps the photo and permits retry without Canvas`, async ({ page, request }) => {
		await page.addInitScript(() => {
			window.localStorage.setItem('locale', 'en-US');
			HTMLCanvasElement.prototype.getContext = (): null => null;
		});
		await ensureAdmin(request);
		await loginAdmin(page);
		const errors: string[] = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
			console.error('Upload page error:', error.message);
		});
		if (form === 'account') {
			await (await getUserMenuTrigger(page)).first().click();
			await page.getByRole('button', { name: 'Settings', exact: true }).click();
			await page.getByRole('tab', { name: 'Account', exact: true }).click();
			await expect(page.getByPlaceholder('Enter your name')).toHaveValue('Admin User');
		} else {
			await page.goto('/admin/users');
			await page
				.getByRole('row')
				.filter({ hasText: 'admin@example.com' })
				.getByRole('button', { name: 'Edit User', exact: true })
				.click();
			await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
				'Admin User'
			);
		}
		const image = page.locator('img[alt="profile"]').last();
		const previous = await image.getAttribute('src');
		const input = page.locator('#profile-image-input');
		for (let attempt = 1; attempt <= 2; attempt++) {
			await input.setInputFiles(photo);
			await expect(page.getByText('Failed to upload file.', { exact: true })).toHaveCount(attempt);
			await expect(input).toHaveValue('');
			await expect(image).toHaveAttribute('src', previous!);
		}
		const response = page.waitForResponse(
			(res) =>
				res.request().method() === 'POST' &&
				(form === 'account'
					? res.url().endsWith('/api/v1/auths/update/profile')
					: /\/api\/v1\/users\/[^/]+\/update$/.test(res.url()))
		);
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		const saved = await response;
		expect(saved.status()).toBe(200);
		expect(saved.request().postDataJSON().profile_image_url).toBe(previous);
		expect(errors).toEqual([]);
	});
}
