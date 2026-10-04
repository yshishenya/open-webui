// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { beforeEach, expect, it, vi } from 'vitest';
import Messages from '../src/lib/components/chat/Messages.svelte';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));

beforeEach(() => {
	if (!Element.prototype.animate)
		Object.defineProperty(Element.prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => ({
				cancel: vi.fn(),
				finished: Promise.resolve(),
				finish: vi.fn(),
				pause: vi.fn(),
				play: vi.fn()
			}))
		});
});

it('mounts the actual empty message list when a preview supplies no history', async () => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(Messages, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: {
			history: undefined,
			selectedModels: [],
			atSelectedModel: null,
			autoScroll: false,
			readOnly: true,
			sendMessage: () => {},
			continueResponse: () => {},
			regenerateResponse: () => {},
			mergeResponses: () => {},
			chatActionHandler: () => {}
		}
	});
	try {
		await tick();
		expect(target.querySelector('[role="log"]')).toBeNull();
		expect(target.textContent).toContain('How can I help you today?');
	} finally {
		await unmount(component);
		target.remove();
	}
});
