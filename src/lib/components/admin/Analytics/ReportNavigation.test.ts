// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import en from '$lib/i18n/locales/en-US/translation.json';
import ru from '$lib/i18n/locales/ru-RU/translation.json';
import ReportNavigation from './ReportNavigation.svelte';

const route = vi.hoisted(() => ({ navigate: vi.fn<[URL], void>() }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	const page = writable({
		url: new URL(
			'http://localhost/admin/billing?from_date=2026-10-01&to_date=2026-10-02&currency=USD'
		)
	});
	route.navigate.mockImplementation((url) => page.set({ url }));
	return { page };
});

it('updates active styling and filter links on SPA navigation without remounting', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	mounted.push(
		mount(ReportNavigation, {
			target,
			context: new Map([['i18n', writable({ t: (key: string): string => key })]])
		})
	);
	await tick();
	const primary = target.querySelector('nav')!;
	const destinations = [
		'/admin/billing/transactions',
		'/admin/billing/transactions',
		'/admin/billing',
		'/admin/billing/customers',
		'/admin/billing/customers/customer-id',
		'/admin/billing/models',
		'/admin/billing/lead-magnet',
		'/admin/billing/plans',
		'/admin/analytics',
		'/admin/analytics/models',
		'/admin/analytics/retention',
		'/admin/analytics/mail'
	];
	for (const [index, pathname] of destinations.entries()) {
		const from = `2026-10-${String(index + 1).padStart(2, '0')}`;
		const currency = index % 2 ? 'RUB' : 'USD';
		route.navigate(
			new URL(
				`http://localhost${pathname}?from_date=${from}&to_date=2026-10-20&currency=${currency}&window_days=14`
			)
		);
		await tick();
		expect(target.querySelector('nav')).toBe(primary);
		for (const link of target.querySelectorAll<HTMLAnchorElement>('a')) {
			const href = new URL(link.href).pathname;
			const active =
				pathname === href ||
				(href === '/admin/billing/customers' && pathname.startsWith(`${href}/`));
			expect.soft(link.getAttribute('aria-current')).toBe(active ? 'page' : null);
			if (primary.contains(link)) {
				expect.soft(link.classList.contains('bg-gray-100')).toBe(active);
				expect.soft(link.classList.contains('dark:bg-gray-800')).toBe(active);
				expect.soft(link.classList.contains('font-medium')).toBe(active);
			}
			const params = new URL(link.href).searchParams;
			const sameReportFamily =
				pathname.startsWith('/admin/analytics') === href.startsWith('/admin/analytics');
			expect.soft(params.get('from')).toBe(sameReportFamily ? from : null);
			expect.soft(params.get('to')).toBe(sameReportFamily ? '2026-10-20' : null);
			expect.soft(params.get('currency')).toBe(sameReportFamily ? currency : null);
			expect.soft(params.get('window_days')).toBe(sameReportFamily ? '14' : null);
		}
		const settings = [...target.querySelectorAll<HTMLAnchorElement>('details a')];
		expect(
			settings
				.filter((link) => link.getAttribute('aria-current') === 'page')
				.map((link) => new URL(link.href).pathname)
		).toEqual(settings.some((link) => new URL(link.href).pathname === pathname) ? [pathname] : []);
	}
});
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		config: writable({
			features: { enable_admin_analytics: true, enable_billing_subscriptions: false }
		})
	};
});

const mounted: ReturnType<typeof mount>[] = [];
beforeEach(() => {
	route.navigate(
		new URL('http://localhost/admin/billing?from_date=2026-10-01&to_date=2026-10-02&currency=USD')
	);
});
afterEach(async () => {
	for (const component of mounted.splice(0)) await unmount(component);
	document.body.replaceChildren();
});

it.each([
	[
		'Current term and usage stay unchanged. Reduced or incomparable rights apply only on renewal. No payment, extension or compensation is created.',
		'Текущий срок подписки и учтённое использование не меняются. Сокращённые или несопоставимые права доступа применяются только при продлении. При этом платёж не создаётся, срок не продлевается и компенсация не начисляется.'
	],
	[
		'New manual access starts now for one plan interval. No payment is recorded.',
		'Доступ назначается вручную с текущего момента на один период выбранного плана. Платёж не регистрируется.'
	],
	['Stored subscription status', 'Сохранённый статус подписки'],
	[
		'The period has ended. The stored status does not confirm current access.',
		'Период завершён. Сохранённый статус не подтверждает текущий доступ.'
	]
])('translates the subscription status or assignment explanation: %s', async (key, russian) => {
	const selected = createInstance();
	await selected.init({
		lng: 'ru-RU',
		fallbackLng: 'en-US',
		returnEmptyString: false,
		resources: {
			'en-US': { translation: en },
			'ru-RU': { translation: ru }
		}
	});
	expect.soft(selected.t(key)).toBe(russian);
	await selected.changeLanguage('en-US');
	expect(selected.t(key)).toBe(key);
});

it('groups money/operations/customers, preserves money filters and separates settings', async () => {
	const selected = createInstance();
	await selected.init({
		lng: 'en-US',
		fallbackLng: 'en-US',
		returnEmptyString: false,
		resources: {
			'en-US': { translation: en },
			'ru-RU': { translation: ru }
		}
	});
	const i18n = writable(selected);
	const target = document.createElement('div');
	document.body.append(target);
	mounted.push(mount(ReportNavigation, { target, context: new Map([['i18n', i18n]]) }));
	await tick();
	const primary = target.querySelector('nav');
	expect([...primary!.querySelectorAll('a')].map((a) => a.textContent)).toEqual([
		'Money',
		'Operations',
		'Customers'
	]);
	const operations = primary!.querySelector<HTMLAnchorElement>(
		'a[href^="/admin/billing/transactions"]'
	)!;
	expect(new URL(operations.href).searchParams.get('currency')).toBe('USD');
	expect(new URL(operations.href).searchParams.get('from')).toBe('2026-10-01');
	expect(target.querySelector('a[href="/admin/analytics"]')).not.toBeNull();
	// Disabling new purchases must not hide administration of existing subscriptions.
	expect(target.querySelector('details a[href^="/admin/billing/plans"]')).not.toBeNull();
	for (const locale of ['ru-RU', 'en-US']) {
		await selected.changeLanguage(locale);
		i18n.set(selected);
		await tick();
		expect(primary!.getAttribute('aria-label')).toBe(locale === 'ru-RU' ? 'Биллинг' : 'Billing');
		expect(operations.textContent).toBe(locale === 'ru-RU' ? 'Операции' : 'Operations');
		expect
			.soft(primary!.querySelector('a[href^="/admin/billing/customers"]')?.textContent)
			.toBe(locale === 'ru-RU' ? 'Клиенты' : 'Customers');
		expect.soft(selected.t('Payments')).toBe(locale === 'ru-RU' ? 'Платежи' : 'Payments');
		expect(selected.t('Users')).toBe(locale === 'ru-RU' ? 'Пользователи' : 'Users');
	}
});
