// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import ProductEmailChoice from './ProductEmailChoice.svelte';
import ProductEmailPreference from './ProductEmailPreference.svelte';
import UnsubscribePage from '../../../routes/unsubscribe/+page.svelte';

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('$lib/apis/email-preferences', () => ({
	getProductEmailPreference: api.get,
	saveProductEmailPreference: api.save,
	unsubscribeProductEmail: api.unsubscribe
}));
const flush = async (): Promise<void> => {
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
};
const preference = (subscribed = false) => ({
	subscribed,
	email_verified: true,
	can_receive: subscribed,
	reason: subscribed ? 'ready' : 'no_consent',
	consent_version: 'test'
});

describe('product email choice', () => {
	let component: Record<string, unknown> | null = null;
	beforeEach(() => {
		document.body.innerHTML = '';
		localStorage.token = 'session-test';
		window.history.replaceState({}, '', '/');
		api.get.mockReset().mockResolvedValue(preference());
		api.save.mockReset();
		api.unsubscribe.mockReset().mockResolvedValue(undefined);
	});
	afterEach(async () => {
		if (component) await unmount(component);
		component = null;
	});

	it('starts unchecked and links the separate consent explanation', async () => {
		component = mount(ProductEmailChoice, { target: document.body });
		await flush();
		expect(document.querySelector<HTMLInputElement>('input')?.checked).toBe(false);
		expect(document.querySelector('a')?.getAttribute('href')).toBe(
			'/documents/product-email-consent'
		);
	});

	it('changes consent only on explicit save and reports a failed save', async () => {
		component = mount(ProductEmailPreference, { target: document.body });
		await flush();
		const checkbox = document.querySelector<HTMLInputElement>('input')!;
		checkbox.click();
		await flush();
		expect(api.save).not.toHaveBeenCalled();
		api.save.mockRejectedValueOnce(new Error('Сохранение недоступно'));
		document.querySelector<HTMLButtonElement>('button')!.click();
		await flush();
		expect(api.save).toHaveBeenCalledWith('session-test', true);
		expect(document.querySelector('[role="alert"]')?.textContent).toContain(
			'Сохранение недоступно'
		);
		expect(document.querySelector('[role="status"]')).toBeNull();
		api.save.mockResolvedValue(preference(true));
		document.querySelector<HTMLButtonElement>('button')!.click();
		await flush();
		expect(document.querySelector('[role="status"]')?.textContent).toContain('Согласие сохранено');
	});

	it('does not substitute a default choice when preferences fail to load', async () => {
		api.get.mockRejectedValueOnce(new Error('Загрузка недоступна'));
		component = mount(ProductEmailPreference, { target: document.body });
		await flush();
		expect(document.querySelector('input')).toBeNull();
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Загрузка недоступна');
		expect(api.save).not.toHaveBeenCalled();
		document.querySelector<HTMLButtonElement>('button')!.click();
		await flush();
		expect(document.querySelector<HTMLInputElement>('input')?.checked).toBe(false);
	});

	it('removes the fragment and keeps a public GET passive until explicit confirmation', async () => {
		const token = 'a'.repeat(43);
		window.history.replaceState({}, '', `/unsubscribe#token=${token}`);
		component = mount(UnsubscribePage, { target: document.body });
		await flush();
		expect(window.location.hash).toBe('');
		expect(document.body.textContent).not.toContain(token);
		expect(api.unsubscribe).not.toHaveBeenCalled();
		document.querySelector<HTMLButtonElement>('button')!.click();
		await flush();
		expect(api.unsubscribe).toHaveBeenCalledTimes(1);
		expect(api.unsubscribe).toHaveBeenCalledWith(token);
		expect(document.querySelector('[role="status"]')?.textContent).toContain(
			'Запрос на отписку обработан'
		);
	});
});
