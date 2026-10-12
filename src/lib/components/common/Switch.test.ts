// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import Switch from './Switch.svelte';

vi.mock('$lib/stores', () => ({ settings: writable({ highContrastMode: false }) }));

it('displays a nullable OAuth flag as off without writing it until the user changes it', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const changed = vi.fn();
	const component = mount(Switch, {
		target,
		props: { state: null, ariaLabel: 'OAuth flag' },
		context: new Map([['i18n', writable({ t: (text: string): string => text })]]),
		events: { change: changed }
	});
	try {
		await tick();
		const button = target.querySelector<HTMLButtonElement>('[role="switch"]')!;
		expect(button.getAttribute('aria-checked')).toBe('false');
		expect(changed).not.toHaveBeenCalled();
		button.click();
		await tick();
		expect(button.getAttribute('aria-checked')).toBe('true');
		await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
		expect(changed.mock.calls[0][0].detail).toBe(true);
		button.click();
		await tick();
		expect(button.getAttribute('aria-checked')).toBe('false');
		await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
		expect(changed.mock.calls[1][0].detail).toBe(false);
	} finally {
		await unmount(component);
		target.remove();
	}
});
