// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import ReportNavigation from './ReportNavigation.svelte';

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			url: new URL(
				'http://localhost/admin/billing?from_date=2026-10-01&to_date=2026-10-02&currency=USD'
			)
		})
	};
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
afterEach(async () => {
	for (const component of mounted.splice(0)) await unmount(component);
	document.body.replaceChildren();
});

it('groups money/operations/customers, preserves money filters and separates settings', async () => {
	const i18n = writable({ t: (key: string): string => key });
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
	i18n.set({ t: (key: string): string => `RU:${key}` });
	await tick();
	expect(primary!.getAttribute('aria-label')).toBe('RU:Billing');
	expect(operations.textContent).toBe('RU:Operations');
});
