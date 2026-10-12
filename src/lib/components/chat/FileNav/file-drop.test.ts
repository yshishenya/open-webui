// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import FileEntryRow from './FileEntryRow.svelte';
import FileNavToolbar from './FileNavToolbar.svelte';
import KnowledgeBreadcrumbs from '$lib/components/workspace/Knowledge/KnowledgeBase/KnowledgeBreadcrumbs.svelte';
import DirectoryRow from '$lib/components/workspace/Knowledge/KnowledgeBase/DirectoryRow.svelte';

vi.mock('$lib/utils', () => ({ formatFileSize: (size: number): string => String(size) }));

function drop(target: Element, type: string, data: object): void {
	const event = new Event('drop', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'dataTransfer', {
		value: {
			getData: (requested: string): string => (requested === type ? JSON.stringify(data) : '')
		}
	});
	target.dispatchEvent(event);
}

const context = new Map([['i18n', writable({ t: (text: string): string => text })]]);

it('rejects a malformed terminal multi-selection before moving any row', async () => {
	const target = document.createElement('div');
	const onMove = vi.fn();
	const component = mount(FileEntryRow, {
		target,
		context,
		props: { entry: { name: 'folder', type: 'directory' }, currentPath: '/', onMove }
	});
	try {
		await tick();
		const row = target.querySelector('li > div')!;
		drop(row, 'application/x-terminal-file-move', { paths: ['/valid.txt', 7] });
		expect(onMove).not.toHaveBeenCalled();
		drop(row, 'application/x-terminal-file-move', { paths: ['/a.txt', '/b.txt'] });
		expect(onMove.mock.calls).toEqual([
			['/a.txt', '/folder/'],
			['/b.txt', '/folder/']
		]);
	} finally {
		await unmount(component);
	}
});

it('rejects a malformed terminal selection at the breadcrumb destination', async () => {
	const target = document.createElement('div');
	const onMove = vi.fn();
	const component = mount(FileNavToolbar, {
		target,
		context,
		props: { breadcrumbs: [{ label: 'Root', path: '/' }], selectedFile: '/a.txt', onMove }
	});
	try {
		await tick();
		const crumb = [...target.querySelectorAll('button')].find(
			(button) => button.textContent === 'Root'
		)!;
		drop(crumb, 'application/x-terminal-file-move', { paths: ['/valid.txt', 7] });
		expect(onMove).not.toHaveBeenCalled();
		drop(crumb, 'application/x-terminal-file-move', { path: '/a.txt' });
		expect(onMove.mock.calls).toEqual([['/a.txt', '/']]);
	} finally {
		await unmount(component);
	}
});

it('rejects non-string knowledge identifiers and preserves moves to the root', async () => {
	const target = document.createElement('div');
	const onMoveFile = vi.fn();
	const onMoveDir = vi.fn();
	const component = mount(KnowledgeBreadcrumbs, {
		target,
		context,
		props: { onMoveFile, onMoveDir }
	});
	try {
		await tick();
		const root = target.querySelector('button')!;
		drop(root, 'application/x-kb-file-move', { fileId: { id: 'bad' } });
		drop(root, 'application/x-kb-dir-move', { dirId: 7 });
		expect(onMoveFile).not.toHaveBeenCalled();
		expect(onMoveDir).not.toHaveBeenCalled();
		drop(root, 'application/x-kb-file-move', { fileId: 'file-1' });
		drop(root, 'application/x-kb-dir-move', { dirId: 'dir-1' });
		expect(onMoveFile.mock.calls).toEqual([['file-1', null]]);
		expect(onMoveDir.mock.calls).toEqual([['dir-1', null]]);
	} finally {
		await unmount(component);
	}
});

it('validates knowledge folder drops and still refuses moving a folder into itself', async () => {
	const target = document.createElement('div');
	const onFileDrop = vi.fn();
	const onDirDrop = vi.fn();
	const component = mount(DirectoryRow, {
		target,
		context,
		props: {
			directory: { id: 'dest', name: 'Destination', created_at: 0, updated_at: 0 },
			onFileDrop,
			onDirDrop
		}
	});
	try {
		await tick();
		const row = target.querySelector('[role="listitem"]')!;
		drop(row, 'application/x-kb-file-move', { fileId: 7 });
		drop(row, 'application/x-kb-dir-move', { dirId: {} });
		expect(onFileDrop).not.toHaveBeenCalled();
		expect(onDirDrop).not.toHaveBeenCalled();
		drop(row, 'application/x-kb-file-move', { fileId: 'file-1' });
		drop(row, 'application/x-kb-dir-move', { dirId: 'dest' });
		drop(row, 'application/x-kb-dir-move', { dirId: 'source' });
		expect(onFileDrop.mock.calls).toEqual([['file-1', 'dest']]);
		expect(onDirDrop.mock.calls).toEqual([['source', 'dest']]);
	} finally {
		await unmount(component);
	}
});
