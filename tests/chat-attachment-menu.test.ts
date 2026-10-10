// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { beforeEach, expect, it, vi } from 'vitest';
import Knowledge from '$lib/components/chat/MessageInput/InputMenu/Knowledge.svelte';
import Files from '$lib/components/chat/MessageInput/InputMenu/Files.svelte';
import Chats from '$lib/components/chat/MessageInput/InputMenu/Chats.svelte';
import { chatId } from '$lib/stores';
import type { KnowledgeFile, KnowledgeListItem } from '$lib/utils/airis/knowledge-types';
import type { ChatTitleIdResponse } from '$lib/utils/airis/frontend-contracts';

const api = vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
	return {
		knowledge: vi.fn(),
		knowledgeFiles: vi.fn(),
		files: vi.fn(),
		chats: vi.fn(),
		chatSearch: vi.fn()
	};
});
vi.mock('$lib/apis/knowledge', () => ({
	searchKnowledgeBases: api.knowledge,
	searchKnowledgeFilesById: api.knowledgeFiles
}));
vi.mock('$lib/apis/files', () => ({ searchFiles: api.files }));
vi.mock('$lib/apis/chats', () => ({
	getChatList: api.chats,
	getChatListBySearchText: api.chatSearch
}));

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.token = 'test';
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			observe(): void {}
			disconnect(): void {}
		}
	);
});

async function context(): Promise<Map<string, object>> {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	return new Map([['i18n', writable(i18n)]]);
}

function target(): HTMLDivElement {
	const element = document.createElement('div');
	document.body.append(element);
	return element;
}

function button(element: HTMLElement, text: string): HTMLButtonElement {
	const result = Array.from(element.querySelectorAll('button')).find((item) =>
		item.textContent?.includes(text)
	);
	if (!result) throw new Error(`Missing actual menu button: ${text}`);
	return result;
}

function file(id: string, meta: KnowledgeFile['meta']): KnowledgeFile {
	return {
		id,
		user_id: 'owner',
		filename: `${id}.pdf`,
		hash: null,
		data: null,
		meta,
		created_at: 0,
		updated_at: null
	};
}

it('selects a collection and uses the stored filename when legacy file metadata has no name', async () => {
	const collection: KnowledgeListItem = {
		id: 'collection',
		user_id: 'owner',
		name: 'Reference',
		description: '',
		meta: null,
		access_grants: [],
		created_at: 0,
		updated_at: 0,
		user: null,
		file_count: 3,
		write_access: null
	};
	const entries = [
		file('legacy', null),
		file('unnamed', { name: null }),
		file('named', { name: 'Named file' })
	];
	api.knowledge.mockResolvedValue({ items: [collection], total: 1 });
	api.knowledgeFiles.mockResolvedValue({
		items: entries,
		total: 3,
		directories: [],
		breadcrumbs: []
	});
	const element = target();
	const onSelect = vi.fn();
	const component = mount(Knowledge, {
		target: element,
		context: await context(),
		props: { onSelect }
	});
	try {
		await vi.waitFor(() => expect(element.textContent).toContain('Reference'));
		button(element, 'Reference').click();
		expect(onSelect).toHaveBeenCalledWith({ type: 'collection', ...collection });
		const expand = Array.from(element.querySelectorAll('button')).find(
			(item) => !item.textContent?.trim()
		);
		if (!expand) throw new Error('Actual expand button missing');
		expand.click();
		await vi.waitFor(() => expect(element.textContent).toContain('Named file'));
		for (const entry of entries) {
			const name = entry.meta?.name ?? entry.filename;
			button(element, name).click();
			expect(onSelect).toHaveBeenLastCalledWith({ type: 'file', name, ...entry });
		}
		expect(api.knowledge).toHaveBeenCalledTimes(1);
		expect(api.knowledgeFiles).toHaveBeenCalledWith(
			'test',
			'collection',
			null,
			null,
			null,
			null,
			1
		);
	} finally {
		await unmount(component);
		element.remove();
	}
});

it('keeps image and file selection data and searches with the existing filename pattern', async () => {
	const image = {
		...file('picture', { content_type: 'image/png', size: 12 }),
		filename: 'picture.png'
	};
	api.files.mockResolvedValue([image, file('legacy', null)]);
	const element = target();
	const onSelect = vi.fn();
	const component = mount(Files, {
		target: element,
		context: await context(),
		props: { onSelect }
	});
	try {
		await vi.waitFor(() => expect(element.textContent).toContain('picture.png'));
		button(element, 'picture.png').click();
		expect(onSelect).toHaveBeenCalledWith({
			...image,
			type: 'image',
			name: 'picture.png',
			url: 'picture',
			content_type: 'image/png',
			size: 12
		});
		button(element, 'legacy.pdf').click();
		expect(onSelect).toHaveBeenLastCalledWith(
			expect.objectContaining({ type: 'file', id: 'legacy', name: 'legacy.pdf' })
		);
		expect(api.files).toHaveBeenCalledTimes(1);
		api.files.mockResolvedValue([]);
		const input = element.querySelector('input');
		if (!input) throw new Error('Actual file search missing');
		input.value = 'report';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await vi.waitFor(() => expect(api.files).toHaveBeenLastCalledWith('test', '*report*', 0, 50));
		await tick();
		expect(element.textContent).toContain('No files found');
	} finally {
		await unmount(component);
		element.remove();
	}
});

it('excludes the current chat and preserves the selected chat and its snippet', async () => {
	chatId.set('current');
	const previous: ChatTitleIdResponse = {
		id: 'previous',
		title: 'Previous chat',
		snippet: 'Saved snippet',
		created_at: 0,
		updated_at: 0
	};
	api.chats.mockResolvedValue([{ ...previous, id: 'current', title: 'Current chat' }, previous]);
	const element = target();
	const onSelect = vi.fn();
	const component = mount(Chats, {
		target: element,
		context: await context(),
		props: { onSelect }
	});
	try {
		await vi.waitFor(() => expect(element.textContent).toContain('Previous chat'));
		expect(element.textContent).not.toContain('Current chat');
		button(element, 'Previous chat').click();
		expect(onSelect).toHaveBeenCalledWith({
			...previous,
			type: 'chat',
			name: 'Previous chat',
			description: 'Saved snippet'
		});
		expect(api.chats).toHaveBeenCalledOnce();
		expect(api.chats).toHaveBeenCalledWith('test', 1, true, true);
	} finally {
		await unmount(component);
		element.remove();
		chatId.set('');
	}
});
