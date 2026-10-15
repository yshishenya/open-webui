// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { tick } from 'svelte';
import { createClassComponent } from 'svelte/legacy';
import { writable } from 'svelte/store';
import { expect, it, vi } from 'vitest';
import ConfirmDialog from '../src/lib/components/common/ConfirmDialog.svelte';

vi.mock('focus-trap', async (importOriginal) => {
	const original = await importOriginal<typeof import('focus-trap')>();
	return {
		...original,
		createFocusTrap: (element: Parameters<typeof original.createFocusTrap>[0]) =>
			original.createFocusTrap(element, { tabbableOptions: { displayCheck: 'none' } })
	};
});

it('restores scrolling after destruction and releases confirmation keyboard handlers', async () => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const target = document.createElement('div');
	document.body.append(target);
	const onConfirm = vi.fn();
	const component = createClassComponent({
		component: ConfirmDialog,
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: { show: true, onConfirm, message: '**Saved** <img src=x onerror=alert(1)>' }
	});
	try {
		await tick();
		expect(document.body.style.overflow).toBe('hidden');
		expect(document.querySelector('[role="dialog"] strong')?.textContent).toBe('Saved');
		expect(document.querySelector('[role="dialog"] img')?.hasAttribute('onerror')).toBe(false);
	} finally {
		component.$destroy();
		target.remove();
	}
	await tick();
	expect(document.querySelector('[role="dialog"]')).toBeNull();
	expect(document.body.style.overflow).toBe('unset');
	window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	await tick();
	expect(onConfirm).not.toHaveBeenCalled();
});
