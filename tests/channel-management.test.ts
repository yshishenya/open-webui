// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import {
	getChannelWebhooks,
	createChannelWebhook,
	updateChannelWebhook,
	deleteChannelWebhook,
	getChannelMembersById,
	addMembersById,
	removeMembersById
} from '$lib/apis/channels';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api' }));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
function handlers(
	file: string,
	names: string[],
	context: object
): Record<string, (...args: unknown[]) => Promise<unknown>> {
	const source = readFileSync('src/lib/components/channel/' + file, 'utf8'),
		script = parse(source).instance!;
	const tree = ts.createSourceFile(
		'actual.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest
	);
	const code = tree.statements
		.flatMap((s) =>
			ts.isVariableStatement(s)
				? s.declarationList.declarations
						.filter((d) => names.includes(d.name.getText(tree)))
						.map((d) => 'const ' + d.getText(tree) + ';')
				: []
		)
		.join('\n');
	return runInNewContext(
		ts.transpileModule(code + '\n({' + names.join(',') + '});', {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	);
}
const hook = (id = 'a', name = 'Original') => ({
	id,
	name,
	channel_id: 'channel',
	user_id: 'user',
	token: 'fixture',
	profile_image_url: null,
	last_used_at: null,
	created_at: 1,
	updated_at: 1
});
function webhooks() {
	const c = {
		show: true,
		channel: { id: 'channel' },
		webhookSession: 1,
		loadVersion: 0,
		webhooks: [hook()],
		pendingChanges: {},
		selectedWebhookId: 'a',
		showDeleteConfirmDialog: true,
		isSaving: false,
		isLoading: false,
		localStorage: { token: 'fixture' },
		getChannelWebhooks: vi.fn().mockResolvedValue([hook()]),
		createChannelWebhook: vi.fn(),
		updateChannelWebhook: vi.fn(),
		deleteChannelWebhook: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn() },
		$i18n: { t: (s: string) => s }
	};
	return {
		c,
		run: handlers(
			'WebhooksModal.svelte',
			[
				'isCurrent',
				'loadWebhooks',
				'createHandler',
				'saveHandler',
				'deleteHandler',
				'updatePendingChanges'
			],
			c
		)
	};
}
it('a webhook list refusal preserves cached records and reports the error', async () => {
	const { c, run } = webhooks();
	c.getChannelWebhooks.mockRejectedValue(Error('Offline'));
	await run.loadWebhooks();
	expect(c.webhooks).toEqual([hook()]);
	expect(c.toast.error).toHaveBeenCalledOnce();
	expect(c.isLoading).toBe(false);
});
it('a response from the previous channel cannot replace the current webhook list', async () => {
	const { c, run } = webhooks();
	let finish!: (r: object[]) => void;
	c.getChannelWebhooks.mockImplementationOnce(
		() =>
			new Promise((r) => {
				finish = r;
			})
	);
	const old = run.loadWebhooks();
	c.channel = { id: 'new' };
	c.webhookSession++;
	c.getChannelWebhooks.mockResolvedValueOnce([{ ...hook('b'), channel_id: 'new' }]);
	await run.loadWebhooks();
	finish([hook()]);
	await old;
	expect(c.webhooks.map((w) => w.id)).toEqual(['b']);
	expect(c.isLoading).toBe(false);
});
it('a refused save keeps pending fields without success', async () => {
	const { c, run } = webhooks();
	c.pendingChanges = { a: { name: 'Keep this', profile_image_url: '' } };
	c.updateChannelWebhook.mockRejectedValue(Error('Refused'));
	await run.saveHandler();
	expect(c.pendingChanges).toEqual({ a: { name: 'Keep this', profile_image_url: '' } });
	expect(c.toast.success).not.toHaveBeenCalled();
	expect(c.isSaving).toBe(false);
});
it('a partial save retries only unacknowledged edits', async () => {
	const { c, run } = webhooks();
	c.webhooks = [hook('a'), hook('b')];
	c.pendingChanges = {
		a: { name: 'First', profile_image_url: '' },
		b: { name: 'Second', profile_image_url: '' }
	};
	c.updateChannelWebhook
		.mockResolvedValueOnce(hook('a', 'First'))
		.mockRejectedValueOnce(Error('Refused'))
		.mockResolvedValueOnce(hook('b', 'Second'));
	await run.saveHandler();
	expect(c.pendingChanges).toEqual({ b: { name: 'Second', profile_image_url: '' } });
	expect(c.toast.success).not.toHaveBeenCalled();
	await run.saveHandler();
	expect(c.updateChannelWebhook.mock.calls.map((args) => args[2])).toEqual(['a', 'b', 'b']);
	expect(c.pendingChanges).toEqual({});
	expect(c.toast.success).toHaveBeenCalledOnce();
});
it('a new edit typed during saving remains pending after the older edit is acknowledged', async () => {
	const { c, run } = webhooks();
	c.pendingChanges = { a: { name: 'Sending', profile_image_url: '' } };
	let finish!: (r: object) => void;
	c.updateChannelWebhook.mockImplementation(
		() =>
			new Promise((r) => {
				finish = r;
			})
	);
	const saving = run.saveHandler();
	c.pendingChanges = { a: { name: 'New draft', profile_image_url: '' } };
	finish(hook('a', 'Sending'));
	await saving;
	expect(c.pendingChanges).toEqual({ a: { name: 'New draft', profile_image_url: '' } });
	expect(c.isSaving).toBe(false);
});
it('switching channels during a partial save never sends the remaining edits to the new channel', async () => {
	const { c, run } = webhooks();
	c.pendingChanges = {
		a: { name: 'First', profile_image_url: '' },
		b: { name: 'Second', profile_image_url: '' }
	};
	let finish!: (r: object) => void;
	c.updateChannelWebhook.mockImplementationOnce(
		() =>
			new Promise((r) => {
				finish = r;
			})
	);
	const saving = run.saveHandler();
	c.channel = { id: 'new' };
	c.webhookSession++;
	c.pendingChanges = {};
	finish(hook('a', 'First'));
	await saving;
	expect(c.updateChannelWebhook).toHaveBeenCalledOnce();
	expect(c.toast.success).not.toHaveBeenCalled();
});
it('reverting webhook fields to saved values removes the pending edit', async () => {
	const { c, run } = webhooks();
	await run.updatePendingChanges(hook(), { name: 'Changed', profile_image_url: '' });
	expect(c.pendingChanges).toEqual({ a: { name: 'Changed', profile_image_url: '' } });
	await run.updatePendingChanges(hook(), { name: 'Original', profile_image_url: '' });
	expect(c.pendingChanges).toEqual({});
});
it('a false delete response does not remove the webhook or report success', async () => {
	const { c, run } = webhooks();
	c.deleteChannelWebhook.mockResolvedValue(false);
	await run.deleteHandler();
	expect(c.webhooks).toEqual([hook()]);
	expect(c.toast.success).not.toHaveBeenCalled();
	expect(c.toast.error).toHaveBeenCalledOnce();
	expect(c.isSaving).toBe(false);
});
it('duplicate webhook creation is blocked while its POST is pending', async () => {
	const { c, run } = webhooks();
	let finish!: (r: object) => void;
	c.createChannelWebhook.mockImplementation(
		() =>
			new Promise((r) => {
				finish = r;
			})
	);
	const first = run.createHandler();
	await run.createHandler();
	expect(c.createChannelWebhook).toHaveBeenCalledOnce();
	finish(hook('created'));
	await first;
	expect(c.webhooks.map((w) => w.id)).toEqual(['a', 'created']);
	expect(c.isSaving).toBe(false);
});
const member = (id = 'u') => ({
	id,
	name: id,
	email: id + '@example.test',
	role: 'user',
	profile_image_url: null,
	presence_state: null,
	status_emoji: null,
	status_message: null,
	status_expires_at: null,
	is_active: false
});
function members() {
	const c = {
		channel: { id: 'channel' },
		memberVersion: 0,
		page: 1,
		query: '',
		orderBy: 'name',
		direction: 'asc',
		users: [member('cached')],
		total: 1,
		localStorage: { token: 'fixture' },
		getChannelMembersById: vi.fn(),
		toast: { error: vi.fn() },
		console: { error: vi.fn() }
	};
	return { c, run: handlers('ChannelInfoModal/UserList.svelte', ['getUserList'], c).getUserList };
}
it('a late member page cannot replace the current page', async () => {
	const { c, run } = members();
	let finish!: (r: object) => void;
	c.getChannelMembersById
		.mockImplementationOnce(
			() =>
				new Promise((r) => {
					finish = r;
				})
		)
		.mockResolvedValueOnce({ users: [member('page2')], total: 2 });
	const old = run();
	c.page = 2;
	await run();
	finish({ users: [member('page1')], total: 2 });
	await old;
	expect(c.users.map((u) => u.id)).toEqual(['page2']);
	expect(c.total).toBe(2);
});
it('a member search refusal preserves loaded data', async () => {
	const { c, run } = members();
	c.getChannelMembersById.mockRejectedValue(Error('Offline'));
	await run();
	expect(c.users).toEqual([member('cached')]);
	expect(c.total).toBe(1);
	expect(c.toast.error).toHaveBeenCalledOnce();
});
it('adding members awaits confirmation and blocks another submit', async () => {
	const c = {
		show: true,
		channel: { id: 'channel' },
		loading: false,
		submissionVersion: 0,
		userIds: ['u'],
		groupIds: ['g'],
		localStorage: { token: 'fixture' },
		addMembersById: vi.fn(),
		onUpdate: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn() },
		$i18n: { t: (s: string) => s }
	};
	let finish!: (r: object[]) => void;
	c.addMembersById.mockImplementation(
		() =>
			new Promise((r) => {
				finish = r;
			})
	);
	const run = handlers(
		'ChannelInfoModal/AddMembersModal.svelte',
		['submitHandler'],
		c
	).submitHandler;
	const pending = run();
	expect(c.loading).toBe(true);
	await run();
	expect(c.addMembersById).toHaveBeenCalledOnce();
	expect(c.show).toBe(true);
	finish([]);
	await pending;
	expect(c.show).toBe(false);
	expect(c.loading).toBe(false);
	expect(c.onUpdate).toHaveBeenCalledOnce();
});
it.each(['list', 'create', 'update', 'delete', 'members', 'add', 'remove'])(
	'%s API rejects a network refusal without retry',
	async (mode) => {
		const fetch = vi.fn().mockRejectedValue(Error('Offline'));
		vi.stubGlobal('fetch', fetch);
		const request =
			mode === 'list'
				? getChannelWebhooks('fixture', 'channel')
				: mode === 'create'
					? createChannelWebhook('fixture', 'channel', { name: 'Name' })
					: mode === 'update'
						? updateChannelWebhook('fixture', 'channel', 'a', { name: 'Name' })
						: mode === 'delete'
							? deleteChannelWebhook('fixture', 'channel', 'a')
							: mode === 'members'
								? getChannelMembersById('fixture', 'channel')
								: mode === 'add'
									? addMembersById('fixture', 'channel', { user_ids: ['u'] })
									: removeMembersById('fixture', 'channel', { user_ids: ['u'] });
		await expect(request).rejects.toThrow();
		expect(fetch).toHaveBeenCalledOnce();
	}
);
it.each(['list', 'create', 'update', 'delete', 'members', 'add', 'remove'])(
	'%s API rejects malformed successful data',
	async (mode) => {
		const fetch = vi.fn(async () => new Response('{}'));
		vi.stubGlobal('fetch', fetch);
		const request =
			mode === 'list'
				? getChannelWebhooks('fixture', 'channel')
				: mode === 'create'
					? createChannelWebhook('fixture', 'channel', { name: 'Name' })
					: mode === 'update'
						? updateChannelWebhook('fixture', 'channel', 'a', { name: 'Name' })
						: mode === 'delete'
							? deleteChannelWebhook('fixture', 'channel', 'a')
							: mode === 'members'
								? getChannelMembersById('fixture', 'channel')
								: mode === 'add'
									? addMembersById('fixture', 'channel', {})
									: removeMembersById('fixture', 'channel', { user_ids: ['u'] });
		await expect(request).rejects.toThrow();
		expect(fetch).toHaveBeenCalledOnce();
	}
);
it('accepts the actual webhook and membership response shapes including empty add and zero removal', async () => {
	const fetch = vi
		.fn()
		.mockResolvedValueOnce(new Response(JSON.stringify([hook()])))
		.mockResolvedValueOnce(new Response(JSON.stringify(hook())))
		.mockResolvedValueOnce(new Response(JSON.stringify(hook())))
		.mockResolvedValueOnce(new Response('false'))
		.mockResolvedValueOnce(new Response(JSON.stringify({ users: [member()], total: 1 })))
		.mockResolvedValueOnce(new Response('[]'))
		.mockResolvedValueOnce(new Response('0'));
	vi.stubGlobal('fetch', fetch);
	expect(await getChannelWebhooks('fixture', 'channel')).toEqual([hook()]);
	expect(await createChannelWebhook('fixture', 'channel', { name: 'Original' })).toEqual(hook());
	expect(await updateChannelWebhook('fixture', 'channel', 'a', { name: 'Original' })).toEqual(
		hook()
	);
	expect(await deleteChannelWebhook('fixture', 'channel', 'a')).toBe(false);
	expect((await getChannelMembersById('fixture', 'channel', 'term', 'name', 'asc', 2)).total).toBe(
		1
	);
	expect(await addMembersById('fixture', 'channel', {})).toEqual([]);
	expect(await removeMembersById('fixture', 'channel', { user_ids: ['u'] })).toBe(0);
	expect(fetch.mock.calls[4][0]).toContain('page=2&query=term&order_by=name&direction=asc');
});

it('copying a webhook URL reports success only after clipboard confirmation', async () => {
	const c = {
		webhook: hook(),
		WEBUI_API_BASE_URL: '/api',
		navigator: { clipboard: { writeText: vi.fn() } },
		toast: { success: vi.fn(), error: vi.fn() },
		$i18n: { t: (s: string) => s }
	};
	let finish!: () => void;
	c.navigator.clipboard.writeText.mockImplementationOnce(
		() =>
			new Promise<void>((r) => {
				finish = r;
			})
	);
	const run = handlers('WebhookItem.svelte', ['copyUrl'], c).copyUrl;
	const pending = run();
	expect(c.toast.success).not.toHaveBeenCalled();
	finish();
	await pending;
	expect(c.toast.success).toHaveBeenCalledOnce();
	c.toast.success.mockClear();
	c.navigator.clipboard.writeText.mockRejectedValueOnce(Error('Denied'));
	await run();
	expect(c.toast.success).not.toHaveBeenCalled();
	expect(c.toast.error).toHaveBeenCalledOnce();
});
