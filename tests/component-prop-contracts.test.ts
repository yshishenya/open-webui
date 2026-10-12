// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { expect, it, vi } from 'vitest';
import ToolCallDisplay from '$lib/components/common/ToolCallDisplay.svelte';
import ManifestModal from '$lib/components/workspace/common/ManifestModal.svelte';
import { WEBUI_BASE_URL } from '$lib/constants';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({ activate() {}, deactivate() {}, pause() {}, unpause() {} })
}));

const context = async (): Promise<Map<string, object>> => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	return new Map([['i18n', writable(i18n)]]);
};

it.each([
	['data:image/png;base64,AA==', 'data:image/png;base64,AA=='],
	[{ type: 'image', url: '/fixture.png' }, `${WEBUI_BASE_URL}/fixture.png`]
] as const)('keeps actual tool image output %s', async (file, expectedSrc) => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(ToolCallDisplay, {
		target,
		context: await context(),
		props: { id: 'fixture', attributes: { done: 'true', files: JSON.stringify([file]) } }
	});
	try {
		await tick();
		const image = target.querySelector('img');
		expect(image?.getAttribute('src')).toBe(expectedSrc);
		expect(image?.getAttribute('alt')).toBe('Image');
		// Image has never forwarded the supplied component id to its DOM.
		expect(target.querySelector('#fixture-tool-call-result-0')).toBeNull();
	} finally {
		await unmount(component);
		target.remove();
	}
});

it.each([{}, { funding_url: 'https://fixture.invalid/support' }])(
	'keeps the existing funding link: %s',
	async (manifest) => {
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(ManifestModal, {
			target,
			context: await context(),
			props: { show: true, manifest }
		});
		try {
			await tick();
			const link = document.querySelector('a');
			expect(link).not.toBeNull();
			expect(link?.getAttribute('href')).toBe(manifest.funding_url ?? null);
			expect(link?.textContent?.trim()).toBe(manifest.funding_url ?? '');
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);
