// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import StatusItem from './StatusItem.svelte';

it('counts the same items that the actual search panel displays when both fields exist', async () => {
	const target = document.createElement('div');
	const component = mount(StatusItem, {
		target,
		context: new Map([
			[
				'i18n',
				writable({
					t: (text: string, values?: { count?: number }): string =>
						text.replace('{{count}}', String(values?.count))
				})
			]
		]),
		props: {
			status: {
				action: 'web_search',
				description: 'Searched {{count}} sites',
				urls: ['https://old.test'],
				items: [{ link: 'https://one.test' }, { link: 'https://two.test' }]
			}
		}
	});
	try {
		await tick();
		expect(target.textContent).toContain('Searched 2 sites');
	} finally {
		await unmount(component);
	}
});
