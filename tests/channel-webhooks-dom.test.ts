// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, expect, it, vi } from 'vitest';
import WebhooksModal from '$lib/components/channel/WebhooksModal.svelte';
import { getChannelWebhooks, updateChannelWebhook } from '$lib/apis/channels';
import { toast } from 'svelte-sonner';
import type { ChannelListItem } from '$lib/utils/airis/channel-types';
vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
});
vi.mock('$lib/apis/channels', () => ({
	getChannelWebhooks: vi.fn(),
	createChannelWebhook: vi.fn(),
	updateChannelWebhook: vi.fn(),
	deleteChannelWebhook: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({ activate() {}, deactivate() {}, pause() {}, unpause() {} })
}));
afterEach(() => {
	vi.clearAllMocks();
});
const webhook = {
	id: 'a',
	channel_id: 'channel',
	user_id: 'user',
	name: 'Original',
	token: 'fixture',
	profile_image_url: null,
	last_used_at: null,
	created_at: 1,
	updated_at: 1
};
const channel: ChannelListItem = {
	id: 'channel',
	user_id: 'user',
	type: 'group',
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
it('real webhook fields can be reverted, survive a refused save and retry once', async () => {
	vi.mocked(getChannelWebhooks).mockResolvedValue([webhook]);
	vi.mocked(updateChannelWebhook)
		.mockRejectedValueOnce(Error('Refused'))
		.mockResolvedValueOnce({ ...webhook, name: 'Changed' });
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(WebhooksModal, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: { show: true, channel }
	});
	try {
		await vi.waitFor(() =>
			expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Original')
		);
		const row = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
			(el) => el.textContent?.includes('Original')
		)!;
		row.click();
		await tick();
		const input = document.querySelector<HTMLInputElement>('input[placeholder="Webhook Name"]')!;
		const edit = async (name: string) => {
			input.value = name;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
		};
		const submit = async () => {
			document
				.querySelector('[role="dialog"] form')!
				.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
			await tick();
		};
		await edit('Changed');
		await edit('Original');
		await submit();
		expect(updateChannelWebhook).not.toHaveBeenCalled();
		vi.mocked(toast.success).mockClear();
		await edit('Changed');
		await submit();
		await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
		expect(input.value).toBe('Changed');
		expect(toast.success).not.toHaveBeenCalled();
		await submit();
		await vi.waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
		expect(updateChannelWebhook).toHaveBeenCalledTimes(2);
		await submit();
		expect(updateChannelWebhook).toHaveBeenCalledTimes(2);
		expect(getChannelWebhooks).toHaveBeenCalledOnce();
	} finally {
		await unmount(component);
		target.remove();
	}
});
