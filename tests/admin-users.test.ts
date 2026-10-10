// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { getUsers } from '$lib/apis/users';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
it.each(['network', 'JSON'])(
	'rejects %s refusal instead of silently resolving null',
	async (kind) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				if (kind === 'network') throw Error('private-detail');
				return new Response('{');
			})
		);
		await expect(getUsers('token')).rejects.toThrow();
	}
);
it.each(['null', '{}', '{"users":null,"total":0}', '{"users":[],"total":-1}'])(
	'rejects invalid user list %s',
	async (body) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(body))
		);
		await expect(getUsers('token')).rejects.toThrow();
	}
);
it('preserves GET/auth/filter/page, default and full server records', async () => {
	const response = {
		users: [{ id: 'one', profile_image_url: '/image', oauth: null, future: 7 }],
		total: 1
	};
	const fetch = vi.fn<[url: string, init: RequestInit], Promise<Response>>(
		async () => new Response(JSON.stringify(response))
	);
	vi.stubGlobal('fetch', fetch);
	await expect(getUsers('token', 'text', 'name', 'desc', 2)).resolves.toEqual(response);
	expect(fetch.mock.calls[0][0]).toBe(
		'/api/v1/users/?page=2&query=text&order_by=name&direction=desc'
	);
	expect(fetch.mock.calls[0][1].method).toBe('GET');
	expect(new Headers(fetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer token');
	expect(fetch.mock.calls[0][1].body).toBeUndefined();
	await getUsers('token');
	expect(fetch.mock.calls[1][0]).toBe('/api/v1/users/?page=1');
});
it('cancels before fetch and keeps the deadline through JSON body reading', async () => {
	vi.useFakeTimers();
	const fetch = vi.fn(async (_url: string, init: RequestInit) => ({
		ok: true,
		json: () =>
			new Promise((_resolve, reject) =>
				init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })
			)
	}));
	vi.stubGlobal('fetch', fetch);
	const pending = expect(getUsers('token')).rejects.toThrow('timed out');
	await vi.advanceTimersByTimeAsync(60_000);
	await pending;
	const abort = new AbortController();
	abort.abort(Error('cancelled'));
	await expect(getUsers('token', undefined, undefined, undefined, 1, abort.signal)).rejects.toThrow(
		'cancelled'
	);
	expect(fetch).toHaveBeenCalledOnce();
	expect(vi.getTimerCount()).toBe(0);
});

function setup(names: string[], context: object): Record<string, () => Promise<void>> {
	const source = readFileSync('src/lib/components/admin/Users/UserList.svelte', 'utf8').match(
		/<script[^>]*>([\s\S]*?)<\/script>/
	)![1];
	const ast = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
	const code =
		names
			.map((name) => {
				const node = ast.statements.find(
					(n) =>
						ts.isVariableStatement(n) &&
						n.declarationList.declarations.some((d) => d.name.getText(ast) === name)
				);
				if (!node) throw Error('Missing handler ' + name);
				return node.getText(ast);
			})
			.join('\n') +
		'\n({' +
		names.join(',') +
		'})';
	return runInNewContext(
		ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
		context
	);
}
it.each([false, null, 'throw'])(
	'failed deletion %s preserves the page and cached row without retry',
	async (result) => {
		const c = {
			active: true,
			users: [{ id: 'one' }],
			page: 2,
			localStorage: { token: 'token' },
			toast: { error: vi.fn() },
			$i18n: { t: (s: string) => s },
			getUserList: vi.fn(),
			deleteUserById: vi.fn(async () => {
				if (result === 'throw') throw Error('private');
				return result;
			})
		};
		const h = setup(['deleteUserHandler'], c);
		await (h.deleteUserHandler as (id: string) => Promise<void>)('one');
		expect(c.page).toBe(2);
		expect(c.users).toEqual([{ id: 'one' }]);
		expect(c.getUserList).not.toHaveBeenCalled();
		expect(c.deleteUserById).toHaveBeenCalledOnce();
	}
);
it('confirmed deletion moves back only when the current page becomes empty', async () => {
	const c = {
		active: true,
		users: [{ id: 'one' }],
		page: 2,
		localStorage: { token: 'token' },
		toast: { error: vi.fn() },
		getUserList: vi.fn(),
		deleteUserById: vi.fn(async () => true)
	};
	const h = setup(['deleteUserHandler'], c);
	await (h.deleteUserHandler as (id: string) => Promise<void>)('one');
	expect(c.page).toBe(1);
	expect(c.deleteUserById).toHaveBeenCalledOnce();
});
it('latest request wins and read failure preserves cached rows with a safe error', async () => {
	const queue: ((value: object) => void)[] = [];
	const c = {
		active: true,
		listAbort: null as AbortController | null,
		AbortController,
		users: [{ id: 'cached' }],
		total: 1,
		query: '',
		orderBy: 'name',
		direction: 'asc',
		page: 1,
		localStorage: { token: 'token' },
		toast: { error: vi.fn() },
		$i18n: { t: (s: string) => s },
		console: { error: vi.fn() },
		adminUserCount: { set: vi.fn() },
		getUsers: vi.fn(() => new Promise((resolve) => queue.push(resolve)))
	};
	const h = setup(['getUserList'], c);
	const first = h.getUserList();
	const second = h.getUserList();
	queue[1]({ users: [{ id: 'new' }], total: 2 });
	await second;
	queue[0]({ users: [{ id: 'old' }], total: 3 });
	await first;
	expect(c.users).toEqual([{ id: 'new' }]);
	expect(c.adminUserCount.set).toHaveBeenCalledOnce();
	c.getUsers.mockImplementationOnce(async () => {
		throw Error('private');
	});
	await h.getUserList();
	expect(c.users).toEqual([{ id: 'new' }]);
	expect(c.toast.error).toHaveBeenCalledOnce();
	expect(JSON.stringify(c.toast.error.mock.calls)).not.toContain('private');
});
it('new search cancels the old read immediately while preserving the existing debounce', async () => {
	vi.useFakeTimers();
	const abort = new AbortController(),
		load = vi.fn();
	const h = setup(['handleSearchInput'], {
		listAbort: abort,
		searchDebounceTimer: undefined,
		setTimeout,
		clearTimeout,
		page: 1,
		getUserList: load
	});
	h.handleSearchInput();
	expect(abort.signal.aborted).toBe(true);
	expect(load).not.toHaveBeenCalled();
	await vi.advanceTimersByTimeAsync(300);
	expect(load).toHaveBeenCalledOnce();
});
