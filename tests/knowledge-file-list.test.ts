// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import Files from '$lib/components/workspace/Knowledge/KnowledgeBase/Files.svelte';
import type { KnowledgeEditable } from '$lib/utils/airis/knowledge-types';

const { search, renameFile, pendingFiles } = vi.hoisted(() => {
	Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' });
	return { search: vi.fn(), renameFile: vi.fn(), pendingFiles: vi.fn() };
});
vi.mock('$lib/apis/knowledge', () => ({
	searchKnowledgeFilesById: search,
	getPendingKnowledgeFiles: pendingFiles,
	createKnowledgeDirectory: vi.fn(),
	updateKnowledgeDirectory: vi.fn(),
	deleteKnowledgeDirectory: vi.fn(),
	moveFileInKnowledge: vi.fn(),
	removeFileFromKnowledgeById: vi.fn()
}));
vi.mock('$lib/apis/files', () => ({ renameFileById: renameFile, getFileBlobById: vi.fn() }));

Object.defineProperty(Element.prototype, 'animate', {
	configurable: true,
	value: () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null })
});
it('announces ordered rows, tolerates missing metadata and keeps selection and rename callbacks', async () => {
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe(): void {}
			unobserve(): void {}
			disconnect(): void {}
		}
	);
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const knowledge: KnowledgeEditable = {
		id: 'knowledge',
		user_id: 'owner',
		name: 'Knowledge',
		description: '',
		meta: null,
		access_grants: [],
		files: null,
		created_at: 0,
		updated_at: 0,
		write_access: true
	};
	const target = document.createElement('div');
	document.body.append(target);
	const select = vi.fn();
	const changed = vi.fn();
	const stored = { id: 'stored', meta: { name: 'Document' }, updated_at: null, data: null };
	search.mockResolvedValue({
		items: [stored, { id: 'legacy', meta: null, updated_at: null }],
		directories: [
			{
				id: 'directory',
				knowledge_id: 'knowledge',
				parent_id: null,
				name: 'Folder',
				user_id: 'owner',
				created_at: 0,
				updated_at: 0
			}
		],
		breadcrumbs: [],
		total: 2
	});
	pendingFiles.mockResolvedValue([]);
	renameFile.mockResolvedValue({ ...stored, meta: { name: 'Updated' } });
	const component = mount(Files, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: {
			knowledge,
			transfers: [{ id: null, itemId: 'pending', name: 'Uploading', status: 'uploading' }],
			onSelect: select,
			onChanged: changed
		}
	});
	try {
		await vi.waitFor(() => expect(target.querySelectorAll('[role="listitem"]')).toHaveLength(4));
		const list = target.querySelector('[role="list"]');
		if (!list) throw new Error('File list role missing');
		const rows = Array.from(list.querySelectorAll<HTMLElement>('[role="listitem"]'));
		expect(rows).toHaveLength(4);
		const entries = Array.from(
			list.querySelectorAll<HTMLButtonElement>('button[data-knowledge-entry]')
		);
		expect(entries.length).toBeGreaterThan(1);
		entries[0].focus();
		const press = (key: string): void => {
			const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
			document.activeElement?.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
		};
		press('ArrowUp');
		expect(document.activeElement).toBe(entries[0]);
		press('ArrowDown');
		expect(document.activeElement).toBe(entries[1]);
		press('End');
		expect(document.activeElement).toBe(entries.at(-1));
		press('ArrowDown');
		expect(document.activeElement).toBe(entries.at(-1));
		press('Home');
		expect(document.activeElement).toBe(entries[0]);
		expect(rows[0].textContent).toContain('Folder');
		expect(rows.some((row) => row.textContent?.includes('Uploading'))).toBe(true);
		const storedRow = list.querySelector<HTMLElement>('[data-knowledge-row="stored"]');
		if (!storedRow) throw new Error('Stored file row missing');
		expect(storedRow.textContent).toContain('Document');
		storedRow.querySelector<HTMLButtonElement>('button[data-knowledge-entry]')?.click();
		expect(select).toHaveBeenCalledWith(stored);
		storedRow.querySelector<HTMLButtonElement>('button[aria-label="More"]')?.click();
		await tick();
		const renameAction = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
			(button) => button.textContent?.trim() === 'Rename'
		);
		if (!renameAction) throw new Error('Real rename action missing');
		renameAction.click();
		await tick();
		const input = storedRow.querySelector<HTMLInputElement>('input');
		if (!input) throw new Error('Real rename input missing');
		input.value = 'Updated';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await tick();
		await vi.waitFor(() =>
			expect(renameFile).toHaveBeenCalledWith(localStorage.token, 'stored', 'Updated')
		);
		await vi.waitFor(() => expect(changed).toHaveBeenCalled());
	} finally {
		await unmount(component);
		target.remove();
		vi.unstubAllGlobals();
	}
});
