import { test, expect, request, type Page } from '@playwright/test';

// Read-only browser fixtures against disposable local accounts. No provider payment is created.
test.use({ timezoneId: 'America/Los_Angeles' });
let token = '';
const apiURL = process.env.ANALYTICS_TEST_API_URL || 'http://localhost:8194';
const balance = {
	balance_topup_kopeks: 25000,
	balance_included_kopeks: 0,
	max_reply_cost_kopeks: 1000,
	daily_cap_kopeks: null,
	daily_spent_kopeks: 200,
	daily_reserved_kopeks: 0,
	auto_topup_enabled: false,
	auto_topup_threshold_kopeks: 5000,
	auto_topup_amount_kopeks: 50000,
	currency: 'RUB'
};
const period = { currency: 'RUB', topup_kopeks: 50000, spent_kopeks: 1000, refund_kopeks: 0 };
test.beforeAll(async () => {
	const api = await request.newContext({ baseURL: apiURL });
	const response = await api.post('/api/v1/auths/signin', {
		data: { email: 'analytics-ui-user@example.com', password: 'local-test-only' }
	});
	expect(response.ok()).toBe(true);
	token = ((await response.json()) as { token: string }).token;
	await api.dispose();
});
async function setup(page: Page): Promise<void> {
	await page.addInitScript((token) => {
		localStorage.setItem('token', token);
		localStorage.setItem('locale', 'ru-RU');
		localStorage.setItem('airis.analytics.consent.v1', 'denied');
		localStorage.setItem('settings', JSON.stringify({ version: '0.11.0' }));
	}, token);
	await page.route('**/mc.yandex.ru/**', (route) => route.abort());
	await page.route('**/api/v1/legal/status', (route) =>
		route.fulfill({ json: { needs_accept: false, docs: [], accepted: {} } })
	);
	await page.route('**/api/v1/users/user/settings', (route) =>
		route.fulfill({ json: { ui: { version: '0.11.0' } } })
	);
	await page.route('**/api/v1/users/user/info', (route) =>
		route.fulfill({
			json: { billing_contact_email: 'local@example.com', billing_contact_phone: '' }
		})
	);
	await page.route('**/api/v1/billing/balance', (route) => route.fulfill({ json: balance }));
	await page.route('**/api/v1/billing/lead-magnet', (route) =>
		route.fulfill({ json: { enabled: false } })
	);
	await page.route('**/api/v1/billing/public/pricing-config', (route) =>
		route.fulfill({ json: { topup_amounts_rub: [500, 1000, 2000] } })
	);
	await page.route('**/api/v1/billing/ledger?*', (route) => route.fulfill({ json: [] }));
	await page.route('**/api/v1/billing/usage-events?*', (route) => route.fulfill({ json: [] }));
	await page.route('**/api/v1/billing/refunds?*', (route) =>
		route.fulfill({ json: { items: [], total: 0 } })
	);
	await page.route('**/api/v1/billing/summary?*', (route) => route.fulfill({ json: period }));
	await page.route('**/api/v1/billing/topup', (route) => route.abort());
}

test('saved limits use the sent snapshot while a later edit stays unsaved; malformed money never reaches the API', async ({
	page
}) => {
	await setup(page);
	const posted: Record<string, unknown>[] = [];
	let release: () => void = () => {};
	await page.route('**/api/v1/billing/settings', async (route) => {
		posted.push(route.request().postDataJSON());
		await new Promise<void>((resolve) => {
			release = resolve;
		});
		await route.fulfill({ json: { status: 'ok' } });
	});
	await page.goto('/billing/balance?focus=limits');
	const input = page.locator('input[name=max_reply_cost]');
	await expect(input).toBeVisible();
	await input.fill('12abc');
	await page.getByRole('button', { name: 'Сохранить ограничения', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Введите сумму от нуля');
	expect(posted).toHaveLength(0);
	await input.fill('20');
	await page.getByRole('button', { name: 'Сохранить ограничения', exact: true }).click();
	await expect.poll(() => posted.length).toBe(1);
	await input.fill('30');
	release();
	await expect(
		page.getByRole('button', { name: 'Сохранить ограничения', exact: true })
	).toBeEnabled();
	expect(posted[0].max_reply_cost_kopeks).toBe(2000);
	await expect(input).toHaveValue('30');
	await expect(page.getByText('Настройки биллинга сохранены', { exact: true })).not.toBeVisible();
});

for (const [provider, credited, label] of [
	['pending', false, 'Ожидаем подтверждение оплаты'],
	['succeeded', false, 'Оплата подтверждена. Ожидаем зачисление на баланс.'],
	['canceled', false, 'Оплата отменена. Баланс не пополнен.'],
	['succeeded', true, 'Пополнение успешно']
] as const)
	test(`return from payment preserves provider=${provider} and credited=${credited}`, async ({
		page
	}) => {
		await setup(page);
		await page.addInitScript(() =>
			localStorage.setItem(
				'billing_topup_flow_v1',
				JSON.stringify({
					started_at_ms: Date.now(),
					amount_kopeks: 50000,
					previous_total_kopeks: 25000,
					payment_id: 'local-payment',
					return_to: '/c/local'
				})
			)
		);
		await page.route('**/api/v1/billing/topup/reconcile', (route) =>
			route.fulfill({ json: { payment_id: 'local-payment', provider_status: provider, credited } })
		);
		await page.goto('/billing/balance?topup_return=1');
		await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 15000 });
		if (!credited)
			await expect(page.getByText('Пополнение успешно', { exact: true })).not.toBeVisible();
	});

test('operations load the complete period, deduplicate shifted pages and group in UTC', async ({
	page
}) => {
	await setup(page);
	const before = Date.parse('2026-10-02T23:50:00Z') / 1000;
	const after = Date.parse('2026-10-03T00:10:00Z') / 1000;
	const entry = (id: string, time: number) => ({
		id,
		user_id: 'u',
		wallet_id: 'w',
		type: 'topup',
		amount_kopeks: 1000,
		currency: 'RUB',
		created_at: time,
		reference_id: id,
		balance_topup_after: 1000,
		balance_included_after: 0
	});
	const entries = Array.from({ length: 20 }, (_, i) => entry('first-' + i, after));
	const skips: number[] = [];
	await page.route('**/api/v1/billing/ledger?*', (route) => {
		const skip = Number(new URL(route.request().url()).searchParams.get('skip'));
		skips.push(skip);
		return route.fulfill({
			json: skip === 0 ? entries : [entries[19], entry('utc-before', before)]
		});
	});
	await page.goto('/billing/history?from_date=2026-10-02&to_date=2026-10-03');
	await expect(page.getByTestId('timeline-item')).toHaveCount(20);
	await page.getByRole('button', { name: 'Загрузить еще', exact: true }).click();
	await expect(page.getByTestId('timeline-item')).toHaveCount(21);
	await expect(page.getByRole('heading', { name: /2 октября 2026/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: /3 октября 2026/ })).toBeVisible();
	expect(skips).toEqual([0, 20]);
});

test('a timed-out period report becomes a retryable error instead of a zero total', async ({
	page
}) => {
	await setup(page);
	await page.unroute('**/api/v1/billing/summary?*');
	await page.route('**/api/v1/billing/summary?*', (route) => route.abort('timedout'));
	await page.goto('/billing/balance');
	await expect(page.getByRole('alert')).toContainText(
		'Не удалось загрузить итог за выбранные даты'
	);
	await expect(
		page.getByRole('button', { name: 'Показать за эти даты', exact: true })
	).toBeEnabled();
});

test('cost calculator recovers rates, reacts to model/chat scenario, and preserves period when opening operations', async ({
	page
}) => {
	await setup(page);
	let failRates = true;
	await page.route('**/api/v1/billing/public/rate-cards', (route) =>
		failRates
			? route.fulfill({ status: 503, json: { detail: 'local fixture unavailable' } })
			: route.fulfill({
					json: {
						currency: 'RUB',
						updated_at: '2026-10-04',
						models: [
							{
								id: 'cheap',
								display_name: 'Cheap',
								capabilities: ['text'],
								rates: { text_in_1000_tokens: 100, text_out_1000_tokens: 100 }
							},
							{
								id: 'premium',
								display_name: 'Premium',
								capabilities: ['text'],
								rates: { text_in_1000_tokens: 1000, text_out_1000_tokens: 1000 }
							}
						]
					}
				})
	);
	await page.goto('/billing/cost?from_date=2026-10-02&to_date=2026-10-03&return_to=%2Fc%2Flocal');
	await expect(page.getByRole('alert')).toContainText('Не удалось загрузить');
	failRates = false;
	await page.getByRole('alert').getByRole('button').click();
	const panel = page.locator('#estimator-panel-text');
	await expect(panel).toBeVisible();
	const cost = async (): Promise<number> => {
		const text = await panel.locator('.tabular-nums').innerText();
		const match = text.match(/≈\s*([\d\s,.]+)/);
		return Number(match?.[1].replace(/\s/g, '').replace(',', '.'));
	};
	const modelSelect = panel.getByRole('combobox').first();
	await modelSelect.selectOption('cheap');
	const cheapCost = await cost();
	expect(cheapCost).toBeGreaterThan(0);
	await modelSelect.selectOption('premium');
	await expect.poll(cost).toBeGreaterThan(cheapCost);
	const premiumCost = await cost();
	await panel.getByRole('combobox').nth(1).selectOption('continuous');
	await expect.poll(cost).toBeGreaterThan(premiumCost);
	await page.getByRole('link', { name: 'Посмотреть операции', exact: true }).click();
	await expect(page).toHaveURL(/\/billing\/history/);
	const params = new URL(page.url()).searchParams;
	expect(params.get('from_date')).toBe('2026-10-02');
	expect(params.get('to_date')).toBe('2026-10-03');
	expect(params.get('return_to')).toBe('/c/local');
	await expect(page.locator('input[type=date]').first()).toHaveValue('2026-10-02');
	await expect(page.locator('input[type=date]').nth(1)).toHaveValue('2026-10-03');
});
