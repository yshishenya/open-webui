import { expect, test } from '@playwright/test';

test('model settings remove listeners across repeated visits and delayed initialization', async ({
	page,
	request,
	baseURL
}) => {
	if (!baseURL || new URL(baseURL).hostname !== 'onboarding-paths')
		throw new Error('Requires disposable onboarding-paths fixture');
	const login = await request.post('/api/v1/auths/signin', {
		data: { email: 'fullpaths-admin@airis.you', password: 'local-fixture-only' }
	});
	expect(login.ok()).toBe(true);
	const admin = (await login.json()) as { token: string; role: string };
	expect(admin.role).toBe('admin');
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(
		({ token }) => {
			localStorage.setItem('token', token);
			localStorage.setItem('locale', 'en-US');
			localStorage.setItem('airis.analytics.consent.v1', 'denied');
			const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
			const add = window.addEventListener;
			const remove = window.removeEventListener;
			window.addEventListener = (name, listener, options): void => {
				if (listener && ['keydown', 'keyup', 'blur'].includes(name)) {
					const set = listeners.get(name) ?? new Set();
					set.add(listener);
					listeners.set(name, set);
				}
				add.call(window, name, listener, options);
			};
			window.removeEventListener = (name, listener, options): void => {
				if (listener) listeners.get(name)?.delete(listener);
				remove.call(window, name, listener, options);
			};
			Object.defineProperty(window, '__airisListenerCount', {
				get: (): number => [...listeners.values()].reduce((sum, set) => sum + set.size, 0)
			});
		},
		{ token: admin.token }
	);
	const count = async (): Promise<number> =>
		page.evaluate(() => (window as Window & { __airisListenerCount: number }).__airisListenerCount);
	await page.goto('/admin/settings/general');
	const changelog = page.getByRole('button', { name: "Okay, Let's Go!" });
	if ((await changelog.count()) > 0) await changelog.click();
	await expect(page.locator('a#models')).toBeVisible();
	const baseline = await count();
	for (let visit = 0; visit < 3; visit++) {
		await page.locator('a#models').click();
		await expect(page.locator('[id="model-item-gpt-5.6-luna"]')).toBeVisible();
		await expect.poll(count).toBe(baseline + 3);
		await page.locator('a#general').click();
		await expect(page.locator('[id="model-item-gpt-5.6-luna"]')).toHaveCount(0);
		await expect.poll(count).toBe(baseline);
	}
	let release: () => void = () => {};
	const hold = new Promise<void>((resolve) => {
		release = resolve;
	});
	let intercepted = false;
	await page.route('**/api/v1/configs/models', async (route) => {
		intercepted = true;
		await hold;
		await route.continue();
	});
	await page.locator('a#models').click();
	await expect.poll(() => intercepted).toBe(true);
	await page.locator('a#general').click();
	const initialized = page.waitForResponse(
		(response) => new URL(response.url()).pathname === '/api/models/base'
	);
	release();
	await page.unrouteAll({ behavior: 'wait' });
	await (await initialized).finished();
	await expect.poll(count).toBe(baseline);
	expect(errors).toEqual([]);
});
