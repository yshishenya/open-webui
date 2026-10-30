// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, tick, unmount, type ComponentProps } from 'svelte';
import { writable } from 'svelte/store';
type Params = NonNullable<ComponentProps<typeof AdvancedParams>['params']>;
import AdvancedParams from './AdvancedParams.svelte';

vi.mock('$lib/stores', () => ({
	settings: writable({ highContrastMode: false }),
	config: writable({ features: { enable_context_compaction: false } })
}));

it('preserves reasoning tag choices, text stop sequences and numeric top_k validation', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const snapshots: Params[] = [];
	const component = mount(AdvancedParams, {
		target,
		props: {
			admin: true,
			custom: true,
			params: { reasoning_tags: null, stop: 'one,two', custom_params: { extra: 'value' } },
			onChange: (params: Params): void => {
				snapshots.push(structuredClone(params));
			}
		},
		context: new Map([['i18n', writable({ t: (text: string): string => text })]])
	});
	const control = (name: string): HTMLButtonElement => {
		const label = [...target.querySelectorAll('label')].find(
			(node) => node.textContent?.trim() === name
		);
		return document.getElementById(label!.htmlFor) as HTMLButtonElement;
	};
	try {
		await tick();
		for (const expected of [['', ''], true, false, null]) {
			control('settings.personal.general.parameters.reasoningTags.label').click();
			await tick();
			expect(snapshots.at(-1)?.reasoning_tags).toEqual(expected);
		}
		control('settings.personal.general.parameters.topK.label').click();
		await tick();
		const input = target.querySelector<HTMLInputElement>(
			'input[type="number"][aria-label="settings.personal.general.parameters.topK.label"]'
		)!;
		for (const invalid of ['1001', '-1', '1.5', '']) {
			input.value = invalid;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			expect(input.value).toBe('40');
			expect(snapshots.at(-1)?.top_k).toBe(40);
		}
		input.value = '0';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(snapshots.at(-1)?.top_k).toBe(0);
		expect(snapshots.at(-1)?.stop).toBe('one,two');
		expect(snapshots.at(-1)?.custom_params).toEqual({ extra: 'value' });
	} finally {
		await unmount(component);
		target.remove();
	}
});
