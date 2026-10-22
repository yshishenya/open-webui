// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import Plans from './+page.svelte';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		WEBUI_NAME: writable('Airis'),
		user: writable({ role: 'admin' }),
		config: writable({ features: { enable_billing_subscriptions: true } })
	};
});
vi.mock('$lib/utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('$lib/apis/billing', () => ({
	getPlans: async () => [
		{
			id: 'localized',
			name: 'English plan',
			name_ru: 'Русский тариф',
			description: 'English description',
			description_ru: 'Русское описание',
			price: 1234.56,
			currency: 'RUB',
			interval: 'month',
			display_order: 0
		}
	],
	getMySubscription: async () => null,
	createPayment: vi.fn(),
	resumeSubscription: vi.fn()
}));

it('switches plan language and currency formatting without a reload or currency conversion', async () => {
	const i18n = createInstance();
	await i18n.init({ lng: 'ru-RU', resources: {}, initImmediate: false });
	const language = writable(i18n);
	const target = document.createElement('div');
	const component = mount(Plans, { target, context: new Map([['i18n', language]]) });
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('Русский тариф'));
		expect(target.textContent).toContain('Русское описание');
		expect(target.textContent).toContain(
			new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(1234.56)
		);
		await i18n.changeLanguage('en-US');
		language.set(i18n);
		await tick();
		expect(target.textContent).toContain('English plan');
		expect(target.textContent).toContain('English description');
		expect(target.textContent).not.toContain('Русский тариф');
		expect(target.textContent).toContain(
			new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RUB' }).format(1234.56)
		);
	} finally {
		await unmount(component);
	}
});
