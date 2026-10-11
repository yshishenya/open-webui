// @vitest-environment jsdom
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Database from '$lib/components/admin/Settings/Database.svelte';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));
vi.mock('$lib/stores', () => ({ config: writable({ features: {} }) }));
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1', WEBUI_BASE_URL: '' }));
vi.mock('$lib/apis/users', () => ({ getAllUsers: vi.fn() }));
vi.mock('$lib/apis/chats', () => ({ getAllUserChats: vi.fn() }));
vi.mock('$lib/apis/utils', () => ({ downloadDatabase: vi.fn() }));
const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

beforeEach(() => {
	vi.clearAllMocks();
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
	localStorage.token = 'fixture';
	fetchMock.mockImplementation(async () => new Response(JSON.stringify({ 'ui.name': 'Fixture' })));
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

async function setup() {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(Database, {
		target,
		context: new Map([['i18n', writable(i18n)]]),
		props: { saveHandler: () => {} }
	});
	await tick();
	const input = target.querySelector<HTMLInputElement>('#config-json-input')!;
	return {
		input,
		async close(): Promise<void> {
			await unmount(component);
			target.remove();
		}
	};
}

function choose(
	input: HTMLInputElement,
	text: string,
	read: () => Promise<string> = async () => text
): void {
	const file = new File([text], 'settings.json', { type: 'application/json' });
	Object.defineProperty(file, 'text', { value: read });
	Object.defineProperty(input, 'files', { configurable: true, value: [file] });
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

it('imports the chosen configuration once and clears the actual input for repeated selection', async () => {
	const s = await setup();
	try {
		const reset = vi.spyOn(s.input, 'value', 'set');
		choose(s.input, '{"ui.name":"Fixture"}');
		await vi.waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
			config: { 'ui.name': 'Fixture' }
		});
		expect(reset).toHaveBeenCalledWith('');
		choose(s.input, '{"ui.name":"Fixture"}');
		await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2));
		expect(fetchMock).toHaveBeenCalledTimes(2);
	} finally {
		await s.close();
	}
});

it('ignores a cancelled file selection without a request or error', async () => {
	const s = await setup();
	try {
		Object.defineProperty(s.input, 'files', { configurable: true, value: [] });
		s.input.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(toast.error).not.toHaveBeenCalled();
	} finally {
		await s.close();
	}
});

it.each(['{"secret":"private-fixture",', 'null', '[]', '42', '"text"'])(
	'rejects invalid configuration %s before any request without showing file contents',
	async (body) => {
		const s = await setup();
		try {
			choose(s.input, body);
			await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid JSON file'));
			expect(fetchMock).not.toHaveBeenCalled();
			expect(toast.success).not.toHaveBeenCalled();
			expect(s.input.disabled).toBe(false);
		} finally {
			await s.close();
		}
	}
);

it('reports a file read failure and permits the next valid selection', async () => {
	const s = await setup();
	try {
		choose(s.input, '{}', async () => {
			throw new Error('File unavailable');
		});
		await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('File unavailable'));
		expect(fetchMock).not.toHaveBeenCalled();
		choose(s.input, '{}');
		await vi.waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
		expect(fetchMock).toHaveBeenCalledOnce();
	} finally {
		await s.close();
	}
});

it.each(['{"error":"Import denied"}', '<html>unavailable</html>'])(
	'reports a refused response %s without false success or automatic retry',
	async (body) => {
		const s = await setup();
		try {
			fetchMock.mockResolvedValueOnce(new Response(body, { status: 503 }));
			choose(s.input, '{}');
			await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
			expect(toast.success).not.toHaveBeenCalled();
			expect(fetchMock).toHaveBeenCalledOnce();
			choose(s.input, '{}');
			await vi.waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
			expect(fetchMock).toHaveBeenCalledTimes(2);
		} finally {
			await s.close();
		}
	}
);

it.each(['null', '[]', '42'])(
	'rejects an invalid success response %s without reporting an import',
	async (body) => {
		const s = await setup();
		try {
			fetchMock.mockResolvedValueOnce(new Response(body));
			choose(s.input, '{}');
			await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
			expect(toast.success).not.toHaveBeenCalled();
		} finally {
			await s.close();
		}
	}
);

it('blocks a second import while a request is pending and unlocks after the existing timeout', async () => {
	const s = await setup();
	try {
		vi.useFakeTimers();
		fetchMock.mockImplementationOnce(
			(_url, options) =>
				new Promise<Response>((_resolve, reject) => {
					options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
				})
		);
		choose(s.input, '{}');
		await vi.advanceTimersByTimeAsync(0);
		expect(s.input.disabled).toBe(true);
		choose(s.input, '{"ui.name":"Second"}');
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(toast.error).toHaveBeenCalledWith('Config import timed out.');
		expect(toast.success).not.toHaveBeenCalled();
		expect(s.input.disabled).toBe(false);
	} finally {
		await s.close();
	}
});
