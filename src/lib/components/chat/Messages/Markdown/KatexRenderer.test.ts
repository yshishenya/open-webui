// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import KatexRenderer from './KatexRenderer.svelte';

const copy = vi.hoisted(() => vi.fn());
vi.mock('$lib/utils', () => ({ copyToClipboard: copy }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn() } }));

it('renders real chemical math and copies its source with both keyboard activation keys', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const content = '\\ce{H2O}';
	const component = mount(KatexRenderer, {
		target,
		context: new Map([['i18n', writable({ t: (text: string): string => text })]]),
		props: { content }
	});
	try {
		await vi.waitFor(() => expect(target.querySelector('.katex')).not.toBeNull());
		expect(target.querySelector('math')).not.toBeNull();
		const button = target.querySelector<HTMLElement>('[role="button"]')!;
		expect(button).not.toBeNull();
		expect(button.tabIndex).toBe(0);
		for (const key of ['Enter', ' ']) {
			button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
		}
		expect(copy.mock.calls).toEqual([[content], [content]]);
	} finally {
		await unmount(component);
		target.remove();
	}
});
