import { expect, test } from '@playwright/test';

// Explicitly mocked local test traffic; no events are sent to external analytics or production.
test('default analytics starts without interaction and an opt-out persists', async ({ page }) => {
	const contexts: Array<Record<string, unknown>> = [];
	const events: Array<Record<string, unknown>> = [];
	let externalLoads = 0;
	await page.context().route('**/mc.yandex.ru/**', async (route) => {
		externalLoads++;
		await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
	});
	await page.context().route('**/api/v1/analytics/context', async (route) => {
		contexts.push(route.request().postDataJSON());
		await route.fulfill({
			json: {
				analytics_user_id: 'test-opaque',
				first_prompt_at: null,
				first_response_at: null,
				server_payment_tracking: true
			}
		});
	});
	await page.context().route('**/api/v1/analytics/events', async (route) => {
		events.push(route.request().postDataJSON());
		await route.fulfill({ json: { accepted: true } });
	});
	await page.goto('/welcome?utm_source=consent-test&token=must-not-leak');
	const consent = page.getByRole('dialog', { name: 'Настройки аналитики' });
	await expect(consent).toBeVisible();
	await expect(consent).toContainText('Аналитика включена по умолчанию');
	await expect
		.poll(() => events.some((event) => event.event_name === 'product_first_visit'))
		.toBe(true);
	await expect.poll(() => externalLoads).toBe(1);
	await consent.getByRole('button', { name: 'Понятно', exact: true }).click();
	await expect(consent).not.toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('airis.analytics.consent.v1'))).toBeNull();
	expect(JSON.stringify(contexts)).not.toContain('must-not-leak');
	expect(contexts[0].first_touch).toMatchObject({ utm_source: 'consent-test' });
	await expect
		.poll(async () => {
			try {
				await page.evaluate(() => window.dispatchEvent(new Event('airis:analytics-settings-open')));
				return true;
			} catch {
				return false;
			}
		})
		.toBe(true);
	const otherTab = await page.context().newPage();
	await otherTab.goto('/welcome');
	const otherSettings = otherTab.getByRole('dialog', { name: 'Настройки аналитики' });
	await expect
		.poll(async () => {
			await otherTab.evaluate(() =>
				window.dispatchEvent(new Event('airis:analytics-settings-open'))
			);
			return otherSettings.isVisible();
		})
		.toBe(true);
	await otherSettings.getByRole('button', { name: 'Запретить', exact: true }).click();
	await expect.poll(() => contexts.some((context) => context.consent === 'denied')).toBe(true);
	await expect
		.poll(async () =>
			page
				.evaluate(() => localStorage.getItem('airis.analytics.funnel.v1'))
				.catch(() => 'navigation')
		)
		.toBeNull();
	await expect
		.poll(async () =>
			page
				.evaluate(() => localStorage.getItem('airis.analytics.consent.v1'))
				.catch(() => 'navigation')
		)
		.toBe('denied');
	const count = events.length;
	await page.goto('/welcome');
	await expect(page.getByRole('heading').first()).toBeVisible();
	expect(events).toHaveLength(count);
	const blockedLoads = externalLoads;
	await page.reload();
	await expect(page.getByRole('heading').first()).toBeVisible();
	expect(externalLoads).toBe(blockedLoads);
});

for (const failure of ['all-writes', 'revoke-marker-and-offline'] as const) {
	test(`${failure}: a failed storage write preserves the refusal and server revoke retry`, async ({
		page
	}) => {
		const contexts: Array<Record<string, unknown>> = [];
		await page.route('**/mc.yandex.ru/**', (route) =>
			route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
		);
		await page.route('**/api/v1/analytics/context', async (route) => {
			const body = route.request().postDataJSON();
			contexts.push(body);
			if (
				failure === 'revoke-marker-and-offline' &&
				body.consent === 'denied' &&
				contexts.filter((item) => item.consent === 'denied').length === 1
			) {
				await route.abort('failed');
				return;
			}
			await route.fulfill({
				json: { analytics_user_id: 'test-opaque', server_payment_tracking: true }
			});
		});
		await page.route('**/api/v1/analytics/events', (route) =>
			route.fulfill({ json: { accepted: true } })
		);
		await page.goto('/welcome');
		const settings = page.getByRole('dialog', { name: 'Настройки аналитики' });
		await expect(settings).toBeVisible();
		await expect.poll(() => contexts.some((context) => context.consent === 'granted')).toBe(true);
		await page.evaluate((failure) => {
			const original = Storage.prototype.setItem;
			let fail = true;
			Storage.prototype.setItem = function (key, value) {
				if (
					fail &&
					((failure === 'all-writes' && key === 'airis.analytics.consent.v1') ||
						key === 'airis.analytics.revoke.v1')
				)
					throw new DOMException('storage is full', 'QuotaExceededError');
				return original.call(this, key, value);
			};
			window.addEventListener('test:restore-storage', () => {
				fail = false;
			});
		}, failure);
		let navigations = 0;
		page.on('framenavigated', (frame) => {
			if (frame === page.mainFrame()) navigations++;
		});
		await settings.getByRole('button', { name: 'Запретить', exact: true }).click();
		await expect.poll(() => contexts.some((context) => context.consent === 'denied')).toBe(true);
		await expect(settings).toContainText(
			failure === 'all-writes'
				? 'запрет не удалось сохранить'
				: 'Не удалось подтвердить отзыв на сервере'
		);
		expect(navigations).toBe(0);
		expect(await page.evaluate(() => localStorage.getItem('airis.analytics.consent.v1'))).toBe(
			failure === 'all-writes' ? null : 'denied'
		);
		await page.evaluate(() => window.dispatchEvent(new Event('test:restore-storage')));
		await settings.getByRole('button', { name: 'Запретить', exact: true }).click();
		await expect.poll(() => navigations).toBe(1);
		await expect
			.poll(async () =>
				page.evaluate(() => localStorage.getItem('airis.analytics.consent.v1')).catch(() => null)
			)
			.toBe('denied');
		if (failure === 'revoke-marker-and-offline') {
			const denials = contexts.filter((item) => item.consent === 'denied');
			expect(denials).toHaveLength(2);
			expect(denials[1].anonymous_id).toBe(denials[0].anonymous_id);
		}
	});
}

for (const mode of ['saved-denial', 'pending-revoke'] as const) {
	test(`${mode} blocks default collection and can be explicitly enabled again`, async ({
		page
	}) => {
		let providerLoads = 0;
		const contexts: Array<Record<string, unknown>> = [];
		await page.addInitScript((mode) => {
			localStorage.setItem(
				'airis.analytics.consent.v1',
				mode === 'saved-denial' ? 'denied' : 'granted'
			);
			if (mode === 'pending-revoke')
				localStorage.setItem('airis.analytics.revoke.v1', '11111111-1111-4111-8111-111111111111');
		}, mode);
		await page.route('**/mc.yandex.ru/**', async (route) => {
			providerLoads++;
			await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
		});
		await page.route('**/api/v1/analytics/context', async (route) => {
			contexts.push(route.request().postDataJSON());
			await route.fulfill({
				json: { analytics_user_id: 'test-opaque', server_payment_tracking: true }
			});
		});
		await page.route('**/api/v1/analytics/events', (route) =>
			route.fulfill({ json: { accepted: true } })
		);
		await page.goto('/welcome');
		await expect(page.getByRole('heading').first()).toBeVisible();
		expect(providerLoads).toBe(0);
		expect(contexts).toHaveLength(0);
		expect(await page.evaluate(() => localStorage.getItem('airis.analytics.funnel.v1'))).toBeNull();
		const settings = page.getByRole('dialog', { name: 'Настройки аналитики' });
		await expect
			.poll(async () => {
				await page.evaluate(() => window.dispatchEvent(new Event('airis:analytics-settings-open')));
				return settings.isVisible();
			})
			.toBe(true);
		expect(providerLoads).toBe(0);
		expect(contexts).toHaveLength(0);
		await settings.getByRole('button', { name: 'Разрешить', exact: true }).click();
		await expect.poll(() => contexts.some((context) => context.consent === 'granted')).toBe(true);
		await expect.poll(() => providerLoads).toBe(1);
		if (mode === 'pending-revoke') expect(contexts[0].consent).toBe('denied');
	});
}
