// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { beforeEach, expect, it, vi } from 'vitest';
import NotebookView from '$lib/components/chat/FileNav/NotebookView.svelte';
import Navbar from '$lib/components/chat/Navbar.svelte';
import { mobile, temporaryChatEnabled, chatId, user, showControls, settings } from '$lib/stores';
import { DEFAULT_PERMISSIONS } from '$lib/constants/permissions';

const api = vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
	return { start: vi.fn(), execute: vi.fn(), stop: vi.fn(), highlight: vi.fn() };
});
vi.mock('$lib/apis/terminal', () => ({
	createNotebookSession: api.start,
	executeNotebookCell: api.execute,
	stopNotebookSession: api.stop
}));
vi.mock('shiki', () => ({ codeToHtml: api.highlight }));
vi.mock('$lib/components/chat/FileNav/CellEditor.svelte', () => ({ default: () => ({}) }));
vi.mock('$lib/components/chat/ShareChatModal.svelte', () => ({ default: () => ({}) }));
vi.mock('$lib/components/airis/HeaderBillingAccess.svelte', () => ({ default: () => ({}) }));
vi.mock('$lib/components/layout/Navbar/Menu.svelte', () => ({ default: () => ({}) }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return { page: writable({ url: new URL('http://localhost/') }) };
});

beforeEach(() => {
	vi.clearAllMocks();
	api.highlight.mockResolvedValue(
		'<pre class="shiki"><code><span style="color:red">print(1)</span></code></pre>'
	);
	api.start.mockResolvedValue({ id: 'session' });
	api.stop.mockResolvedValue({ success: true });
	settings.set({});
	mobile.set(false);
	temporaryChatEnabled.set(false);
	chatId.set('');
	showControls.set(false);
	user.set({
		id: 'user',
		name: 'Tester',
		email: 'test@example.test',
		role: 'user',
		profile_image_url: '',
		permissions: structuredClone(DEFAULT_PERMISSIONS)
	});
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
const notebook = (source = '**Привет**') => ({
	cells: [
		{ cell_type: 'markdown', source: [source] },
		{
			cell_type: 'code',
			source: ['print(1)'],
			outputs: [
				{
					output_type: 'display_data',
					data: {
						'text/html':
							'<table><tr><td>Таблица</td></tr></table><img src=x onerror="alert(1)"><script>alert(2)</script>',
						'text/plain': ['Строка'],
						'image/png': ['aGVsbG8=']
					}
				},
				{ output_type: 'error', traceback: ['\u001b[31mОшибка\u001b[0m — данные'] }
			]
		}
	]
});

it('mounts notebook markdown, styled code, HTML, images and plain/error text', async () => {
	const element = target();
	const component = mount(NotebookView, {
		target: element,
		context: await context(),
		props: { notebook: notebook() }
	});
	try {
		await vi.waitFor(() =>
			expect(element.querySelector('.shiki span')?.textContent).toBe('print(1)')
		);
		expect(element.querySelector('.nb-markdown strong')?.textContent).toBe('Привет');
		expect(element.querySelector('.shiki span')?.getAttribute('style')).toBe('color:red');
		expect(element.querySelector('.nb-output-html td')?.textContent).toBe('Таблица');
		expect(element.querySelector('.nb-output-img')?.getAttribute('src')).toBe(
			'data:image/png;base64,aGVsbG8='
		);
		expect(element.querySelector('.nb-output-text')?.textContent).toBe('Строка');
		expect(element.querySelector('.nb-error')?.textContent).toBe('Ошибка — данные');
		expect(element.querySelector('script,[onerror]')).toBeNull();
	} finally {
		await unmount(component);
		element.remove();
	}
});

it('preserves markdown edit cancellation and updates real cell output using the existing session', async () => {
	const element = target();
	api.execute.mockResolvedValue({
		status: 'ok',
		execution_count: 7,
		outputs: [
			{
				output_type: 'display_data',
				data: { 'text/html': '<p>Новый ответ</p><svg onload="alert(1)"></svg>' }
			}
		]
	});
	const component = mount(NotebookView, {
		target: element,
		context: await context(),
		props: {
			notebook: notebook(),
			baseUrl: 'https://terminal.test',
			apiKey: 'test-key',
			filePath: '/test.ipynb'
		}
	});
	try {
		await vi.waitFor(() =>
			expect(element.querySelector('.nb-markdown strong')?.textContent).toBe('Привет')
		);
		element
			.querySelector('.nb-markdown')
			?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		await tick();
		const input = element.querySelector<HTMLTextAreaElement>('.nb-edit-textarea');
		if (!input) throw new Error('Actual notebook editor missing');
		input.value = '## Новый текст';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
		await tick();
		expect(element.querySelector('.nb-markdown strong')?.textContent).toBe('Привет');
		element.querySelector<HTMLButtonElement>('.nb-run-btn')?.click();
		await vi.waitFor(() =>
			expect(element.querySelector('.nb-output-html p')?.textContent).toBe('Новый ответ')
		);
		expect(api.start).toHaveBeenCalledTimes(1);
		expect(api.start).toHaveBeenCalledWith('https://terminal.test', 'test-key', '/test.ipynb');
		expect(api.execute).toHaveBeenCalledTimes(1);
		expect(api.execute).toHaveBeenCalledWith(
			'https://terminal.test',
			'test-key',
			'session',
			1,
			'print(1)'
		);
		expect(element.querySelector('[onload]')).toBeNull();
		expect(element.textContent).toContain('[7]');
	} finally {
		await unmount(component);
		element.remove();
	}
	expect(api.stop).toHaveBeenCalledWith('https://terminal.test', 'test-key', 'session');
});

it('cleans prepared highlighter HTML at the same DOM boundary as markdown and output', async () => {
	api.highlight.mockResolvedValue(
		'<pre class="shiki"><code>Привет</code><img src=x onerror="alert(1)"><script>alert(1)</script></pre>'
	);
	const element = target();
	const component = mount(NotebookView, {
		target: element,
		context: await context(),
		props: { notebook: notebook() }
	});
	try {
		await vi.waitFor(() =>
			expect(element.querySelector('.shiki code')?.textContent).toBe('Привет')
		);
		expect(element.querySelector('.nb-code-source script,.nb-code-source [onerror]')).toBeNull();
	} finally {
		await unmount(component);
		element.remove();
	}
});

it('keeps navbar new-chat, controls and temporary-save callbacks and permission gating', async () => {
	mobile.set(true);
	const element = target(),
		initNewChat = vi.fn(),
		onSaveTempChat = vi.fn();
	const component = mount(Navbar, {
		target: element,
		context: await context(),
		props: {
			chat: { id: 'chat', chat: { title: 'Разговор' } },
			history: { currentId: 'message' },
			initNewChat,
			onSaveTempChat,
			archiveChatHandler: vi.fn(),
			deleteChatHandler: vi.fn(),
			moveChatHandler: vi.fn()
		}
	});
	try {
		element.querySelector<HTMLButtonElement>('#new-chat-button')?.click();
		expect(initNewChat).toHaveBeenCalledTimes(1);
		element.querySelector<HTMLButtonElement>('button[aria-label="Controls"]')?.click();
		await tick();
		let controls = false;
		const unsubscribe = showControls.subscribe((value) => {
			controls = value;
		});
		unsubscribe();
		expect(controls).toBe(true);
		temporaryChatEnabled.set(true);
		await tick();
		element.querySelector<HTMLButtonElement>('#save-temporary-chat-button')?.click();
		expect(onSaveTempChat).toHaveBeenCalledTimes(1);
		user.update((value) =>
			value
				? {
						...value,
						permissions: {
							...value.permissions,
							chat: { ...value.permissions.chat, controls: false }
						}
					}
				: value
		);
		await tick();
		expect(element.querySelector('button[aria-label="Controls"]')).toBeNull();
	} finally {
		await unmount(component);
		element.remove();
	}
});
