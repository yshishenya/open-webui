// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import Files from '$lib/components/workspace/Knowledge/KnowledgeBase/Files.svelte';
import type { KnowledgeEditable } from '$lib/utils/airis/knowledge-types';

vi.hoisted(() => {
	Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' });
});

it('announces ordered rows, tolerates missing metadata and keeps selection and rename callbacks', async () => {
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
	const rename = vi.fn();
	const component = mount(Files, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: {
			knowledge,
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
			files: [
				{ id: 'stored', meta: { name: 'Document' }, updated_at: null, data: null },
				{ id: 'legacy', meta: null, updated_at: null },
				{ id: null, itemId: 'pending', name: 'Uploading', status: 'uploading' }
			],
			onClick: select,
			onRename: rename
		}
	});
	try {
		await tick();
		const list = target.querySelector('[role="list"]');
		if (!list) throw new Error('File list role missing');
		const rows = Array.from(list.querySelectorAll<HTMLElement>('[role="listitem"]'));
		expect(rows).toHaveLength(4);
		expect(rows[0].textContent).toContain('Folder');
		expect(rows[1].textContent).toContain('Document');
		expect(rows[3].textContent).toContain('Uploading');
		rows[1].querySelector<HTMLButtonElement>('button')?.click();
		expect(select).toHaveBeenCalledWith('stored');
		rows[1]
			.querySelector<HTMLButtonElement>('button.relative')
			?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		await tick();
		const input = rows[1].querySelector<HTMLInputElement>('input');
		if (!input) throw new Error('Real rename input missing');
		input.value = 'Updated';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await tick();
		expect(rename).toHaveBeenCalledWith('stored', 'Updated');
	} finally {
		await unmount(component);
		target.remove();
	}
});
