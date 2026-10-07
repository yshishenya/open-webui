// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as api from '$lib/apis/folders';

vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: 'http://local.test/api/v1' }));

const calls: Array<[string, () => Promise<unknown>]> = [
	['create', () => api.createNewFolder('fixture', { name: 'Folder' })],
	['list', () => api.getFolders('fixture')],
	['get', () => api.getFolderById('fixture', 'folder')],
	['update', () => api.updateFolderById('fixture', 'folder', { name: 'Renamed' })],
	['expanded', () => api.updateFolderIsExpandedById('fixture', 'folder', false)],
	['parent', () => api.updateFolderParentIdById('fixture', 'folder', null)],
	['delete', () => api.deleteFolderById('fixture', 'folder', false)],
	['read', () => api.markFolderChatsReadById('fixture', 'folder')],
	['access', () => api.updateFolderAccessById('fixture', 'folder', [])],
	['shared', () => api.getSharedFolders('fixture')],
	['shared chats', () => api.getSharedFolderChats('fixture', 'folder', { page: 2 })]
];

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it.each(calls)(
	'%s rejects transport, abort, parse and HTTP failures without fabricating success',
	async (_name, call) => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		for (const error of [
			new TypeError('Failed to fetch'),
			new DOMException('Cancelled', 'AbortError')
		]) {
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
			await expect(call()).rejects.toBe(error);
		}
		const parseError = new SyntaxError('Invalid JSON');
		for (const ok of [true, false]) {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({ ok, json: () => Promise.reject(parseError) })
			);
			await expect(call()).rejects.toBe(parseError);
		}
		for (const payload of [
			{ detail: 'Access prohibited' },
			{ detail: '' },
			{ detail: null },
			{ message: 'Gateway failure' }
		]) {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve(payload) })
			);
			await expect(call()).rejects.toEqual(
				'detail' in payload ? (payload.detail ?? payload) : payload
			);
		}
		const result = { extension: { preserved: true } };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(result) })
		);
		await expect(call()).resolves.toBe(result);
	}
);

it('returns a real empty folder list, while a rejected reload leaves existing folders untouched', async () => {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));
	await expect(api.getFolders('fixture')).resolves.toEqual([]);
	const existing = [{ id: 'folder', name: 'Folder', created_at: 1, updated_at: 1 }];
	let folders = existing;
	vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')));
	const res = await api.getFolders('fixture').catch(() => null);
	if (res) folders = res;
	expect(folders).toBe(existing);
});

it('the actual Sidebar loader retains owned and shared folders on failure and can reload', async () => {
	const source = readFileSync('src/lib/components/layout/Sidebar.svelte', 'utf8')
		.split('<script lang="ts">')[1]
		.split('</script>')[0];
	const ast = ts.createSourceFile('sidebar.ts', source, ts.ScriptTarget.Latest);
	const declaration = ast.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => [...statement.declarationList.declarations])
		.find((node) => node.name.getText(ast) === 'initFolders');
	if (!declaration?.initializer) throw new Error('Sidebar loader missing');
	const owned = { id: 'owned', name: 'Owned', created_at: 1, updated_at: 2 };
	const shared = { id: 'shared', name: 'Shared', created_at: 1, updated_at: 1 };
	const folders = { owned, shared };
	const context = {
		$config: { features: {} },
		localStorage: { token: 'fixture' },
		folders,
		_folders: { set: vi.fn() },
		newFolderId: null,
		sharedFolders: [shared],
		getFolders: vi
			.fn()
			.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
			.mockResolvedValue([owned]),
		getSharedFolders: vi
			.fn()
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockResolvedValue([]),
		toast: { error: vi.fn() }
	};
	const load = runInNewContext(
		ts.transpileModule(`(${declaration.initializer.getText(ast)})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as () => Promise<void>;
	await load();
	expect(context.folders).toBe(folders);
	expect(context._folders.set).not.toHaveBeenCalled();
	await load();
	expect(context.folders).toMatchObject({ owned, shared: { ...shared, shared: true } });
	expect(context.sharedFolders).toEqual([shared]);
	await load();
	expect(context.sharedFolders).toEqual([]);
	expect(context.folders).toEqual({ owned });
});

it.each(['AtCommands', 'Knowledge'])(
	'the actual %s suggestion loader accepts an unavailable folders cache',
	async (component) => {
		const source = readFileSync(
			`src/lib/components/chat/MessageInput/Commands/${component}.svelte`,
			'utf8'
		)
			.split('<script lang="ts">')[1]
			.split('</script>')[0];
		const ast = ts.createSourceFile('commands.ts', source, ts.ScriptTarget.Latest);
		const declaration = ast.statements
			.filter(ts.isVariableStatement)
			.flatMap((statement) => [...statement.declarationList.declarations])
			.find((node) => node.name.getText(ast) === 'getFolderItems');
		if (!declaration?.initializer) throw new Error('Suggestion loader missing');
		const context = {
			$folders: null,
			folderItems: [],
			query: 'folder',
			$i18n: { t: () => 'Folder' }
		};
		const load = runInNewContext(
			ts.transpileModule(`(${declaration.initializer.getText(ast)})`, {
				compilerOptions: { target: ts.ScriptTarget.ES2022 }
			}).outputText,
			context
		) as () => void | Promise<void>;
		await load();
		expect(context.folderItems).toEqual([]);
		expect(context.$folders).toBeNull();
	}
);
