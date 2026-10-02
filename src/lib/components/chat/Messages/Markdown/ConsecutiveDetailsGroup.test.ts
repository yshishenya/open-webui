// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { writable } from 'svelte/store';
import ConsecutiveDetailsGroup from './ConsecutiveDetailsGroup.svelte';

vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { settings: writable({}) };
});
vi.mock('$lib/components/common/FullHeightIframe.svelte', () => ({ default: null }));

it.each(['not-json', '0', '[null,0,{}]'])(
	'keeps tool summaries without creating embeds for invalid input %s',
	async (embeds: string) => {
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(ConsecutiveDetailsGroup, {
			target,
			context: new Map([['i18n', writable({ t: (text: string): string => text })]]),
			props: {
				id: 'tools',
				tokens: [{ attributes: { type: 'tool_calls', name: 'Search', embeds } }]
			}
		});
		try {
			await tick();
			expect(target.textContent).toContain('Search');
			expect(target.querySelector('[id^="tools-embed-"]')).toBeNull();
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);
