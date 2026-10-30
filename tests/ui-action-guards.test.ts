// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { safeLinkUrl } from '$lib/utils';

const script = (file: string): string => {
	const text = readFileSync(file, 'utf8').split('<script lang="ts">')[1].split('</script>')[0];
	const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	return ast.statements
		.filter((node) => !ts.isImportDeclaration(node))
		.map((node) => node.getText(ast).replace(/^export /, ''))
		.join('\n');
};
const evaluate = <T>(source: string, context: Record<string, unknown>): T =>
	runInNewContext(
		ts.transpileModule(source, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		Object.assign(context, { safeLinkUrl })
	) as T;
const deferred = <T = object>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
const folder = (id: string) => ({ id, name: id, meta: { icon: id } });
type Folder = ReturnType<typeof folder>;
const folderRig = () => {
	const update = vi.fn(async () => ({}));
	const remove = vi.fn(async () => true);
	const chats = vi.fn(async () => [{ id: 'chat' }]);
	const read = vi.fn(async () => ({}));
	const selected = vi.fn(),
		deleted = vi.fn(),
		changed = vi.fn(),
		save = vi.fn();
	const destroy: (() => void)[] = [];
	const api = evaluate<{
		icon: (name: string) => Promise<void>;
		rename: (form: { name: string }) => Promise<boolean>;
		remove: () => Promise<void>;
		export: () => Promise<void>;
		select: (value: Folder | null) => void;
	}>(
		script('src/lib/components/chat/Placeholder/FolderTitle.svelte') +
			`
	onDelete = deleted; onUpdate = changed;
	({icon: updateIconHandler, rename: updateHandler, remove: deleteHandler, export: exportHandler, select: (value) => { folder = value; }})`,
		{
			getContext: () => ({}),
			$i18n: { t: (value: string) => value },
			onDestroy: (callback: () => void) => destroy.push(callback),
			fileSaver: { saveAs: save },
			localStorage: { token: 'fixture' },
			Blob,
			Date,
			toast: { error: vi.fn(), success: vi.fn() },
			selectedFolder: { set: selected },
			updateFolderById: update,
			deleteFolderById: remove,
			getChatsByFolderId: chats,
			getFolderById: read,
			createNewFolder: vi.fn(),
			deleted,
			changed
		}
	);
	return { api, update, remove, chats, read, selected, deleted, changed, save, destroy };
};

it.each(['icon', 'remove', 'export'] as const)(
	'ignores %s when the folder is absent',
	async (action) => {
		const r = folderRig();
		if (action === 'icon') await r.api.icon('icon');
		else await r.api[action]();
		expect(r.update).not.toHaveBeenCalled();
		expect(r.remove).not.toHaveBeenCalled();
		expect(r.chats).not.toHaveBeenCalled();
	}
);

it.each([
	['icon', 'update', 'selection'],
	['icon', 'update', 'destruction'],
	['icon', 'read', 'selection'],
	['icon', 'read', 'destruction'],
	['rename', 'update', 'selection'],
	['rename', 'update', 'destruction'],
	['rename', 'read', 'selection'],
	['rename', 'read', 'destruction']
] as const)('discards a late folder %s at %s after %s', async (action, phase, mode) => {
	const r = folderRig(),
		waiting = deferred(),
		original = folder('original'),
		next = folder('next');
	r.api.select(original);
	r[phase].mockReturnValueOnce(waiting.promise);
	const pending = action === 'icon' ? r.api.icon('new-icon') : r.api.rename({ name: 'new-name' });
	if (phase === 'read') await vi.waitFor(() => expect(r.read).toHaveBeenCalledOnce());
	if (mode === 'selection') r.api.select(next);
	else r.destroy.forEach((close) => close());
	waiting.resolve({});
	await pending;
	expect(next).toEqual(folder('next'));
	if (phase === 'update') expect(r.read).not.toHaveBeenCalled();
	expect(r.selected).not.toHaveBeenCalled();
	expect(r.changed).not.toHaveBeenCalled();
});

it('keeps the export source and filename together after the selection changes', async () => {
	const r = folderRig(),
		waiting = deferred<{ id: string }[]>(),
		original = folder('original');
	r.api.select(original);
	r.chats.mockReturnValueOnce(waiting.promise);
	const pending = r.api.export();
	r.api.select(folder('next'));
	waiting.resolve([{ id: 'original-chat' }]);
	await pending;
	expect(r.chats).toHaveBeenCalledWith('fixture', 'original');
	expect(r.save.mock.calls[0][1]).toMatch(/^folder-original-export-\d+\.json$/);
});

it('reports the folder actually deleted after the selection changes', async () => {
	const r = folderRig(),
		waiting = deferred<boolean>(),
		original = folder('original');
	r.api.select(original);
	r.remove.mockReturnValueOnce(waiting.promise);
	const pending = r.api.remove();
	r.api.select(folder('next'));
	waiting.resolve(true);
	await pending;
	expect(r.remove).toHaveBeenCalledWith('fixture', 'original', true);
	expect(r.deleted).toHaveBeenCalledWith(original);
});

it('refreshes the parent list without clearing a newer folder selection', async () => {
	const text = readFileSync('src/lib/components/chat/Placeholder.svelte', 'utf8');
	const callback = text.match(/onDelete=\{(async[\s\S]*?\})\}\s*\/>/)?.[1];
	if (!callback) throw new Error('Missing actual FolderTitle onDelete callback');
	const waiting = deferred(),
		selected = vi.fn();
	const context = {
		refreshChatList: vi.fn(() => waiting.promise),
		refreshFolderChatLists: vi.fn(async () => {}),
		localStorage: { token: 'fixture' },
		selectedFolder: { set: selected },
		$selectedFolder: folder('original')
	};
	const remove = evaluate<(deleted: Folder) => Promise<void>>('(' + callback + ')', context);
	const pending = remove(folder('original'));
	context.$selectedFolder = folder('next');
	waiting.resolve({});
	await pending;
	expect(context.refreshChatList).toHaveBeenCalledWith('fixture');
	expect(selected).not.toHaveBeenCalled();
});

it.each(['missing-config', 'storage-failure', 'network-failure', 'success'])(
	'closes release notes with %s',
	async (mode) => {
		const update = vi.fn(async () => ({})),
			set = vi.fn(),
			warn = vi.fn();
		const storage: { token: string; version?: string } = { token: 'fixture' };
		if (mode === 'storage-failure')
			Object.defineProperty(storage, 'version', {
				set: () => {
					throw new Error('Private fixture words');
				}
			});
		if (mode === 'network-failure')
			update.mockRejectedValueOnce(new Error('Private fixture words'));
		const api = evaluate<{ close: () => Promise<void>; visible: () => boolean }>(
			script('src/lib/components/ChangelogModal.svelte') +
				'\nshow = true; ({close: closeModal, visible: () => show})',
			{
				getContext: () => ({}),
				$config: mode === 'missing-config' ? undefined : { version: 'server-version' },
				WEBUI_VERSION: 'build-version',
				localStorage: storage,
				settings: { set },
				$settings: {},
				updateUserSettings: update,
				getChangelog: vi.fn(),
				console: { warn }
			}
		);
		await api.close();
		expect(api.visible()).toBe(false);
		if (mode === 'success' || mode === 'missing-config') {
			expect(storage.version).toBe(mode === 'success' ? 'server-version' : 'build-version');
			expect(update).toHaveBeenCalledOnce();
		}
		expect(JSON.stringify(warn.mock.calls)).not.toContain('Private fixture words');
	}
);

it.each([
	['file', 'https://fixture.invalid/file', 'https://fixture.invalid/file/content'],
	['file', 'fixture-id', '/api/files/fixture-id/content'],
	['web', 'https://fixture.invalid', 'https://fixture.invalid']
])('handles a blocked popup for %s %s', async (type, url, destination) => {
	const text = readFileSync('src/lib/components/common/FileItem.svelte', 'utf8');
	const callback = text.match(/on:click=\{(async[\s\S]*?\})\}\s*>/)?.[1];
	if (!callback) throw new Error('Missing actual FileItem click callback');
	const open = vi.fn(() => null),
		dispatch = vi.fn();
	const click = evaluate<() => Promise<void>>('(' + callback + ')', {
		item: null,
		modal: false,
		showModal: false,
		type,
		url,
		WEBUI_API_BASE_URL: '/api',
		window: { open },
		dispatch
	});
	await click();
	expect(open).toHaveBeenCalledWith(destination, '_blank');
	expect(dispatch).toHaveBeenCalledWith('click');
});
