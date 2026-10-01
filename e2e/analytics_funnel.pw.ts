import { expect, test } from '@playwright/test';

// Explicitly mocked local test traffic; no events are sent to external analytics or production.
test('consent gates the real public page, identity and revocation', async ({ page }) => {
	const contexts: Array<Record<string, unknown>> = [];
	const events: Array<Record<string, unknown>> = [];
	let externalLoads = 0;
	await page.route('**/mc.yandex.ru/**', async (route) => {
		externalLoads++;
		await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
	});
	await page.route('**/api/v1/analytics/context', async (route) => {
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
	await page.route('**/api/v1/analytics/events', async (route) => {
		events.push(route.request().postDataJSON());
		await route.fulfill({ json: { accepted: true } });
	});
	await page.goto('/welcome?utm_source=consent-test&token=must-not-leak');
	const consent = page.getByRole('dialog', { name: 'Настройки аналитики' });
	await expect(consent).toBeVisible();
	expect(contexts).toHaveLength(0);
	expect(events).toHaveLength(0);
	expect(externalLoads).toBe(0);
	await consent.getByRole('button', { name: 'Разрешить', exact: true }).click();
	await expect
		.poll(() => events.some((event) => event.event_name === 'product_first_visit'))
		.toBe(true);
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
	await consent.getByRole('button', { name: 'Запретить', exact: true }).click();
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
	await page.waitForTimeout(500);
	await page.goto('/welcome');
	await expect(page.getByRole('heading').first()).toBeVisible();
	expect(events).toHaveLength(count);
});

test('the real report distinguishes mature conversion from an unfinished observation window', async ({
	page
}) => {
	const requests: string[] = [];
	let failNext = false;
	await page.route('**/__analytics_report__', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: '<html><body><main id="report"></main><script>globalThis.APP_BUILD_HASH="test";globalThis.APP_VERSION="analytics-test";globalThis.__SVELTEKIT_APP_VERSION__="analytics-test";globalThis.__SVELTEKIT_EXPERIMENTAL_EXPLICIT_ENVIRONMENT_VARIABLES__=false;</script><script type="module">import {mount} from "/node_modules/.vite/deps/svelte.js"; import ProductFunnel from "/src/lib/components/admin/Analytics/ProductFunnel.svelte"; const names={"Conversion window":"Окно конверсии","Grouping":"Группировка"}; mount(ProductFunnel,{target:document.getElementById("report"),context:new Map([["i18n",{subscribe:(run)=>{run({t:(key)=>names[key]||key});return()=>{}}}]])});</script></body></html>'
		})
	);
	await page.route('**/api/v1/analytics/funnel-report*', async (route) => {
		requests.push(route.request().url());
		if (failNext) {
			failNext = false;
			await route.fulfill({ status: 500, json: { detail: 'test failure' } });
			return;
		}
		await route.fulfill({
			json: {
				payment_funnel: { created: 4, confirmed: 3, conversion_percent: 75 },
				stages: {},
				financial: {
					RUB: {
						confirmed_payments: 3,
						gross_kopeks: 150000,
						refund_kopeks: 50000,
						net_kopeks: 100000
					}
				},
				delivery: [],
				coverage: { consented_identities: 10, linked_accounts: 5 },
				events: {},
				rows: [
					{
						cohort: 'mature',
						visitors: 10,
						registered: 5,
						activated: 4,
						paid: 2,
						repeated: 1,
						mature_visitors: 10,
						mature_paid: 2,
						conversion_percent: 20,
						median_hours_to_pay: 6
					},
					{
						cohort: 'fresh',
						visitors: 3,
						registered: 1,
						activated: 1,
						paid: 1,
						repeated: 0,
						mature_visitors: 0,
						mature_paid: 0,
						conversion_percent: null,
						median_hours_to_pay: 2
					}
				]
			}
		});
	});
	await page.goto('/__analytics_report__');
	await expect(page.getByText('20% (2/10)', { exact: true })).toBeVisible();
	await expect(page.getByText('Окно ещё не завершено', { exact: true })).toBeVisible();
	await expect(page.getByText(/чистые поступления 1000.00/)).toBeVisible();
	await page.getByLabel('Окно конверсии').selectOption('7');
	await expect.poll(() => requests.some((url) => url.includes('window_days=7'))).toBe(true);
	await page.getByLabel('Группировка').selectOption('utm_source');
	await expect.poll(() => requests.some((url) => url.includes('breakdown=utm_source'))).toBe(true);
	await page.getByLabel('Первый визит с').fill('2026-01-01');
	await page.getByLabel('Первый визит с').blur();
	await expect
		.poll(() => requests.some((url) => new URL(url).searchParams.get('start') === '1767225600'))
		.toBe(true);
	await page.getByLabel('по', { exact: true }).fill('2026-01-10');
	await page.getByLabel('по', { exact: true }).blur();
	await expect
		.poll(() => requests.some((url) => new URL(url).searchParams.get('end') === '1768089600'))
		.toBe(true);
	await expect(page.getByText('20% (2/10)', { exact: true })).toBeVisible();
	failNext = true;
	await page.getByRole('button', { name: 'Обновить', exact: true }).click();
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.getByText('20% (2/10)', { exact: true })).toHaveCount(0);
});
