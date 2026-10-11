// @vitest-environment jsdom
import { createClassComponent } from 'svelte/legacy';
import { tick } from 'svelte';
import { readable } from 'svelte/store';
import { afterEach, expect, it, vi } from 'vitest';
import Banners from '$lib/components/admin/Settings/Interface/Banners.svelte';

const mocks = vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
	return { created: vi.fn(), destroyed: vi.fn() };
});
vi.mock('sortablejs', () => ({
	default: class {
		constructor(element: HTMLElement) {
			mocks.created(element);
		}
		destroy(): void {
			mocks.destroyed();
		}
	}
}));
const instances: ReturnType<typeof createClassComponent>[] = [];
const context = new Map([['i18n', readable({ t: (s: string) => s })]]);
afterEach(async () => {
	instances.splice(0).forEach((instance) => instance.$destroy());
	await tick();
	document.body.replaceChildren();
	mocks.created.mockClear();
	mocks.destroyed.mockClear();
});
const banner = {
	id: 'a',
	type: 'info',
	content: 'Current notice',
	dismissible: true,
	timestamp: 1
};
it('initializes a sorter after binding the real list and destroys it on unmount', async () => {
	const instance = createClassComponent({
		component: Banners,
		target: document.body,
		context,
		props: { banners: [banner] }
	});
	instances.push(instance);
	await tick();
	expect(document.querySelector('#banner-item-a')).not.toBeNull();
	expect(mocks.created).toHaveBeenCalledOnce();
	expect(mocks.created.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
	instance.$destroy();
	instances.pop();
	await tick();
	expect(mocks.destroyed).toHaveBeenCalledOnce();
});
it('replacing rendered banners destroys the previous sorter exactly once', async () => {
	const instance = createClassComponent({
		component: Banners,
		target: document.body,
		context,
		props: { banners: [banner] }
	});
	instances.push(instance);
	await tick();
	expect(mocks.created).toHaveBeenCalledOnce();
	instance.$set({ banners: [{ ...banner, id: 'b', content: 'Updated notice' }] });
	await tick();
	expect(document.querySelector('#banner-item-a')).toBeNull();
	expect(document.querySelector('#banner-item-b')).not.toBeNull();
	expect(mocks.created).toHaveBeenCalledTimes(2);
	expect(mocks.destroyed).toHaveBeenCalledOnce();
});
