// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import Tags from './Tags.svelte';

it('connects each tag input to its own suggestions and preserves selection and cleanup', async () => {
	const first = document.createElement('div');
	const second = document.createElement('div');
	document.body.append(first, second);
	const context = new Map([['i18n', writable({ t: (text: string): string => text })]]);
	const added = vi.fn();
	const one = mount(Tags, {
		target: first,
		context,
		props: { suggestionTags: ['Plan'] },
		events: { add: added }
	});
	const two = mount(Tags, { target: second, context, props: { suggestionTags: ['Text'] } });
	try {
		await tick();
		const input = first.querySelector('input')!;
		const other = second.querySelector('input')!;
		input.dispatchEvent(new FocusEvent('focus'));
		other.dispatchEvent(new FocusEvent('focus'));
		await tick();
		const listId = input.getAttribute('aria-controls');
		const otherId = other.getAttribute('aria-controls');
		expect(listId).toBeTruthy();
		expect(otherId).toBeTruthy();
		expect(listId).not.toBe(otherId);
		const list = document.getElementById(listId!);
		expect(list?.getAttribute('role')).toBe('listbox');
		expect(input.getAttribute('aria-expanded')).toBe('true');
		const option = list!.querySelector<HTMLButtonElement>('[role="option"]')!;
		expect(option.getAttribute('aria-selected')).toBe('false');
		option.click();
		await tick();
		expect(added).toHaveBeenCalledOnce();
		expect(added.mock.calls[0][0].detail).toBe('Plan');
		expect(document.getElementById(listId!)).toBeNull();
	} finally {
		await unmount(one);
		await unmount(two);
		first.remove();
		second.remove();
		expect(document.querySelector('[role="listbox"]')).toBeNull();
	}
});
