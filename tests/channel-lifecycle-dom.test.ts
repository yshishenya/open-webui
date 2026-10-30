// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable, get } from 'svelte/store';
import { afterEach, expect, it, vi } from 'vitest';
import ChannelModal from '$lib/components/layout/Sidebar/ChannelModal.svelte';
import ChannelItem from '$lib/components/layout/Sidebar/ChannelItem.svelte';
import { updateChannelMemberActiveStatusById } from '$lib/apis/channels';
import { channels, user } from '$lib/stores';
import type { ChannelListItem } from '$lib/utils/airis/channel-types';
vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
});
vi.mock('$lib/apis/channels', () => ({
	createNewChannel: vi.fn(),
	deleteChannelById: vi.fn(),
	updateChannelById: vi.fn(),
	updateChannelMemberActiveStatusById: vi.fn(),
	getChannelWebhooks: vi.fn(),
	createChannelWebhook: vi.fn(),
	updateChannelWebhook: vi.fn(),
	deleteChannelWebhook: vi.fn()
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({ page: writable({ url: new URL('https://example.test/') }) }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({ activate() {}, deactivate() {}, pause() {}, unpause() {} })
}));
if (!Element.prototype.animate)
	Object.defineProperty(Element.prototype, 'animate', {
		configurable: true,
		value: () => ({ cancel() {}, finished: Promise.resolve(), finish() {}, pause() {}, play() {} })
	});
vi.stubGlobal(
	'ResizeObserver',
	class {
		observe() {}
		disconnect() {}
		unobserve() {}
	}
);
afterEach(() => {
	vi.clearAllMocks();
	channels.set([]);
	user.set(null);
});
async function context(): Promise<Map<string, object>> {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	return new Map([['i18n', writable(i18n)]]);
}
const channel: ChannelListItem = {
	id: 'channel',
	user_id: 'user',
	type: 'dm',
	name: 'Fixture',
	description: null,
	is_private: true,
	data: null,
	meta: null,
	access_grants: [],
	created_at: 1,
	updated_at: 1,
	updated_by: null,
	archived_at: null,
	archived_by: null,
	deleted_at: null,
	deleted_by: null,
	user_ids: [],
	users: [],
	last_message_at: null,
	unread_count: 0
};
it('real channel editor keeps the typed name on refusal and closes after confirmation', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const onSubmit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
	const component = mount(ChannelModal, {
		target,
		context: await context(),
		props: { show: true, onSubmit }
	});
	try {
		await vi.waitFor(() =>
			expect(document.querySelector('input[placeholder="new-channel"]')).not.toBeNull()
		);
		const input = document.querySelector<HTMLInputElement>('input[placeholder="new-channel"]')!;
		input.value = 'draft';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		const submit = () =>
			document
				.querySelector('[role="dialog"] form')!
				.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		submit();
		await tick();
		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
		await vi.waitFor(() =>
			expect(
				document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')?.disabled
			).toBe(false)
		);
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		expect(input.value).toBe('draft');
		submit();
		await tick();
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
		expect(onSubmit).toHaveBeenCalledTimes(2);
	} finally {
		await unmount(component);
		target.remove();
	}
});
it('real DM hiding waits for confirmation, blocks duplicate clicks and keeps the row on false', async () => {
	channels.set([channel]);
	const target = document.createElement('div');
	document.body.append(target);
	let finish!: (ok: boolean) => void;
	vi.mocked(updateChannelMemberActiveStatusById)
		.mockImplementationOnce(
			() =>
				new Promise<boolean>((r) => {
					finish = r;
				})
		)
		.mockResolvedValueOnce(true);
	const component = mount(ChannelItem, { target, context: await context(), props: { channel } });
	try {
		await tick();
		const menu = target.querySelector<HTMLButtonElement>('[aria-label="Conversation options"]')!;
		menu.click();
		await tick();
		const hide = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
			(button) => button.textContent?.includes('Hide conversation')
		)!;
		hide.click();
		await tick();
		expect(get(channels)).toEqual([channel]);
		hide.click();
		await tick();
		expect(updateChannelMemberActiveStatusById).toHaveBeenCalledOnce();
		finish(false);
		await vi.waitFor(() => expect(menu.getAttribute('aria-expanded')).toBe('false'));
		expect(get(channels)).toEqual([channel]);
		menu.click();
		await tick();
		const retry = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
			(button) => button.textContent?.includes('Hide conversation')
		)!;
		expect(retry.disabled).toBe(false);
		retry.click();
		await tick();
		await vi.waitFor(() => expect(get(channels)).toEqual([]));
		expect(updateChannelMemberActiveStatusById).toHaveBeenCalledTimes(2);
	} finally {
		finish?.(false);
		await unmount(component);
		target.remove();
	}
});
