// @vitest-environment jsdom
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createInstance } from 'i18next';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { SqlJsStatic } from 'sql.js';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import FilesModal from '$lib/components/layout/FilesModal.svelte';
import SqliteView from '$lib/components/chat/FileNav/SqliteView.svelte';
import type { KnowledgeFile } from '$lib/utils/airis/knowledge-types';

const fakes = vi.hoisted(() => ({
	search: vi.fn(),
	count: vi.fn(),
	remove: vi.fn(),
	sqlLoader: vi.fn(),
	preview: null as { show: boolean; item: { id?: string } | null } | null,
	toast: { success: vi.fn(), error: vi.fn() }
}));
vi.hoisted(() => Object.assign(globalThis, { APP_VERSION: 'test', APP_BUILD_HASH: 'test' }));
vi.mock('$lib/apis/files', () => ({
	searchUserFiles: fakes.search,
	getUserFileCount: fakes.count,
	getFileById: vi.fn(async (_token: string, id: string) => ({ id })),
	getFileBlobById: vi.fn(),
	deleteFileById: fakes.remove
}));
vi.mock('svelte-sonner', () => ({ toast: fakes.toast }));
vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }) }));
vi.mock('$lib/utils/transitions', () => ({ flyAndScale: () => ({ duration: 0 }) }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({ activate() {}, deactivate() {}, pause() {}, unpause() {} })
}));
vi.mock('$lib/components/common/Loader.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/common/FileItemModal.svelte', () => ({
	default: (...args: [unknown, NonNullable<typeof fakes.preview>]) => {
		fakes.preview = args[1];
	}
}));
vi.mock('sql.js', () => ({ default: fakes.sqlLoader }));

let SQL: SqlJsStatic;
beforeAll(async () => {
	const actual = await vi.importActual<typeof import('sql.js')>('sql.js');
	SQL = await actual.default({
		wasmBinary: new Uint8Array(
			readFileSync(createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm'))
		).buffer
	});
});
beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe(): void {}
			unobserve(): void {}
			disconnect(): void {}
		}
	);
	fakes.preview = null;
	fakes.sqlLoader.mockImplementation(async (options: { locateFile: (name: string) => string }) => {
		expect(options.locateFile('sql-wasm.wasm')).toBe('/sql.js/sql-wasm.wasm');
		return SQL;
	});
	fakes.count.mockResolvedValue(2);
	fakes.remove.mockResolvedValue({ success: true });
	localStorage.token = 'fixture';
});

const context = async (): Promise<Map<string, object>> => {
	const i18n = createInstance();
	await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
	return new Map([['i18n', writable(i18n)]]);
};
const fixture = (id: string, filename: string, created_at: number): KnowledgeFile => ({
	id,
	filename,
	created_at,
	user_id: 'fixture-user',
	updated_at: created_at,
	hash: null,
	data: null,
	meta: { size: 1024 }
});
const button = (label: string): HTMLButtonElement => {
	const result = Array.from(document.querySelectorAll('button')).find(
		(b) => b.textContent?.trim() === label
	);
	if (!result) throw new Error('Missing actual button: ' + label);
	return result;
};

it('opens files and confirms deletion using separate native controls', async () => {
	fakes.search.mockResolvedValue([fixture('one', 'Fixture.txt', 1)]);
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(FilesModal, { target, context: await context(), props: { show: true } });
	try {
		await vi.waitFor(() => expect(document.body.textContent).toContain('Fixture.txt'));
		const open = Array.from(document.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('Fixture.txt')
		);
		expect(open).toBeDefined();
		open?.click();
		await tick();
		expect(fakes.preview?.show).toBe(true);
		expect(fakes.preview?.item?.id).toBe('one');
		document
			.querySelector<HTMLButtonElement>('button[aria-label="Actions for Fixture.txt"]')!
			.click();
		await tick();
		const remove = button('Delete');
		expect(remove.querySelector('svg')).not.toBeNull();
		remove.click();
		await tick();
		expect(fakes.remove).not.toHaveBeenCalled();
		fakes.search.mockResolvedValueOnce([]);
		button('Delete').click();
		await vi.waitFor(() => expect(fakes.remove).toHaveBeenCalledWith('fixture', 'one'));
		await tick();
		expect(document.body.textContent).not.toContain('Fixture.txt');
	} finally {
		await unmount(component);
		target.remove();
	}
});

it('preserves filename sorting, query pattern and Shift deletion', async () => {
	fakes.search.mockImplementation(async () => [
		fixture('one', 'Alpha.txt', 1),
		fixture('two', 'Beta.txt', 2)
	]);
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(FilesModal, { target, context: await context(), props: { show: true } });
	try {
		await vi.waitFor(() => expect(document.body.textContent).toContain('Beta.txt'));
		button('Filename').click();
		await tick();
		expect(fakes.search).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => {
			const names = Array.from(document.querySelectorAll('button'))
				.map((b) => b.textContent?.trim())
				.filter((t) => t?.includes('.txt'));
			expect(names[0]).toContain('Alpha.txt');
		});
		const query = document.querySelector<HTMLInputElement>('input[placeholder="Search Files"]');
		if (!query) throw new Error('Missing actual search');
		query.value = 'Alpha';
		query.dispatchEvent(new Event('input', { bubbles: true }));
		await vi.waitFor(() =>
			expect(fakes.search).toHaveBeenLastCalledWith('fixture', '*Alpha*', 0, 50)
		);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
		await tick();
		document
			.querySelector<HTMLButtonElement>('button[aria-label="Actions for Alpha.txt"]')!
			.click();
		await tick();
		button('Delete').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
		await vi.waitFor(() => expect(fakes.remove).toHaveBeenCalledWith('fixture', 'one'));
		expect(fakes.preview?.show).toBe(false);
		window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
	} finally {
		await unmount(component);
		target.remove();
	}
});

it('renders real SQLite values and preserves custom queries and cleanup', async () => {
	const fixtureDb = new SQL.Database();
	fixtureDb.run(
		"CREATE TABLE demo (name TEXT, amount INTEGER, data BLOB); INSERT INTO demo VALUES ('Fixture', 42, X'0102'), ('Empty', NULL, NULL);"
	);
	const data = new Uint8Array(fixtureDb.export()).buffer;
	fixtureDb.close();
	const close = vi.spyOn(SQL.Database.prototype, 'close');
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(SqliteView, { target, context: await context(), props: { data } });
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('Fixture'));
		expect(target.textContent).toContain('[BLOB 2B]');
		expect(target.textContent).toContain('NULL');
		button('SQL').click();
		await tick();
		const query = target.querySelector('textarea');
		if (!query) throw new Error('Missing actual SQL input');
		query.value = 'SELECT name FROM demo ORDER BY name';
		query.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		query.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true })
		);
		await tick();
		expect(
			Array.from(target.querySelectorAll('tbody tr')).map((r) => r.textContent?.trim())
		).toEqual(['1Empty', '2Fixture']);
		query.value = 'SELECT FROM';
		query.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		button('Run').click();
		await tick();
		expect(target.textContent).toContain('syntax error');
	} finally {
		await unmount(component);
		expect(close).toHaveBeenCalledTimes(1);
		close.mockRestore();
		target.remove();
	}
});
