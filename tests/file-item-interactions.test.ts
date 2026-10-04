// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { compile } from 'svelte/compiler';
import { writable } from 'svelte/store';
import { expect, it, vi } from 'vitest';
import FileItem from '../src/lib/components/common/FileItem.svelte';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('$lib/components/common/FileItemModal.svelte', () => ({ default: () => {} }));

it('keeps server-rendered attachment buttons valid for native browser parsing', () => {
	const output = compile(readFileSync('src/lib/components/common/FileItem.svelte', 'utf8'), {
		filename: 'FileItem.svelte',
		generate: 'server',
		dev: false
	});
	expect(
		output.warnings.filter((warning) => warning.code === 'node_invalid_placement_ssr')
	).toEqual([]);
});

it.each([
	{ name: undefined, small: false },
	{ name: undefined, small: true },
	{ name: 'a%20b.txt', small: true },
	{ name: '100%.txt', small: true }
])(
	'retains independent native open/remove controls and readable name $name, small=$small',
	async ({ name, small }) => {
		const i18n = createInstance();
		await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
		const target = document.createElement('div');
		document.body.append(target);
		const open = vi.fn();
		const dismiss = vi.fn();
		const component = mount(FileItem, {
			target,
			context: new Map([['i18n', writable(i18n)]]),
			props: { name, small, type: 'file', size: undefined, dismissible: true, modal: true },
			events: { click: open, dismiss }
		});
		try {
			await tick();
			const remove = target.querySelector<HTMLButtonElement>('button[aria-label="Remove File"]');
			expect(remove).not.toBeNull();
			expect(target.querySelector('button button')).toBeNull();
			const buttons = target.querySelectorAll<HTMLButtonElement>('button');
			expect(buttons).toHaveLength(2);
			const opener = buttons[0];
			expect(opener.textContent).toContain(
				name === undefined ? 'File' : name === 'a%20b.txt' ? 'a b.txt' : name
			);
			expect(opener.textContent).not.toContain('undefined');
			opener.focus();
			expect(document.activeElement).toBe(opener);
			opener.click();
			await tick();
			expect(open).toHaveBeenCalledTimes(1);
			remove?.focus();
			expect(document.activeElement).toBe(remove);
			remove?.click();
			await tick();
			expect(dismiss).toHaveBeenCalledTimes(1);
			expect(open).toHaveBeenCalledTimes(1);
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);
