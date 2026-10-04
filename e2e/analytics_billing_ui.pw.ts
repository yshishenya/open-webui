import { test, expect, request, type Page } from '@playwright/test';

// A disposable local app and local accounts only. Provider requests stay blocked.
let adminToken = '';
let ordinaryToken = '';
const apiURL = process.env.ANALYTICS_TEST_API_URL || 'http://localhost:8194';
const dates = '?from=2026-09-01&to=2026-09-30&window_days=7';
const summary = {
	visitors: 100,
	registered: 80,
	activated: 60,
	paid: 25,
	repeated: 3,
	mature_visitors: 80,
	mature_paid: 20,
	immature_visitors: 20,
	conversion_percent: 25,
	next_maturity_at: 1791331200
};
const sequence = {
	visitors: 100,
	registered: 80,
	responded: 60,
	paid_after_response: 15,
	paid_before_response: 5,
	paid_without_observed_response: 4,
	incomplete_paid: 1,
	mature_visitors: 80,
	mature_registered: 65,
	mature_responded: 45,
	mature_paid_after_response: 12,
	mature_paid_before_response: 4,
	mature_paid_without_observed_response: 3,
	mature_incomplete_paid: 1
};
const funnel = {
	generated_at: 1791072000,
	summary,
	sequence,
	rows: [{ ...summary, cohort: 'unknown', median_hours_to_pay: 2 }],
	financial: {
		RUB: { confirmed_payments: 2, gross_kopeks: 100050, refund_kopeks: 19900, net_kopeks: 80150 }
	},
	payment_funnel: { created: 3, confirmed: 2, conversion_percent: 66.67 },
	coverage: { consented_identities: 100, linked_accounts: 80 },
	delivery: [],
	events: {}
};

test.beforeAll(async () => {
	if (
		!['localhost', '127.0.0.1', 'host.docker.internal', 'airis-e2e'].includes(
			new URL(apiURL).hostname
		)
	)
		throw new Error('Analytics UI fixtures require a disposable local app');
	const api = await request.newContext({ baseURL: apiURL });
	for (const [name, email] of [
		['Admin UI', 'analytics-ui-admin@example.com'],
		['Ordinary UI', 'analytics-ui-user@example.com']
	]) {
		await api.post('/api/v1/auths/signup', {
			data: {
				name,
				email,
				password: 'local-test-only',
				terms_accepted: true,
				privacy_accepted: true
			}
		});
		const response = await api.post('/api/v1/auths/signin', {
			data: { email, password: 'local-test-only' }
		});
		expect(response.ok()).toBe(true);
		const account = (await response.json()) as { token: string; role: string };
		if (name === 'Admin UI') {
			expect(account.role).toBe('admin');
			adminToken = account.token;
			const headers = { Authorization: `Bearer ${adminToken}` };
			const config = await api.get('/api/v1/auths/admin/config', { headers });
			expect(config.ok()).toBe(true);
			await api.post('/api/v1/auths/admin/config', {
				headers,
				data: { ...(await config.json()), ENABLE_SIGNUP: true, DEFAULT_USER_ROLE: 'user' }
			});
		} else {
			expect(account.role).toBe('user');
			ordinaryToken = account.token;
		}
	}
	await api.dispose();
});

async function setup(page: Page, token = adminToken): Promise<void> {
	await page.addInitScript((token) => {
		localStorage.setItem('token', token);
		localStorage.setItem('locale', 'ru-RU');
		localStorage.setItem('airis.analytics.consent.v1', 'denied');
		localStorage.setItem('settings', JSON.stringify({ version: '0.11.0' }));
	}, token);
	await page.route('**/mc.yandex.ru/**', (route) => route.abort());
	await page.route('**/api/v1/users/user/settings', (route) =>
		route.fulfill({ json: { ui: { version: '0.11.0' } } })
	);
	await page.route('**/api/v1/legal/status', (route) =>
		route.fulfill({ json: { needs_accept: false, docs: [], accepted: {} } })
	);
}

test('funnel separates ordered paths, overall payments and immature observations; navigation keeps dates', async ({
	page
}) => {
	await setup(page);
	await page.route('**/api/v1/analytics/funnel-report?*', (route) =>
		route.fulfill({ json: funnel })
	);
	await page.goto(`/admin/analytics/funnel${dates}`);
	await expect(page.getByTestId('product-funnel')).toBeVisible();
	await expect(page.getByText('25% · 20 из 80', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('Ещё наблюдаем: 20', { exact: true }).first()).toBeVisible();
	await page
		.getByText('Последовательность событий для завершённых наблюдений', { exact: true })
		.click();
	await expect(page.getByText('Пополнили до первого ответа:')).toContainText('4');
	await expect(page.getByText('Пополнили, но ответ не наблюдается:')).toContainText('3');
	await expect(page.getByRole('rowheader').filter({ hasText: 'Не определён' })).toBeVisible();
	await page.getByRole('link', { name: 'Деньги', exact: true }).last().click();
	await expect(page).not.toHaveURL(/from(?:_date)?=2026-09-01/);
});

test('funnel preserves distinct group paths and opens lifetime diagnostics from overview', async ({
	page
}) => {
	await setup(page);
	await page.route('**/api/v1/analytics/funnel-report?*', (route) =>
		route.fulfill({
			json: {
				...funnel,
				rows: [1, 3].map((paid, index) => ({
					...summary,
					cohort: `Источник ${index + 1}`,
					median_hours_to_pay: null,
					sequence: { ...sequence, mature_responded: 4, mature_paid_after_response: paid }
				})),
				delivery: [{ destination: 'posthog', state: 'failed', count: 2 }]
			}
		})
	);
	await page.goto(`/admin/analytics/funnel${dates}&breakdown=utm_source`);
	const rows = page.getByRole('row').filter({ has: page.getByRole('rowheader') });
	for (const [index, paid] of [1, 3].entries()) {
		const row = rows.nth(index);
		await row.getByText('Подробности', { exact: true }).click();
		await expect(
			row.getByText('Первое пополнение после ответа', { exact: true }).locator('..')
		).toContainText(String(paid));
		await expect(
			row.getByText('Следующий шаг не наблюдается:', { exact: false }).last()
		).toContainText(String(4 - paid));
	}
	await page.getByRole('link', { name: 'Обзор продукта', exact: true }).last().click();
	await expect(page.getByRole('heading', { name: 'Требует внимания' })).toBeVisible();
	await page.getByRole('link', { name: 'Проверить отправку' }).click();
	await expect(page.locator('#funnel-methodology')).toHaveAttribute('open', '');
	await expect(page.locator('#data-quality')).toHaveAttribute('open', '');
	await expect(
		page.getByText('Это передача событий во внешнюю аналитику, не доставка писем.')
	).toBeVisible();
});

test('a failed report and a still immature report do not show zero conversion', async ({
	page
}) => {
	await setup(page);
	await page.route('**/api/v1/analytics/funnel-report?*', (route) =>
		route.fulfill({ status: 503, json: { detail: 'unavailable' } })
	);
	await page.goto(`/admin/analytics${dates}`);
	await expect(page.getByRole('alert')).toContainText('Не удалось загрузить отчёт');
	await expect(page.getByText('0%')).not.toBeVisible();
	await page.unroute('**/api/v1/analytics/funnel-report?*');
	await page.route('**/api/v1/analytics/funnel-report?*', (route) =>
		route.fulfill({
			json: {
				...funnel,
				summary: { ...summary, mature_visitors: 0, mature_paid: 0, conversion_percent: null },
				sequence: Object.fromEntries(
					Object.entries(sequence).map(([key, value]) => [
						key,
						key.startsWith('mature_') ? 0 : value
					])
				)
			}
		})
	);
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect(
		page.getByText('Результат за 7 дней пока недоступен', { exact: true })
	).toBeVisible();
});

test('funnel applies drafts explicitly, refreshes applied dates and restores browser history', async ({
	page
}) => {
	await setup(page);
	const queries: URL[] = [];
	await page.route('**/api/v1/analytics/funnel-report?*', (route) => {
		queries.push(new URL(route.request().url()));
		return route.fulfill({ json: funnel });
	});
	await page.goto(`/admin/analytics/funnel${dates}`);
	await expect(page.getByText('Данные сформированы')).toBeVisible();
	await page.getByLabel('Первый визит с', { exact: true }).fill('2026-09-02');
	await expect(page.getByText('Изменения не применены')).toBeVisible();
	expect(queries).toHaveLength(1);
	await page.getByRole('button', { name: 'Обновить', exact: true }).click();
	await expect.poll(() => queries.length).toBe(2);
	expect(queries[1].searchParams.get('start')).toBe(
		String(Date.parse('2026-09-01T00:00:00Z') / 1000)
	);
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect(page).toHaveURL(/from=2026-09-02/);
	await page.goBack();
	await expect(page.getByLabel('Первый визит с', { exact: true })).toHaveValue('2026-09-01');
	await expect(page.getByText('Первые визиты:')).toContainText('2026-09-01');
});

test('funnel keeps the last report on a failed update and opens methodology', async ({ page }) => {
	await setup(page);
	let fail = false;
	await page.route('**/api/v1/analytics/funnel-report?*', (route) =>
		fail ? route.fulfill({ status: 503 }) : route.fulfill({ json: funnel })
	);
	await page.goto(`/admin/analytics/funnel${dates}`);
	await expect(page.getByText('Данные сформированы')).toBeVisible();
	fail = true;
	await page.getByRole('button', { name: 'Обновить', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Сохранён предыдущий отчёт');
	await expect(page.getByText('25% · 20 из 80', { exact: true }).first()).toBeVisible();
	await page.getByRole('link', { name: 'Как считаем', exact: true }).click();
	await expect(page.getByText('Исключения в выбранном отчёте', { exact: true })).toBeVisible();
	fail = false;
	await page.getByRole('button', { name: 'Повторить', exact: true }).click();
	await expect(page.getByRole('alert')).not.toBeVisible();
});

for (const width of [360, 768, 1280])
	for (const theme of ['light', 'dark']) {
		test(`funnel accessible comparison at ${width}px in ${theme}`, async ({ page }) => {
			await setup(page);
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme);
			await page.route('**/api/v1/analytics/funnel-report?*', (route) =>
				route.fulfill({ json: funnel })
			);
			await page.goto(`/admin/analytics/funnel${dates}`);
			if (theme === 'dark')
				await expect(page.locator('input[type=date]').first()).toHaveCSS('color-scheme', 'dark');
			await expect(
				page.getByRole('heading', { name: 'Сравнение групп', exact: true })
			).toBeVisible();
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
			).toBe(true);
			const table = page.getByRole('region', { name: 'Таблица сравнения групп' });
			await table.focus();
			await expect(table).toBeFocused();
			if (width === 360) {
				await table.press('ArrowRight');
				await expect.poll(() => table.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
			}
			await page
				.getByRole('heading', { name: 'От первого визита до пополнения баланса', exact: true })
				.scrollIntoViewIfNeeded();
			await page.screenshot({
				path: `output/playwright/funnel-${width}-${theme}.png`,
				fullPage: true
			});
		});
	}

test('model detail inherits dates and group; keyboard sorting and detail opening work', async ({
	page
}) => {
	await setup(page);
	const queries: URL[] = [];
	await page.route('**/api/v1/analytics/**', async (route) => {
		const url = new URL(route.request().url());
		queries.push(url);
		const response = url.pathname.endsWith('/summary')
			? { total_messages: 3, total_chats: 2, total_models: 1, total_users: 1 }
			: url.pathname.endsWith('/models')
				? { models: [{ model_id: 'demo', count: 3, unique_users: 1, unique_chats: 2 }] }
				: url.pathname.endsWith('/users')
					? {
							users: [
								{ user_id: 'demo-user', name: 'Тестовый клиент', count: 3, total_tokens: 100 }
							]
						}
					: url.pathname.endsWith('/daily')
						? { data: [{ date: '2026-09-01', models: { demo: 3 } }] }
						: url.pathname.endsWith('/tokens')
							? { models: [{ model_id: 'demo', total_tokens: 100 }], total_tokens: 100 }
							: { history: [], tags: [] };
		await route.fulfill({ json: response });
	});
	await page.route('**/api/v1/groups/*', (route) =>
		route.fulfill({ json: [{ id: 'group-demo', name: 'Тестовая группа' }] })
	);
	await page.goto(`/admin/analytics/models${dates}&group_id=group-demo`);
	await expect(page.getByTestId('model-usage')).toContainText('Сохранённых ответов');
	await expect(page.getByRole('button', { name: 'demo', exact: true })).toBeVisible();
	await page.getByRole('button', { name: /^Модель/ }).press('Enter');
	await page.getByRole('button', { name: 'demo', exact: true }).press('Enter');
	await expect(page.getByText('Период исходного отчёта:')).toContainText('2026-09-01 — 2026-09-30');
	await expect.poll(() => queries.some((url) => url.pathname.endsWith('/overview'))).toBe(true);
	const detail = queries.find((url) => url.pathname.endsWith('/overview'))!;
	expect(detail.searchParams.get('group_id')).toBe('group-demo');
	expect(detail.searchParams.get('start_date')).toBe(
		String(Date.parse('2026-09-01T00:00:00Z') / 1000)
	);
	expect(detail.searchParams.get('end_date')).toBe(
		String(Date.parse('2026-10-01T00:00:00Z') / 1000)
	);
	const dialog = page.getByRole('dialog', { name: 'Использование модели: demo' });
	await expect(dialog).toBeVisible();
	for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
		await page.keyboard.press(key);
		expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
	}
	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole('button', { name: 'demo', exact: true })).toBeFocused();
});

test('money cards open the matching credited payments and refunds for the same dates', async ({
	page
}) => {
	await setup(page);
	await page.route('**/api/v1/admin/billing/reporting/overview?*', (route) =>
		route.fulfill({
			json: {
				currency: 'RUB',
				from: Date.parse('2026-09-01T18:00:00Z') / 1000,
				to: Date.parse('2026-09-03T01:00:00Z') / 1000,
				as_of: 1791072000,
				metrics: {
					successful_payments_kopeks: 100050,
					refund_kopeks: 19900,
					net_kopeks: 80150,
					usage_spend_kopeks: 1234,
					payer_count: 2,
					paid_balance_kopeks: 30000,
					included_balance_kopeks: 0
				},
				warnings: {},
				series: [
					{ date: '2026-09-01', paid_kopeks: 100050, refund_kopeks: 19900, usage_kopeks: 1234 }
				],
				definitions: {}
			}
		})
	);
	const queries: URL[] = [];
	await page.route('**/api/v1/admin/billing/reporting/payments?*', (route) => {
		queries.push(new URL(route.request().url()));
		return route.fulfill({
			json: {
				items: [],
				total: 0,
				total_pages: 1,
				page: 1,
				page_size: 50,
				as_of: 1791072000,
				currency: 'RUB'
			}
		});
	});
	await page.goto(`/admin/billing${dates}`);
	await expect(page.getByRole('img', { name: 'Пополнения и возвраты по дням' })).toBeVisible();
	const moneyChart = page.getByRole('img', { name: 'Пополнения и возвраты по дням' });
	// Partial UTC days and a missing day must still produce all three calendar points.
	expect((await moneyChart.locator('path').first().getAttribute('d'))?.split('L')).toHaveLength(3);
	await moneyChart.hover({ position: { x: 5, y: 50 } });
	await expect(moneyChart.locator('..')).toContainText('1');
	await expect(moneyChart.locator('..')).toContainText('₽');
	await expect(moneyChart.locator('..')).not.toContainText('%');
	await page.getByRole('link').filter({ hasText: 'Зачисленные пополнения' }).click();
	await expect.poll(() => queries.length).toBeGreaterThan(0);
	const url = queries.at(-1)!;
	for (const [key, value] of Object.entries({
		kind: 'topup',
		status: 'succeeded',
		credit_status: 'credited',
		is_test: 'false',
		from: String(Date.parse('2026-09-01T00:00:00Z') / 1000),
		to: String(Date.parse('2026-10-01T00:00:00Z') / 1000)
	}))
		expect(url.searchParams.get(key)).toBe(value);
	await expect(page.getByText('За этот период операций нет', { exact: true })).toBeVisible();
	await page.goto(`/admin/billing${dates}`);
	await page.getByRole('link').filter({ hasText: 'Возвращено пользователям' }).click();
	await expect(page).toHaveURL(/tab=refunds/);
	await expect(page.locator('input[type=date]').first()).toHaveValue('2026-09-01');
});

for (const width of [360, 390, 768, 1280])
	for (const theme of ['light', 'dark']) {
		test(`report pages at ${width}px in ${theme}`, async ({ page }) => {
			test.setTimeout(120000);
			await setup(page);
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme);
			await page.route('**/api/v1/analytics/funnel-report?*', (route) =>
				route.fulfill({ json: funnel })
			);
			for (const path of [
				'/admin/analytics',
				'/admin/analytics/funnel',
				'/admin/billing',
				'/admin/billing/customers',
				'/admin/billing/transactions',
				'/billing/balance',
				'/billing/history',
				'/billing/settings',
				'/billing/cost',
				'/pricing'
			]) {
				await page.goto(path);
				await expect(page.getByRole('heading').first(), path).toBeVisible({ timeout: 15000 });
				await expect
					.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
					.toBe(true);
				if (path === '/admin/billing') {
					const ratio = await page
						.getByRole('link')
						.filter({ hasText: 'Зачисленные пополнения' })
						.locator('div')
						.first()
						.evaluate((element) => {
							const canvas = document.createElement('canvas');
							canvas.width = canvas.height = 1;
							const context = canvas.getContext('2d')!;
							const luminance = (color: string): number => {
								context.clearRect(0, 0, 1, 1);
								context.fillStyle = color;
								context.fillRect(0, 0, 1, 1);
								return Array.from(context.getImageData(0, 0, 1, 1).data)
									.slice(0, 3)
									.reduce((sum, value, i) => {
										const s = value / 255;
										return (
											sum +
											[0.2126, 0.7152, 0.0722][i] *
												(s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)
										);
									}, 0);
							};
							let parent: Element | null = element;
							let background = 'white';
							while (parent) {
								const color = getComputedStyle(parent).backgroundColor;
								if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
									background = color;
									break;
								}
								parent = parent.parentElement;
							}
							const a = luminance(getComputedStyle(element).color),
								b = luminance(background);
							return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
						});
					expect(ratio, `${width}px ${theme}: money label contrast`).toBeGreaterThanOrEqual(4.5);
				}
				await page.screenshot({
					path: `artifacts/analytics-ui/${width}-${theme}-${path.replaceAll('/', '_')}.png`,
					fullPage: true
				});
			}
		});
	}

test('ordinary account cannot open administrative analytics and money', async ({
	page,
	request
}) => {
	await setup(page, ordinaryToken);
	for (const path of ['/admin/analytics', '/admin/billing']) {
		await page.goto(path);
		await expect(page).not.toHaveURL(new RegExp(`${path}$`));
	}
	for (const path of [
		'/api/v1/analytics/funnel-report',
		'/api/v1/admin/billing/reporting/overview'
	]) {
		const response = await request.get(`${apiURL}${path}`, {
			headers: { Authorization: `Bearer ${ordinaryToken}` }
		});
		expect(response.status()).toBe(401);
	}
});

// Additional page-by-page acceptance uses populated local fixtures; payment/config writes stay blocked.
const acceptancePlan = {
	id: 'acceptance-plan',
	name: 'Acceptance plan',
	name_ru: 'Проверочная подписка',
	description: 'A local UI fixture',
	description_ru: 'Подписка для проверки интерфейса',
	price: 1000,
	currency: 'RUB',
	interval: 'month',
	is_active: true,
	display_order: 0,
	quotas: { tokens_input: 5000, tokens_output: 3000, requests: 100 },
	features: [],
	plan_extra_metadata: {},
	created_at: 1790906400,
	updated_at: 1790906400
};
const acceptancePayment = {
	id: 'local-payment',
	user_id: 'acceptance-customer',
	name: 'Проверочный клиент с длинным именем',
	kind: 'topup',
	status: 'succeeded',
	amount_kopeks: 50000,
	currency: 'RUB',
	provider: 'yookassa',
	provider_payment_id: 'local-only',
	processed_at: 1791072000,
	created_at: 1791071900,
	credited_at: 1791072000,
	credit_status: 'credited',
	is_test: false,
	refunded_kopeks: 5000,
	source: 'local',
	wallet_id: 'local-wallet',
	subscription_id: null
};
const acceptanceRefund = {
	id: 'local-refund',
	payment_id: 'local-payment',
	user_id: 'acceptance-customer',
	name: acceptancePayment.name,
	amount_kopeks: 5000,
	currency: 'RUB',
	occurred_at: 1791073000,
	wallet_reflection: 'requires_verification'
};
const acceptanceUsage = {
	id: 'local-usage',
	user_id: 'acceptance-customer',
	name: acceptancePayment.name,
	request_id: 'local-request',
	model_id: 'fixture-model',
	modality: 'text',
	billing_source: 'payg',
	cost_charged_kopeks: 1234,
	currency: 'RUB',
	is_estimated: true,
	created_at: 1791072500,
	tokens_input: 100,
	tokens_output: 200
};
async function populatedPages(page: Page): Promise<void> {
	await setup(page);
	await page.route('**/api/v1/admin/billing/**', (route) => {
		if (route.request().method() !== 'GET') return route.abort();
		const url = new URL(route.request().url());
		const envelope = (items: object[]) => ({
			items,
			total: items.length,
			page: 1,
			page_size: 50,
			total_pages: 1,
			currency: 'RUB',
			as_of: 1791074000
		});
		if (url.pathname.includes('/reporting/customers/'))
			return route.fulfill({
				json: {
					user: {
						id: 'acceptance-customer',
						name: acceptancePayment.name,
						email: 'local-only@example.test',
						role: 'user'
					},
					wallet: {
						id: 'local-wallet',
						currency: 'RUB',
						balance_topup_kopeks: 30000,
						balance_included_kopeks: 1000,
						daily_cap_kopeks: null,
						daily_spent_kopeks: 1234
					},
					metrics: {
						period_paid_kopeks: 50000,
						period_refund_kopeks: 5000,
						period_spent_kopeks: 1234,
						paid_kopeks: 60000,
						refund_kopeks: 5000,
						spent_kopeks: 2234
					},
					payments: [],
					ledger: [],
					usage: [],
					from: 1790906400,
					to: 1791074000,
					as_of: 1791074000,
					time_semantics: 'UTC'
				}
			});
		if (url.pathname.endsWith('/reporting/payments'))
			return route.fulfill({ json: envelope([acceptancePayment]) });
		if (url.pathname.endsWith('/reporting/refunds'))
			return route.fulfill({ json: envelope([acceptanceRefund]) });
		if (url.pathname.endsWith('/reporting/usage'))
			return route.fulfill({ json: envelope([acceptanceUsage]) });
		if (url.pathname.endsWith('/subscribers'))
			return route.fulfill({
				json: envelope([
					{
						user_id: 'acceptance-customer',
						name: acceptancePayment.name,
						email: 'local-only@example.test',
						role: 'user',
						subscription_status: 'active',
						subscribed_at: 1790906400,
						current_period_start: 1790906400,
						current_period_end: 1793498400,
						tokens_input_used: 100,
						tokens_input_limit: 5000,
						tokens_output_used: 200,
						tokens_output_limit: 3000,
						requests_used: 3,
						requests_limit: 100
					}
				])
			});
		if (url.pathname.endsWith('/plans/acceptance-plan'))
			return route.fulfill({ json: acceptancePlan });
		if (url.pathname.endsWith('/plans'))
			return route.fulfill({
				json: [
					{
						plan: acceptancePlan,
						active_subscriptions: 1,
						canceled_subscriptions: 0,
						total_subscriptions: 1,
						mrr: 1000
					}
				]
			});
		if (url.pathname.endsWith('/lead-magnet'))
			return route.fulfill({
				json: {
					enabled: true,
					cycle_days: 30,
					quotas: {
						tokens_input: 5000,
						tokens_output: 3000,
						images: 2,
						tts_seconds: 90,
						stt_seconds: 120
					},
					config_version: 1
				}
			});
		if (url.pathname.endsWith('/rate-card'))
			return route.fulfill({
				json: envelope([
					{
						id: 'rate-in',
						model_id: 'fixture-model',
						modality: 'text',
						unit: 'token_in',
						raw_cost_per_unit_kopeks: 0.01,
						version: 'local',
						is_default: true,
						is_active: true
					},
					{
						id: 'rate-out',
						model_id: 'fixture-model',
						modality: 'text',
						unit: 'token_out',
						raw_cost_per_unit_kopeks: 0.02,
						version: 'local',
						is_default: true,
						is_active: true
					}
				])
			});
		return route.continue();
	});
	await page.route('**/api/models**', (route) =>
		route.fulfill({
			json: {
				data: [
					{ id: 'fixture-model', name: 'Проверочная модель', info: { meta: { lead_magnet: true } } }
				]
			}
		})
	);
	await page.route('**/api/v1/models/base?*', (route) =>
		route.fulfill({
			json: [
				{
					id: 'fixture-model',
					name: 'Проверочная модель',
					is_active: true,
					meta: { lead_magnet: true },
					params: {}
				}
			]
		})
	);
	await page.route('**/api/v1/admin/email-observations', (route) =>
		route.request().method() === 'GET'
			? route.fulfill({ json: { items: [], next_cursor: null } })
			: route.abort()
	);
	await page.route('**/api/v1/admin/email-deliveries/cohorts?*', (route) =>
		route.fulfill({
			json: {
				registrations: 12,
				generated_at: 1791074000,
				exclusions: { explicit_test_account: 1 },
				cohorts: [
					{
						date: '2026-10-02',
						registrations: 12,
						first_success_24h: { count: 8, denominator: 10, immature: 2 },
						first_success_7d: { count: 0, denominator: 0, immature: 12 },
						return_7d: { count: 0, denominator: 0, immature: 12 },
						paid_users_14d: { count: 0, denominator: 0, immature: 12 }
					}
				]
			}
		})
	);
}

for (const width of [360, 1280])
	test(`auxiliary analytics and billing pages are readable with populated content at ${width}px`, async ({
		page
	}) => {
		test.setTimeout(120000);
		await populatedPages(page);
		await page.setViewportSize({ width, height: 900 });
		const pages = [
			['/admin/analytics/retention?from=2026-10-02&to=2026-10-03', 'retention'],
			['/admin/analytics/mail', 'mail'],
			['/admin/billing/models', 'models'],
			['/admin/billing/lead-magnet', 'free'],
			['/admin/billing/plans', 'plans'],
			['/admin/billing/plans/new', 'create'],
			['/admin/billing/plans/acceptance-plan/edit', 'edit'],
			['/admin/billing/plans/acceptance-plan/subscribers', 'subscribers'],
			[
				'/admin/billing/customers/acceptance-customer?from_date=2026-10-02&to_date=2026-10-03',
				'customer'
			]
		];
		for (const [path, name] of pages) {
			await page.goto(path);
			await expect(page.locator('h1').first(), path).toBeVisible();
			if (name === 'retention') {
				await expect(page.getByText('80% · 8 из 10', { exact: true })).toBeVisible();
				await expect(page.getByText('Наблюдение продолжается', { exact: true })).toHaveCount(3);
			} else if (name === 'mail')
				await expect(page.getByText('Проверок пока нет.', { exact: true })).toBeVisible();
			else if (name === 'models' || name === 'free')
				await expect(
					page.getByText('Проверочная модель', { exact: true }).filter({ visible: true }).first()
				).toBeVisible();
			else if (name === 'plans')
				await expect(
					page.getByRole('link').filter({ hasText: 'Проверочная подписка', visible: true }).first()
				).toBeVisible();
			else if (name === 'create')
				await expect(page.locator('input[placeholder]').first()).toBeVisible();
			else if (name === 'edit')
				await expect(page.locator('input[placeholder]').first()).toHaveValue(
					'Проверочная подписка'
				);
			else if (name === 'subscribers' || name === 'customer')
				await expect(page.getByText('local-only@example.test', { exact: true })).toBeVisible();
			await expect(page.getByRole('alert'), path).toHaveCount(0);
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), {
					message: path
				})
				.toBe(true);
			await page.screenshot({
				path: `artifacts/analytics-ui/aux-${width}-${name}.png`,
				fullPage: true
			});
		}
	});

test('page template permits browser zoom', async ({ page }) => {
	await setup(page);
	await page.goto('/billing/balance');
	await expect(page.locator('meta[name=viewport]')).not.toHaveAttribute(
		'content',
		/maximum-scale=1(?:,|$)|user-scalable=no/
	);
});

for (const width of [390, 1280])
	test(`all report and billing pages support 200% text at ${width}px`, async ({ page }) => {
		test.setTimeout(120000);
		await populatedPages(page);
		await page.setViewportSize({ width, height: 900 });
		await page.route('**/api/v1/analytics/funnel-report?*', (route) =>
			route.fulfill({ json: funnel })
		);
		for (const path of [
			'/admin/analytics',
			'/admin/analytics/funnel',
			'/admin/analytics/retention',
			'/admin/analytics/models',
			'/admin/analytics/mail',
			'/admin/billing',
			'/admin/billing/customers',
			'/admin/billing/customers/acceptance-customer',
			'/admin/billing/transactions',
			'/admin/billing/models',
			'/admin/billing/lead-magnet',
			'/admin/billing/plans',
			'/admin/billing/plans/new',
			'/admin/billing/plans/acceptance-plan/edit',
			'/admin/billing/plans/acceptance-plan/subscribers',
			'/admin/billing/plans/acceptance-plan/analytics',
			'/billing/balance',
			'/billing/history',
			'/billing/settings',
			'/billing/cost',
			'/pricing'
		]) {
			await page.goto(path);
			await expect(page.getByRole('heading').first(), path).toBeVisible();
			await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
			await expect
				.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
				.toBe('32px');
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), {
					message: path
				})
				.toBe(true);
			await page.screenshot({
				path: `artifacts/analytics-ui/text-200-${width}-${path.replaceAll('/', '_')}.png`,
				fullPage: true
			});
		}
	});

test('populated payment, refund and usage records become labelled mobile cards with details', async ({
	page
}) => {
	await populatedPages(page);
	await page.setViewportSize({ width: 360, height: 900 });
	for (const tab of ['payments', 'refunds', 'usage']) {
		await page.goto(
			`/admin/billing/transactions?tab=${tab}&from_date=2026-10-02&to_date=2026-10-03`
		);
		const record = page.locator('table.reporting-records tbody tr').first();
		await expect(record).toContainText(acceptancePayment.name);
		await expect
			.poll(() => record.evaluate((element) => getComputedStyle(element).display))
			.toBe('block');
		await expect(record.locator('td[data-label]')).toHaveCount(5);
		const amount = tab === 'payments' ? '500' : tab === 'refunds' ? '50' : '12,34';
		await expect(record.locator('td').nth(3)).toContainText(amount);
		await record.locator('summary').click();
		await expect(record.locator('details')).toHaveAttribute('open', '');
		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
			.toBe(true);
		await page.screenshot({
			path: `artifacts/analytics-ui/mobile-populated-${tab}.png`,
			fullPage: true
		});
	}
});

// Final administrative acceptance: use the exact local image with safe GET fixtures only.
for (const width of [360, 390, 768, 1280])
	for (const theme of ['light', 'dark'])
		test(`remaining model usage and subscription overview pages at ${width}px in ${theme}`, async ({
			page
		}) => {
			await populatedPages(page);
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
			await page.route('**/api/v1/analytics/**', (route) => {
				const path = new URL(route.request().url()).pathname;
				return route.fulfill({
					json: path.endsWith('/summary')
						? { total_messages: 3, total_chats: 2, total_models: 1, total_users: 1 }
						: path.endsWith('/models')
							? {
									models: [
										{ model_id: 'fixture-model', count: 3, unique_users: 1, unique_chats: 2 }
									]
								}
							: path.endsWith('/users')
								? { users: [] }
								: path.endsWith('/daily')
									? { data: [{ date: '2026-09-01', models: { 'fixture-model': 3 } }] }
									: path.endsWith('/tokens')
										? { models: [], total_tokens: 0 }
										: { history: [], tags: [] }
				});
			});
			for (const path of [
				'/admin/analytics/models' + dates,
				'/admin/billing/plans/acceptance-plan/analytics'
			]) {
				await page.goto(path);
				await expect(page.getByRole('heading').first(), path).toBeVisible();
				await expect(page.getByRole('alert'), path).toHaveCount(0);
				if (path.includes('/plans/')) {
					await expect(page.getByText('Проверочная подписка', { exact: true })).toBeVisible();
					await expect(
						page.getByText('История дохода пока недоступна', { exact: true })
					).toBeVisible();
				} else await expect(page.getByTestId('model-usage')).toContainText('Сохранённых ответов');
				await expect
					.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
					.toBe(true);
			}
		});

test('money records and model price modal support keyboard inspection without writes', async ({
	page
}) => {
	await populatedPages(page);
	await page.setViewportSize({ width: 1280, height: 900 });
	const writes: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('/api/v1/admin/billing/') && request.method() !== 'GET')
			writes.push(request.url());
	});
	await page.goto(
		'/admin/billing/transactions?tab=payments&from_date=2026-10-02&to_date=2026-10-03'
	);
	const row = page.locator('table.reporting-records tbody tr').first();
	await row.locator('summary').press('Enter');
	await expect(row.locator('details')).toHaveAttribute('open', '');
	await expect(row.locator('details')).toContainText('local-payment');
	await row.getByRole('button', { name: acceptancePayment.name }).press('Enter');
	await expect(page).toHaveURL(/customers\/acceptance-customer/);
	await page.locator('a[href^="/admin/billing/transactions?"]').first().press('Enter');
	await expect(page).toHaveURL(/transactions\?.*tab=payments/);
	await expect(page.locator('input[type=date]').first()).toHaveValue('2026-10-02');
	await page.goto('/admin/billing/models');
	const model = page
		.locator('tbody tr')
		.filter({ hasText: 'Проверочная модель', visible: true })
		.first();
	await model.getByRole('button').last().press('Enter');
	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.getByRole('dialog')).toContainText('→');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	expect(writes).toEqual([]);
});
