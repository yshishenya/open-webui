// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { get, writable } from 'svelte/store';
import { afterEach, expect, it, vi } from 'vitest';
import UserList from '$lib/components/admin/Users/UserList.svelte';
import Banner from '$lib/components/common/Banner.svelte';
import { getUsers } from '$lib/apis/users';
import { adminUserCount, config } from '$lib/stores';
vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
});
vi.mock('$lib/apis/users', () => ({
	getUsers: vi.fn(),
	deleteUserById: vi.fn(),
	updateUserById: vi.fn(),
	getUserGroupsById: vi.fn(),
	getUserInfoById: vi.fn(),
	getUserActiveStatusById: vi.fn(),
	getUserPreview: vi.fn(),
	searchUsers: vi.fn()
}));
afterEach(() => {
	vi.clearAllMocks();
});
const row = {
	id: 'user',
	name: 'Name',
	email: 'user@example.test',
	role: 'user',
	profile_image_url: '/image',
	group_ids: [],
	last_active_at: 1,
	created_at: 1,
	updated_at: 1,
	oauth: null
};
async function context(): Promise<Map<string, object>> {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	return new Map([['i18n', writable(i18n)]]);
}
it('renders real list with absent config and keeps native name sorting', async () => {
	config.set(undefined);
	vi.mocked(getUsers).mockResolvedValue({ users: [row], total: 1 });
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(UserList, { target, context: await context() });
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('user@example.test'));
		const sort = [...target.querySelectorAll('th button')].find(
			(el) => el.textContent?.trim() === 'Name'
		);
		sort?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await tick();
		await vi.waitFor(() => expect(vi.mocked(getUsers).mock.calls.at(-1)?.[2]).toBe('name'));
		const image = target.querySelector<HTMLImageElement>('tbody img');
		image?.dispatchEvent(new Event('error'));
		expect(image?.getAttribute('src')).toBe('/favicon.png');
	} finally {
		await unmount(component);
		target.remove();
	}
});
it('unmount cancels read and prevents late counter updates', async () => {
	let resolve: ((value: { users: (typeof row)[]; total: number }) => void) | undefined;
	vi.mocked(getUsers).mockImplementationOnce(
		() =>
			new Promise((done) => {
				resolve = done;
			})
	);
	adminUserCount.set(7);
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(UserList, { target, context: await context() });
	await tick();
	const signal = vi.mocked(getUsers).mock.calls[0][5];
	await unmount(component);
	expect(signal?.aborted).toBe(true);
	resolve?.({ users: [row], total: 9 });
	await tick();
	await tick();
	expect(get(adminUserCount)).toBe(7);
	target.remove();
});
it('renders inline banner Markdown safely without requiring stored id/timestamp', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Banner, {
		target,
		context: await context(),
		props: {
			banner: {
				type: 'error',
				content: '**Visible**\n<img src=x onerror="evil()"><script>evil()</script>'
			}
		}
	});
	try {
		await vi.waitFor(() => expect(target.querySelector('strong')?.textContent).toBe('Visible'));
		expect(target.querySelector('br')).not.toBeNull();
		expect(target.querySelector('script,[onerror]')).toBeNull();
		target.querySelector<HTMLButtonElement>('button')?.click();
		await tick();
		expect(target.textContent).not.toContain('Visible');
	} finally {
		await unmount(component);
		target.remove();
	}
});
