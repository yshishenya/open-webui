// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { createInstance } from 'i18next';
import { DEFAULT_PERMISSIONS } from '$lib/constants/permissions';
import Groups from '$lib/components/admin/Users/Groups.svelte';
import GroupItem from '$lib/components/admin/Users/Groups/GroupItem.svelte';
import GroupFormHarness from './fixtures/GroupFormHarness.svelte';

const api = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	remove: vi.fn(),
	list: vi.fn(),
	defaults: vi.fn(),
	stock: vi.fn(),
	updateDefaults: vi.fn(),
	users: vi.fn(),
	addMember: vi.fn(),
	removeMember: vi.fn(),
	preview: vi.fn(),
	success: vi.fn(),
	error: vi.fn()
}));
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
vi.mock('$lib/apis/groups', () => ({
	createNewGroup: api.create,
	updateGroupById: api.update,
	deleteGroupById: api.remove,
	getGroups: api.list,
	addUserToGroup: api.addMember,
	removeUserFromGroup: api.removeMember,
	getGroupPreview: api.preview
}));
vi.mock('$lib/apis/users', () => ({
	getUserDefaultPermissions: api.defaults,
	getUserDefaultPermissionsDefaults: api.stock,
	updateUserDefaultPermissions: api.updateDefaults,
	getUsers: api.users
}));
vi.mock('svelte-sonner', () => ({ toast: { success: api.success, error: api.error } }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({
		activate: vi.fn(),
		deactivate: vi.fn(),
		pause: vi.fn(),
		unpause: vi.fn()
	})
}));
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		config: writable({}),
		settings: writable({}),
		user: writable({ role: 'admin' }),
		adminGroupCount: writable(0)
	};
});
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return { page: writable({ url: new URL('http://localhost/admin/users/groups') }) };
});

const storedGroup = {
	id: 'group-1',
	user_id: 'admin-1',
	name: 'Editors',
	description: 'Original',
	data: { config: { share: false, future_option: 7 }, future_data: 'keep' },
	meta: null,
	permissions: { chat: { controls: false }, workspace: null },
	member_count: 1,
	created_at: 1,
	updated_at: 1
};
let component: Record<string, unknown> | null = null;
let target: HTMLDivElement | null = null;

async function settle(): Promise<void> {
	for (let index = 0; index < 6; index++) await tick();
}
async function render(
	kind: 'form' | 'groups' | 'item' = 'form',
	props: Record<string, unknown> = {}
): Promise<void> {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	target = document.createElement('div');
	document.body.append(target);
	const context = new Map([['i18n', writable(i18n)]]);
	if (kind === 'groups') component = mount(Groups, { target, context });
	else if (kind === 'item')
		component = mount(GroupItem, {
			target,
			context,
			props: { group: structuredClone(storedGroup), ...props }
		});
	else component = mount(GroupFormHarness, { target, context, props: { props } });
	await settle();
}
function button(label: string): HTMLButtonElement {
	if (label === 'Save') {
		const saveButton = document.body.querySelector<HTMLButtonElement>('button[type="submit"]');
		if (saveButton) return saveButton;
	}
	const match = [...document.body.querySelectorAll('button')].find(
		(element) => element.textContent?.trim() === label
	);
	if (!match) throw new Error(`Missing button: ${label}`);
	return match;
}
async function click(label: string): Promise<void> {
	button(label).click();
	await settle();
}
function nameInput(): HTMLInputElement {
	const input = document.body.querySelector<HTMLInputElement>('input[placeholder="Group Name"]');
	if (!input) throw new Error('Missing group name');
	return input;
}
async function editName(value: string): Promise<void> {
	nameInput().value = value;
	nameInput().dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
}
async function save(): Promise<void> {
	document.body
		.querySelector('form')
		?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	await settle();
}

beforeEach(() => {
	vi.clearAllMocks();
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
	localStorage.token = 'test-token';
	api.list.mockResolvedValue([structuredClone(storedGroup)]);
	api.create.mockResolvedValue(storedGroup);
	api.update.mockResolvedValue(storedGroup);
	api.remove.mockResolvedValue(true);
	api.defaults.mockResolvedValue({ chat: { controls: true } });
	api.stock.mockResolvedValue({ chat: { controls: false } });
	api.updateDefaults.mockResolvedValue({ chat: { controls: false } });
	api.users.mockResolvedValue({
		users: [
			{
				id: 'user-1',
				name: 'Reader',
				email: 'reader@example.test',
				role: 'user',
				last_active_at: 1,
				group_ids: []
			}
		],
		total: 1
	});
});
afterEach(async () => {
	if (component) await unmount(component);
	target?.remove();
	component = null;
	target = null;
});

describe('group save lifecycle', () => {
	it('retains failed create edits and permits a successful retry', async () => {
		api.create.mockRejectedValueOnce('Create rejected');
		await render('groups');
		await click('New Group');
		await editName('New team');
		await save();
		expect(api.create).toHaveBeenCalledTimes(1);
		expect(nameInput().value).toBe('New team');
		expect(button('Save').disabled).toBe(false);
		expect(api.error).toHaveBeenCalledWith('Create rejected');
		await save();
		expect(api.create).toHaveBeenCalledTimes(2);
		expect(document.body.querySelector('input[placeholder="Group Name"]')).toBeNull();
	});
	it('retains failed update edits and preserved data/permissions', async () => {
		api.update.mockRejectedValueOnce('Update rejected');
		await render('item');
		document.body.querySelector<HTMLButtonElement>('button.group')?.click();
		await settle();
		await editName('Renamed');
		await save();
		expect(nameInput().value).toBe('Renamed');
		expect(button('Save').disabled).toBe(false);
		expect(api.update.mock.calls[0][2]).toMatchObject({
			name: 'Renamed',
			data: storedGroup.data,
			permissions: { chat: { controls: false }, workspace: DEFAULT_PERMISSIONS.workspace }
		});
	});
	it('retains failed default permission edits', async () => {
		api.updateDefaults.mockRejectedValueOnce('Defaults rejected');
		await render('groups');
		document.body.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
		await settle();
		await save();
		expect(button('Save').disabled).toBe(false);
		expect(api.error).toHaveBeenCalledWith('Defaults rejected');
	});
	it('waits for delete and keeps the group open on failure', async () => {
		api.remove.mockRejectedValueOnce('Delete rejected');
		await render('item');
		document.body.querySelector<HTMLButtonElement>('button.group')?.click();
		await settle();
		await editName('Unsaved name');
		await click('Delete');
		await click('Confirm');
		expect(api.remove).toHaveBeenCalledTimes(1);
		expect(nameInput().value).toBe('Unsaved name');
	});
	it('closes after committed create even when refresh fails', async () => {
		await render('groups');
		await click('New Group');
		await editName('Created once');
		api.list.mockRejectedValueOnce('Refresh rejected');
		await save();
		expect(api.create).toHaveBeenCalledTimes(1);
		expect(document.body.querySelector('input[placeholder="Group Name"]')).toBeNull();
		expect(api.error).toHaveBeenCalledWith('Refresh rejected');
	});
	it('does not expose users/preview tabs for an unsaved group', async () => {
		await render('form', { tabs: ['general', 'permissions', 'users', 'preview'] });
		expect(
			[...document.body.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Users')
		).toBe(false);
		expect(
			[...document.body.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Preview')
		).toBe(false);
		expect(api.users).not.toHaveBeenCalled();
		expect(api.preview).not.toHaveBeenCalled();
	});
});

describe('group membership and defaults', () => {
	it('adds and removes a member using the saved group ID', async () => {
		api.addMember.mockResolvedValue(storedGroup);
		api.removeMember.mockResolvedValue(storedGroup);
		await render('form', { group: storedGroup, tabs: ['users'] });
		let checkbox = document.body.querySelector<HTMLButtonElement>('button[role="checkbox"]');
		expect(checkbox?.getAttribute('aria-checked')).toBe('false');
		api.users.mockResolvedValueOnce({
			users: [
				{
					id: 'user-1',
					name: 'Reader',
					email: 'reader@example.test',
					role: 'user',
					last_active_at: 1,
					group_ids: ['group-1']
				}
			],
			total: 1
		});
		checkbox?.click();
		await settle();
		expect(api.addMember).toHaveBeenCalledWith('test-token', 'group-1', ['user-1']);
		checkbox = document.body.querySelector<HTMLButtonElement>('button[role="checkbox"]');
		expect(checkbox?.getAttribute('aria-checked')).toBe('true');
		checkbox?.click();
		await settle();
		expect(api.removeMember).toHaveBeenCalledWith('test-token', 'group-1', ['user-1']);
		expect(
			document.body.querySelector('button[role="checkbox"]')?.getAttribute('aria-checked')
		).toBe('false');
	});
	it('restores the membership checkbox after a rejected change', async () => {
		api.addMember.mockRejectedValueOnce('Member rejected');
		await render('form', { group: storedGroup, tabs: ['users'] });
		document.body.querySelector<HTMLButtonElement>('button[role="checkbox"]')?.click();
		await settle();
		expect(api.error).toHaveBeenCalledWith('Member rejected');
		expect(
			document.body.querySelector('button[role="checkbox"]')?.getAttribute('aria-checked')
		).toBe('false');
	});
	it.each([true, false])(
		'resets custom=%s to the correct defaults without saving',
		async (custom) => {
			const submit = vi.fn().mockResolvedValue(true);
			await render('form', { group: storedGroup, tabs: ['permissions'], custom, onSubmit: submit });
			await click('Reset to Defaults');
			await click('Confirm');
			expect(submit).not.toHaveBeenCalled();
			expect(custom ? api.defaults : api.stock).toHaveBeenCalledTimes(1);
			expect(custom ? api.stock : api.defaults).not.toHaveBeenCalled();
			await save();
			expect(submit.mock.calls[0][0].permissions.chat.controls).toBe(custom);
		}
	);
	it('accepts null stored dictionaries and preserves stock defaults after a real switch edit', async () => {
		const before = JSON.stringify(DEFAULT_PERMISSIONS);
		const submit = vi.fn().mockResolvedValue(true);
		await render('form', {
			group: { ...storedGroup, data: null, permissions: null },
			tabs: ['permissions'],
			onSubmit: submit
		});
		document.body
			.querySelector<HTMLButtonElement>('button[role="switch"][aria-label="Models Access"]')
			?.click();
		await settle();
		await save();
		expect(submit.mock.calls[0][0]).toMatchObject({
			data: {},
			permissions: { workspace: { models: true } }
		});
		expect(JSON.stringify(DEFAULT_PERMISSIONS)).toBe(before);
	});
});

describe('group operation boundaries', () => {
	it('releases loading after a thrown callback and preserves the edited form', async () => {
		const submit = vi.fn().mockRejectedValueOnce('Unexpected failure').mockResolvedValueOnce(true);
		await render('form', { onSubmit: submit });
		await editName('Retained');
		await save();
		expect(api.error).toHaveBeenCalledWith('Unexpected failure');
		expect(nameInput().value).toBe('Retained');
		expect(button('Save').disabled).toBe(false);
		await save();
		expect(target?.querySelector('output')?.textContent).toBe('false');
	});
	it('keeps legacy callbacks returning void compatible', async () => {
		const submit = vi.fn();
		await render('form', { onSubmit: submit });
		await editName('Legacy');
		await save();
		expect(submit).toHaveBeenCalledTimes(1);
		expect(target?.querySelector('output')?.textContent).toBe('false');
	});
	it('prevents duplicate submissions while the first request is pending', async () => {
		let resolveWrite: (value: boolean) => void = () => {};
		const submit = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					resolveWrite = resolve;
				})
		);
		await render('form', { onSubmit: submit });
		await editName('Single');
		await save();
		expect(button('Save').disabled).toBe(true);
		await save();
		expect(submit).toHaveBeenCalledTimes(1);
		resolveWrite(true);
		await settle();
		expect(target?.querySelector('output')?.textContent).toBe('false');
	});
	it('treats a null mutation response as failure', async () => {
		api.create.mockResolvedValueOnce(null);
		await render('groups');
		await click('New Group');
		await editName('Not saved');
		await save();
		expect(nameInput().value).toBe('Not saved');
		expect(api.success).not.toHaveBeenCalled();
		expect(api.error).toHaveBeenCalledTimes(1);
	});
	it('preserves committed membership when refresh fails', async () => {
		api.addMember.mockResolvedValue(storedGroup);
		await render('form', { group: storedGroup, tabs: ['users'] });
		api.users.mockRejectedValueOnce('List unavailable');
		document.body.querySelector<HTMLButtonElement>('button[role="checkbox"]')?.click();
		await settle();
		expect(
			document.body.querySelector('button[role="checkbox"]')?.getAttribute('aria-checked')
		).toBe('true');
		expect(
			document.body.querySelector<HTMLButtonElement>('button[role="checkbox"]')?.disabled
		).toBe(false);
		expect(api.error).toHaveBeenCalledWith('List unavailable');
	});
	it('preserves false and true sharing values alongside unrelated data', async () => {
		const submit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		await render('form', { group: structuredClone(storedGroup), onSubmit: submit });
		const select = document.body.querySelector('select');
		if (!select) throw new Error('Missing sharing selector');
		select.value = 'true';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		await save();
		expect(submit.mock.calls[0][0].data).toEqual({
			config: { share: true, future_option: 7 },
			future_data: 'keep'
		});
		select.value = 'false';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		await save();
		expect(submit.mock.calls[1][0].data).toEqual(storedGroup.data);
	});
});

describe('saved group lifecycle', () => {
	it.each(['update', 'delete'])(
		'closes a successful %s even when parent refresh throws',
		async (operation) => {
			const refresh = vi.fn().mockRejectedValue('Refresh unavailable');
			await render('item', { setGroups: refresh });
			document.body.querySelector<HTMLButtonElement>('button.group')?.click();
			await settle();
			if (operation === 'delete') {
				await click('Delete');
				await click('Confirm');
			} else await save();
			expect(operation === 'delete' ? api.remove : api.update).toHaveBeenCalledTimes(1);
			expect(refresh).toHaveBeenCalledTimes(1);
			await vi.waitFor(() =>
				expect(document.body.querySelector('input[placeholder="Group Name"]')).toBeNull()
			);
			expect(api.error).toHaveBeenCalledWith('Refresh unavailable');
		}
	);
	it('closes committed default permission writes when refresh fails', async () => {
		await render('groups');
		document.body.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
		await settle();
		api.defaults.mockRejectedValueOnce('Defaults refresh unavailable');
		await save();
		expect(api.updateDefaults).toHaveBeenCalledTimes(1);
		expect(document.body.querySelector('button[type="submit"]')).toBeNull();
		expect(api.error).toHaveBeenCalledWith('Defaults refresh unavailable');
	});
	it('restores a checked member after a rejected removal', async () => {
		api.users.mockResolvedValue({
			users: [
				{
					id: 'user-1',
					name: 'Reader',
					email: 'reader@example.test',
					role: 'user',
					last_active_at: 1,
					group_ids: ['group-1']
				}
			],
			total: 1
		});
		api.removeMember.mockRejectedValueOnce('Removal rejected');
		await render('form', { group: storedGroup, tabs: ['users'] });
		document.body.querySelector<HTMLButtonElement>('button[role="checkbox"]')?.click();
		await settle();
		expect(
			document.body.querySelector('button[role="checkbox"]')?.getAttribute('aria-checked')
		).toBe('true');
		expect(api.error).toHaveBeenCalledWith('Removal rejected');
	});
	it('keeps defaults intact after a reset request fails', async () => {
		const submit = vi.fn().mockResolvedValue(true);
		api.defaults.mockRejectedValueOnce('Reset rejected');
		await render('form', { group: storedGroup, tabs: ['permissions'], onSubmit: submit });
		await click('Reset to Defaults');
		await click('Confirm');
		await save();
		expect(submit.mock.calls[0][0].permissions.chat.controls).toBe(false);
		expect(api.error).toHaveBeenCalledWith('Reset rejected');
	});
});

it('does not change stored group data before save or after cancel', async () => {
	const group = structuredClone(storedGroup);
	const before = structuredClone(group.data);
	await render('form', { group });
	const select = document.body.querySelector('select');
	if (!select) throw new Error('Missing sharing selector');
	select.value = 'true';
	select.dispatchEvent(new Event('change', { bubbles: true }));
	await settle();
	expect(group.data).toEqual(before);
});
