// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DOMPurify from 'dompurify';
import FileItemModal from '$lib/components/common/FileItemModal.svelte';
import General from '$lib/components/admin/Settings/General.svelte';
import { config } from '$lib/stores';
import { updateAdminConfig } from '$lib/apis/auths';
import { WEBUI_API_BASE_URL } from '$lib/constants';

vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({ activate() {}, deactivate() {}, pause() {}, unpause() {} })
}));
vi.mock('$lib/stores', () => ({
	config: writable({}),
	settings: writable({}),
	banners: writable([]),
	showChangelog: writable(false)
}));
vi.mock('$lib/components/chat/Messages/CodeBlock.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/chat/Messages/Markdown.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/common/PDFViewer.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/common/PanzoomContainer.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/admin/Settings/Events.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/admin/Settings/Interface/Banners.svelte', () => ({ default: () => {} }));
vi.mock('$lib/apis/files', () => ({
	getFileById: vi.fn(async () => ({ data: { content: 'Extracted text' } })),
	getFileContentById: vi.fn(async () => new ArrayBuffer(0))
}));
vi.mock('$lib/apis', () => ({
	getBackendConfig: vi.fn(async () => ({})),
	getVersionUpdates: vi.fn()
}));
const saved = {
	ENABLE_COMMUNITY_SHARING: false,
	ENABLE_MESSAGE_RATING: false,
	ENABLE_FOLDERS: false,
	FOLDER_MAX_FILE_COUNT: 5,
	ENABLE_MEMORIES: false,
	ENABLE_MEMORY_SYSTEM_CONTEXT: false,
	ENABLE_NOTES: false,
	ENABLE_CHANNELS: false,
	CHANNEL_MODEL_RESPONSE_MODE: 'thread',
	ENABLE_CALENDAR: false,
	ENABLE_AUTOMATIONS: false,
	ENABLE_USER_WEBHOOKS: false,
	ENABLE_USER_STATUS: false,
	RESPONSE_WATERMARK: 'Keep',
	WEBUI_URL: 'https://chat.example.test',
	retained: 'Other setting'
};
vi.mock('$lib/apis/auths', () => ({
	getAdminConfig: vi.fn(async () => ({ ...saved })),
	updateAdminConfig: vi.fn(async () => ({}))
}));
vi.mock('$lib/apis/configs', () => ({ setBanners: vi.fn(async () => []) }));
const html =
	'<p><em>Document</em><a href="https://example.test">Link</a></p><table><tbody><tr><td>A</td></tr></tbody></table><script>bad()</script><img src=x onerror="bad()"><a href="javascript:bad()">Unsafe</a>';
vi.mock('mammoth', () => ({ convertToHtml: vi.fn(async () => ({ value: html })) }));
vi.mock('xlsx', async (importOriginal) => {
	const actual = await importOriginal<typeof import('xlsx')>();
	return {
		...actual,
		read: () => ({
			SheetNames: ['First', 'Second'],
			Sheets: {
				First: actual.utils.aoa_to_sheet([
					['First', '<script>bad()</script>'],
					['A', 'B']
				]),
				Second: actual.utils.aoa_to_sheet([
					['Second', '<script>bad()</script>'],
					['A', 'B']
				])
			}
		})
	};
});

beforeEach(() => {
	vi.clearAllMocks();
	config.update((current) => ({ ...current!, license_metadata: null }));
	vi.spyOn(window, 'open').mockReturnValue(null);
	if (!Element.prototype.animate)
		Object.defineProperty(Element.prototype, 'animate', {
			configurable: true,
			value: () => ({
				cancel() {},
				finished: Promise.resolve(),
				finish() {},
				pause() {},
				play() {}
			})
		});
});
afterEach(() => {
	vi.restoreAllMocks();
});

async function context() {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	return new Map([['i18n', writable(i18n)]]);
}

it.each(['xlsx', 'docx'])('keeps sanitized %s previews and sheet selection', async (extension) => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(FileItemModal, {
		target,
		context: await context(),
		props: { show: true, item: { id: 'file', type: 'file', name: `Document.${extension}` } }
	});
	try {
		await vi.waitFor(() =>
			expect(
				[...document.querySelectorAll('button')].some((b) => b.textContent === 'Preview')
			).toBe(true)
		);
		const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(b) => b.textContent === 'Preview'
		)!;
		button.click();
		await tick();
		const preview = document.querySelector('.office-preview')!;
		if (extension === 'xlsx') {
			await vi.waitFor(() => expect(preview.textContent).toContain('First'));
			expect(preview.textContent).toContain('<script>bad()</script>');
		} else {
			expect(preview.innerHTML).toBe(DOMPurify.sanitize(html));
			expect(preview.querySelector('td')?.textContent).toBe('A');
			expect(preview.querySelector('a')?.href).toBe('https://example.test/');
		}
		expect(preview.querySelector('script, [onerror], a[href^="javascript:"]')).toBeNull();
		if (extension === 'xlsx') {
			[...document.querySelectorAll<HTMLButtonElement>('button')]
				.find((b) => b.textContent === 'Second')!
				.click();
			await tick();
			await vi.waitFor(() => expect(preview.textContent).toContain('Second'));
		}
	} finally {
		await unmount(component);
		target.remove();
	}
});

it.each([
	[{ type: 'file', id: 'file', name: 'File' }, `${WEBUI_API_BASE_URL}/files/file/content`],
	[
		{ type: 'file', id: 'file', name: 'File', url: 'https://example.test/file' },
		'https://example.test/file'
	],
	[{ type: 'link', name: 'File', url: 'https://example.test/link' }, 'https://example.test/link'],
	[{ type: 'note', name: 'File' }, undefined]
])('opens the existing target from a native file button: %j', async (item, url) => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(FileItemModal, {
		target,
		context: await context(),
		props: { show: true, item }
	});
	try {
		await tick();
		const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
			(b) => b.textContent?.trim() === 'File'
		)!;
		expect(button?.type).toBe('button');
		expect(button?.tabIndex).toBe(0);
		button.click();
		if (url) expect(window.open).toHaveBeenCalledWith(url, '_blank');
		else expect(window.open).not.toHaveBeenCalled();
	} finally {
		await unmount(component);
		target.remove();
	}
});

it('updates sanitized license HTML and preserves the complete settings payload', async () => {
	config.update((current) => ({ ...current!, license_metadata: { html } }));
	const target = document.createElement('div');
	document.body.append(target);
	const saveHandler = vi.fn();
	const component = mount(General, { target, context: await context(), props: { saveHandler } });
	try {
		await vi.waitFor(() => expect(target.querySelector('em')?.textContent).toBe('Document'));
		const content = target.querySelector('em')!.parentElement!.parentElement!;
		expect(content.innerHTML).toBe(DOMPurify.sanitize(html));
		config.update((current) => ({
			...current!,
			license_metadata: { html: '<strong>Updated</strong><img src=x onerror="bad()">' }
		}));
		await tick();
		expect(content.querySelector('em, script, [onerror]')).toBeNull();
		expect(content.querySelector('strong')?.textContent).toBe('Updated');
		target
			.querySelector('form')!
			.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await vi.waitFor(() => expect(saveHandler).toHaveBeenCalledOnce());
		expect(updateAdminConfig).toHaveBeenCalledWith(localStorage.token, saved);
	} finally {
		await unmount(component);
		target.remove();
	}
});
