// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { expect, it, vi } from 'vitest';
import FullHeightIframe from '$lib/components/common/FullHeightIframe.svelte';
import AddToolServerModal from '$lib/components/AddToolServerModal.svelte';
import AttachWebpageModal from '$lib/components/chat/MessageInput/AttachWebpageModal.svelte';
import ChannelMessage from '$lib/components/channel/Messages/Message.svelte';
import { settings } from '$lib/stores';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({ activate() {}, deactivate() {}, pause() {}, unpause() {} })
}));
vi.mock('$lib/components/common/FileItemModal.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/chat/Messages/Markdown.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/chat/Messages/StructuredOutputRenderer.svelte', () => ({
	default: () => {}
}));

const context = async (): Promise<Map<string, object>> => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	return new Map([['i18n', writable(i18n)]]);
};

it.each([
	['https://fixture.invalid', true],
	['https://fixture.invalid', false],
	['<p>fixture</p>', true],
	['<p>fixture</p>', false]
] as const)(
	'keeps native iframe fullscreen=%s/%s and its sandbox',
	async (src, allowFullscreen) => {
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(FullHeightIframe, {
			target,
			props: { src, allowFullscreen, allowScripts: false }
		});
		try {
			await vi.waitFor(() => expect(target.querySelector('iframe')).not.toBeNull());
			const iframe = target.querySelector('iframe');
			expect(iframe).not.toBeNull();
			expect(iframe?.allowFullscreen).toBe(allowFullscreen);
			expect(iframe?.hasAttribute('allowfullscreen')).toBe(allowFullscreen);
			expect(iframe?.getAttribute('sandbox')).toBe('allow-downloads');
			if (src.startsWith('https:'))
				expect(iframe?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);

it('connects Auth and OpenAPI Spec labels to different native selects', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(AddToolServerModal, {
		target,
		context: await context(),
		props: { show: true }
	});
	try {
		await tick();
		const advanced = Array.from(document.querySelectorAll('button')).find(
			(b) => b.textContent?.trim() === 'Advanced'
		);
		expect(advanced).toBeDefined();
		advanced?.click();
		await tick();
		const labels = Array.from(document.querySelectorAll('label'));
		const auth = labels.find((l) => l.textContent?.trim() === 'Auth')?.control;
		const spec = labels.find((l) => l.textContent?.trim() === 'OpenAPI Spec')?.control;
		expect(auth).toBeInstanceOf(HTMLSelectElement);
		expect(spec).toBeInstanceOf(HTMLSelectElement);
		expect(auth).not.toBe(spec);
		const selects = Array.from(document.querySelectorAll('select')).filter((s) => s.id);
		expect(new Set(selects.map((s) => s.id)).size).toBe(selects.length);
	} finally {
		await unmount(component);
		target.remove();
	}
});

it('keeps URL submission while using native textarea attributes', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const onSubmit = vi.fn();
	const component = mount(AttachWebpageModal, {
		target,
		context: await context(),
		props: { show: true, onSubmit }
	});
	try {
		await tick();
		const input = document.querySelector('textarea');
		expect(input).not.toBeNull();
		if (!input) throw new Error('Missing actual webpage input');
		input.value = 'https://fixture.invalid\ninvalid\nhttps://fixture.invalid';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		input.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await tick();
		expect(onSubmit).toHaveBeenCalledWith({ type: 'web', data: ['https://fixture.invalid'] });
		expect(input.hasAttribute('type')).toBe(false);
	} finally {
		await unmount(component);
		target.remove();
	}
});

it.each([
	['LTR', 'ltr'],
	['RTL', 'rtl'],
	[undefined, 'auto']
] as const)(
	'normalizes channel text and attachment directions %s/%s',
	async (direction, expected) => {
		settings.set(direction ? { chatDirection: direction } : {});
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(ChannelMessage, {
			target,
			context: await context(),
			props: {
				message: {
					id: 'fixture',
					user_id: 'fixture-user',
					content: 'fixture',
					created_at: 1,
					data: { files: [{ type: 'web', url: 'https://fixture.invalid', name: 'fixture' }] },
					reactions: []
				},
				channel: { id: 'fixture-channel' },
				showUserProfile: false,
				disabled: true
			}
		});
		try {
			await tick();
			const elements = Array.from(target.querySelectorAll('[dir]'));
			expect(elements).toHaveLength(2);
			expect(elements.map((e) => e.getAttribute('dir'))).toEqual([expected, expected]);
		} finally {
			await unmount(component);
			target.remove();
			settings.set({});
		}
	}
);
