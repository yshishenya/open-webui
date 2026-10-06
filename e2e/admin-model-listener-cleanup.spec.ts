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
	const headers = { Authorization: `Bearer ${admin.token}` };
	const settingsResponse = await request.get('/api/v1/users/user/settings', { headers });
	expect(settingsResponse.ok()).toBe(true);
	const settings = (await settingsResponse.json()) as {
		ui?: Record<string, unknown>;
	} | null;
	const prepared = await request.post('/api/v1/users/user/settings/update', {
		headers,
		data: { ...settings, ui: { ...settings?.ui, showChangelog: false } }
	});
	expect(prepared.ok()).toBe(true);
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
			Object.defineProperty(window, '__airisModifierListenerCount', {
				get: (): number => (listeners.get('keyup')?.size ?? 0) + (listeners.get('blur')?.size ?? 0)
			});
			Object.defineProperty(window, '__airisListenerCount', {
				get: (): number => [...listeners.values()].reduce((sum, set) => sum + set.size, 0)
			});
		},
		{ token: admin.token }
	);
	const count = async (): Promise<number> =>
		page.evaluate(() => (window as Window & { __airisListenerCount: number }).__airisListenerCount);
	const modifierCount = async (): Promise<number> =>
		page.evaluate(
			() =>
				(window as Window & { __airisModifierListenerCount: number }).__airisModifierListenerCount
		);
	await page.goto('/?settings=admin%3Ageneral');
	const modelsTab = page.locator('[role="tab"][aria-controls="tab-admin-models"]');
	const generalTab = page.locator('[role="tab"][aria-controls="tab-admin-general"]');
	await expect(modelsTab).toBeVisible();
	await expect(page.locator('#chat-input')).toHaveCount(1);
	const baseline = await count();
	const modifierBaseline = await modifierCount();
	for (let visit = 0; visit < 3; visit++) {
		await modelsTab.click();
		await expect(page.locator('[id="model-item-gpt-5.6-luna"]')).toBeVisible();
		await expect.poll(modifierCount).toBe(modifierBaseline + 2);
		await expect.poll(count).toBeGreaterThanOrEqual(baseline + 3);
		await generalTab.click();
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
	await modelsTab.click();
	await expect.poll(() => intercepted).toBe(true);
	await generalTab.click();
	const initialized = page.waitForResponse(
		(response) => new URL(response.url()).pathname === '/api/models/base'
	);
	release();
	await page.unrouteAll({ behavior: 'wait' });
	await (await initialized).finished();
	await expect.poll(count).toBe(baseline);
	expect(errors).toEqual([]);
});
