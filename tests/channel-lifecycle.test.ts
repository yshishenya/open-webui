// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import {
	getChannels,
	createNewChannel,
	updateChannelById,
	deleteChannelById,
	updateChannelMemberActiveStatusById
} from '$lib/apis/channels';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api' }));
afterEach(() => {
	vi.unstubAllGlobals();
});
function handlers(
	file: string,
	names: string[],
	context: object
): Record<string, (...args: unknown[]) => Promise<unknown>> {
	const source = readFileSync('src/lib/components/layout/' + file, 'utf8'),
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

const calls = [
	['list', () => getChannels('fixture')],
	['create', () => createNewChannel('fixture', { name: 'name' })],
	['update', () => updateChannelById('fixture', 'channel', { name: 'name' })],
	['delete', () => deleteChannelById('fixture', 'channel')],
	['active', () => updateChannelMemberActiveStatusById('fixture', 'channel', false)]
] as const;
it.each(calls)('%s refuses a network error without retry', async (_name, call) => {
	const fetch = vi.fn().mockRejectedValue(Error('Offline'));
	vi.stubGlobal('fetch', fetch);
	await expect(call()).rejects.toThrow();
	expect(fetch).toHaveBeenCalledOnce();
});
it.each(calls)('%s refuses malformed successful data', async (_name, call) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('{}'))
	);
	await expect(call()).rejects.toThrow();
});
it('accepts nullable create/update and boolean acknowledgements including false', async () => {
	vi.stubGlobal(
		'fetch',
		vi
			.fn()
			.mockResolvedValueOnce(new Response('[]'))
			.mockResolvedValueOnce(new Response('null'))
			.mockResolvedValueOnce(new Response('null'))
			.mockResolvedValueOnce(new Response('false'))
			.mockResolvedValueOnce(new Response('false'))
	);
	const values = [];
	for (const [, call] of calls) values.push(await call());
	expect(values).toEqual([[], null, null, false, false]);
});
function modal() {
	const c = {
		show: true,
		loading: false,
		formSession: 1,
		channel: {
			id: 'channel',
			name: 'name',
			type: 'group',
			is_private: true,
			access_grants: [],
			user_ids: ['u']
		},
		name: 'draft',
		type: 'group',
		isPrivate: true,
		accessGrants: [],
		groupIds: ['g'],
		userIds: ['u'],
		onSubmit: vi.fn(),
		onUpdate: vi.fn(),
		$user: { role: 'admin' },
		$page: { url: { pathname: '/channels/channel' } },
		localStorage: { token: 'fixture' },
		channelCreationVersion: 0,
		deleteChannelById: vi.fn(),
		goto: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn() },
		$i18n: { t: (s: string) => s },
		channelTypes: [],
		showDeleteConfirmDialog: true
	};
	return {
		c,
		run: handlers('Sidebar/ChannelModal.svelte', ['submitHandler', 'deleteHandler', 'init'], c)
	};
}
it('false submission keeps the draft and allows retry', async () => {
	const { c, run } = modal();
	c.onSubmit.mockResolvedValue(false);
	await run.submitHandler();
	expect(c.show).toBe(true);
	expect(c.name).toBe('draft');
	expect(c.loading).toBe(false);
	c.onSubmit.mockResolvedValue(true);
	await run.submitHandler();
	expect(c.show).toBe(false);
});
it('a rejected callback releases loading and preserves fields', async () => {
	const { c, run } = modal();
	c.onSubmit.mockRejectedValue(Error('Refused'));
	await run.submitHandler();
	expect(c.show).toBe(true);
	expect(c.loading).toBe(false);
	expect(c.name).toBe('draft');
});
it('submission blocks a second POST until its callback confirms', async () => {
	const { c, run } = modal();
	let finish!: (ok: boolean) => void;
	const response = new Promise<boolean>((r) => {
		finish = r;
	});
	c.onSubmit.mockReturnValue(response);
	const first = run.submitHandler();
	const second = run.submitHandler();
	try {
		expect(c.onSubmit).toHaveBeenCalledOnce();
	} finally {
		finish(true);
	}
	await Promise.all([first, second]);
	expect(c.show).toBe(false);
});
it('an old submission cannot close a replacement window', async () => {
	const { c, run } = modal();
	let finish!: (ok: boolean) => void;
	c.onSubmit.mockImplementation(
		() =>
			new Promise<boolean>((r) => {
				finish = r;
			})
	);
	const old = run.submitHandler();
	c.formSession++;
	c.loading = false;
	c.name = 'replacement';
	finish(true);
	await old;
	expect(c.show).toBe(true);
	expect(c.name).toBe('replacement');
});
it('false deletion keeps the channel window and reports no success', async () => {
	const { c, run } = modal();
	c.deleteChannelById.mockResolvedValue(false);
	await run.deleteHandler();
	expect(c.show).toBe(true);
	expect(c.toast.success).not.toHaveBeenCalled();
	expect(c.onUpdate).not.toHaveBeenCalled();
});
it('confirmed deletion is not repeated after a failed list refresh', async () => {
	const { c, run } = modal();
	c.deleteChannelById.mockResolvedValue(true);
	c.onUpdate.mockRejectedValue(Error('Refresh'));
	await run.deleteHandler();
	expect(c.show).toBe(false);
	expect(c.deleteChannelById).toHaveBeenCalledOnce();
	expect(c.toast.success).toHaveBeenCalledOnce();
});
it('initializing an editor copies arrays instead of changing saved access/members', async () => {
	const { c, run } = modal();
	await run.init();
	expect(c.userIds).toEqual(['u']);
	expect(c.userIds).not.toBe(c.channel.user_ids);
	expect(c.accessGrants).not.toBe(c.channel.access_grants);
});
// Execute the actual onSubmit expression in each ChannelModal caller, before and after extraction.
function caller(file: string, c: object) {
	const source = readFileSync('src/lib/components/layout/' + file, 'utf8'),
		ast = parse(source);
	const component = ast.html.children.find(
		(n: { type: string; name?: string }) =>
			n.type === 'InlineComponent' && n.name === 'ChannelModal'
	);
	const attribute = component.attributes.find((a: { name: string }) => a.name === 'onSubmit');
	const expression = attribute.value[0].expression;
	const raw = source.slice(expression.start, expression.end);
	if (expression.type === 'Identifier') {
		const result = handlers(file, [raw], c);
		return result[raw];
	}
	return runInNewContext(
		ts.transpileModule('(' + raw + ')', { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
			.outputText,
		c
	) as (data: object) => Promise<boolean>;
}
it('the creation caller reports false on validation/write refusal', async () => {
	const c = {
		localStorage: { token: 'fixture' },
		channelCreationVersion: 0,
		$i18n: { t: (s: string) => s },
		toast: { error: vi.fn() },
		createNewChannel: vi.fn().mockRejectedValue(Error('Refused'))
	};
	const run = caller('Sidebar.svelte', c);
	expect(await run({ type: 'group', name: '' })).toBe(false);
	expect(c.createNewChannel).not.toHaveBeenCalled();
	expect(await run({ type: 'group', name: 'draft' })).toBe(false);
	expect(c.createNewChannel).toHaveBeenCalledOnce();
});
it('the creation caller retains acknowledgement if list refresh fails', async () => {
	const c = {
		localStorage: { token: 'fixture' },
		channelCreationVersion: 0,
		$user: { token: 'fixture' },
		$socket: { emit: vi.fn() },
		showCreateChannel: true,
		showChannels: false,
		toast: { error: vi.fn() },
		createNewChannel: vi.fn().mockResolvedValue({ id: 'channel' }),
		initChannels: vi.fn().mockRejectedValue(Error('Refresh')),
		goto: vi.fn()
	};
	const run = caller('Sidebar.svelte', c);
	expect(await run({ type: 'group', name: 'draft' })).toBe(true);
	expect(c.createNewChannel).toHaveBeenCalledOnce();
	expect(c.goto).toHaveBeenCalledWith('/channels/channel');
});
it('the edit caller preserves refusal and returns true after an acknowledged write', async () => {
	const c = {
		channel: { id: 'channel' },
		localStorage: { token: 'fixture' },
		channelCreationVersion: 0,
		$i18n: { t: (s: string) => s },
		toast: { error: vi.fn(), success: vi.fn() },
		updateChannelById: vi
			.fn()
			.mockRejectedValueOnce(Error('Refused'))
			.mockResolvedValueOnce({ id: 'channel' }),
		onUpdate: vi.fn().mockRejectedValue(Error('Refresh'))
	};
	const run = caller('Sidebar/ChannelItem.svelte', c);
	expect(await run({ name: 'draft' })).toBe(false);
	expect(c.onUpdate).not.toHaveBeenCalled();
	expect(await run({ name: 'draft' })).toBe(true);
	expect(c.updateChannelById).toHaveBeenCalledTimes(2);
});

it('accepts actual non-null channel models and rejects another channel in update acknowledgement', async () => {
	const record = {
		id: 'channel',
		user_id: 'user',
		name: 'Name',
		type: 'group',
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
		deleted_by: null
	};
	const list = { ...record, user_ids: null, users: null, last_message_at: null, unread_count: 0 };
	const fetch = vi
		.fn()
		.mockResolvedValueOnce(new Response(JSON.stringify([list])))
		.mockResolvedValueOnce(new Response(JSON.stringify(record)))
		.mockResolvedValueOnce(new Response(JSON.stringify(record)))
		.mockResolvedValueOnce(new Response('true'))
		.mockResolvedValueOnce(new Response('true'))
		.mockResolvedValueOnce(new Response(JSON.stringify({ ...record, id: 'wrong' })));
	vi.stubGlobal('fetch', fetch);
	const values = [];
	for (const [, call] of calls) values.push(await call());
	expect(values).toEqual([[list], record, record, true, true]);
	await expect(updateChannelById('fixture', 'channel', { name: 'name' })).rejects.toThrow();
	expect(fetch.mock.calls[3][1].method).toBe('DELETE');
	expect(JSON.parse(fetch.mock.calls[4][1].body)).toEqual({ is_active: false });
});
it('an old creation acknowledgement does not navigate a replacement window', async () => {
	let finish!: (value: object) => void;
	const c = {
		localStorage: { token: 'fixture' },
		channelCreationVersion: 0,
		$user: { token: 'fixture' },
		$socket: { emit: vi.fn() },
		showCreateChannel: true,
		showChannels: false,
		toast: { error: vi.fn() },
		createNewChannel: vi.fn(
			() =>
				new Promise<object>((r) => {
					finish = r;
				})
		),
		initChannels: vi.fn(),
		goto: vi.fn()
	};
	const run = caller('Sidebar.svelte', c);
	const pending = run({ type: 'group', name: 'draft' });
	c.channelCreationVersion++;
	finish({ id: 'channel' });
	expect(await pending).toBe(true);
	expect(c.goto).not.toHaveBeenCalled();
});
