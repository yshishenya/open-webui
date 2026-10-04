import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { normalizeNote, readNoteResponse } from '../src/lib/utils/airis/notes';

const editorPath = 'src/lib/components/notes/NoteEditor.svelte';
const apiPath = 'src/lib/apis/notes/index.ts';
const initializer = (path: string, name: string): string => {
	const file = readFileSync(path, 'utf8');
	const source = ts.createSourceFile(
		path,
		path.endsWith('.svelte') ? file.split('<script lang="ts">')[1].split('</script>')[0] : file,
		ts.ScriptTarget.Latest
	);
	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const declaration = statement.declarationList.declarations.find(
			(item) => item.name.getText(source) === name
		);
		if (declaration?.initializer) return declaration.initializer.getText(source);
	}
	throw new Error(`Missing ${name}`);
};
const evaluate = <T>(code: string, context: object): T =>
	runInNewContext(
		ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
		context
	) as T;
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};
const noteRecord = (id = 'A') => ({
	id,
	user_id: 'user',
	title: `Title ${id}`,
	data: {
		content: { md: `Text ${id}`, html: `<p>${id}</p>`, json: { type: 'doc' } },
		files: [{ id: `file-${id}` }]
	},
	access_grants: [{ principal_id: 'reader' }],
	write_access: true,
	created_at: 1,
	updated_at: 1
});
const setup = () => {
	const timers = new Map<number, () => unknown>();
	let timerID = 0;
	const context = {
		id: 'A',
		note: noteRecord(),
		files: noteRecord().data.files,
		loading: false,
		debounceTimeout: null,
		loadGeneration: 0,
		destroyed: false,
		saveTimers: new Map<string, number>(),
		saveQueues: new Map<string, Promise<void>>(),
		localStorage: { token: 'test-token' },
		$i18n: { t: (text: string): string => text },
		toast: { error: vi.fn() },
		goto: vi.fn(),
		noteEventHandler: vi.fn(),
		$socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
		getNoteById: vi.fn().mockResolvedValue(noteRecord()),
		updateNoteById: vi.fn().mockResolvedValue(noteRecord()),
		getPinnedNoteList: vi.fn().mockResolvedValue([]),
		pinnedNotes: { set: vi.fn() },
		structuredClone,
		setTimeout: (callback: () => unknown): number => {
			timers.set(++timerID, callback);
			return timerID;
		},
		clearTimeout: (id: number): void => {
			timers.delete(id);
		}
	};
	const init = evaluate<() => Promise<void>>(`(${initializer(editorPath, 'init')})`, context);
	const change = evaluate<() => void>(
		`(${initializer(editorPath, 'changeDebounceHandler')})`,
		context
	);
	const fire = (): void => {
		const pending = [...timers.values()];
		timers.clear();
		pending.forEach((callback) => {
			void callback();
		});
	};
	return { context, init, change, fire };
};
const settle = async (): Promise<void> => {
	for (let i = 0; i < 20; i++) await Promise.resolve();
};

it.each([{}, null, { content: null }, { content: { md: 'Existing', extension: 7 }, extension: 9 }])(
	'loads backend-valid sparse data %s without losing fields',
	async (data) => {
		const payload = { ...noteRecord(), data };
		const context = {
			WEBUI_API_BASE_URL: '',
			fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))),
			console: { error: vi.fn() },
			normalizeNote,
			readNoteResponse,
			noteUpdates: new Map<string, Promise<unknown>>()
		};
		const get = evaluate<(token: string, id: string) => Promise<ReturnType<typeof noteRecord>>>(
			`(${initializer(apiPath, 'getNoteById')})`,
			context
		);
		const result = await get('test', 'A');
		expect(result.data.content).toBeDefined();
		expect(result.data.content.json).toBeDefined();
		expect(result.data.files).toEqual([]);
		if (data && 'content' in data && data.content)
			expect(result.data.content).toMatchObject(data.content);
		if (data && 'extension' in data)
			expect(result.data).toMatchObject({ extension: data.extension });
	}
);

it.each(['getNoteById', 'updateNoteById'])(
	'%s rejects network errors instead of reporting null success',
	async (name) => {
		const error = new TypeError('Failed to fetch');
		const context = {
			WEBUI_API_BASE_URL: '',
			fetch: vi.fn().mockRejectedValue(error),
			console: { error: vi.fn() },
			normalizeNote,
			readNoteResponse,
			noteUpdates: new Map<string, Promise<unknown>>()
		};
		const call = evaluate<(token: string, id: string, note: object) => Promise<unknown>>(
			`(${initializer(apiPath, name)})`,
			context
		);
		await expect(call('test', 'A', { title: 'Draft', data: {} })).rejects.toBe(error);
	}
);

it('ignores older load after A to B', async () => {
	const { context, init } = setup();
	const first = deferred<ReturnType<typeof noteRecord>>();
	context.getNoteById.mockReturnValueOnce(first.promise).mockResolvedValueOnce(noteRecord('B'));
	const pending = init();
	context.id = 'B';
	await init();
	first.resolve(noteRecord('A'));
	await pending;
	expect(context.note.id).toBe('B');
	expect(context.files).toEqual(noteRecord('B').data.files);
	expect(context.$socket.emit).toHaveBeenCalledTimes(1);
	expect(context.loading).toBe(false);
});
it('ignores stale load failure without toast or redirect', async () => {
	const { context, init } = setup();
	const first = deferred<ReturnType<typeof noteRecord>>();
	context.getNoteById.mockReturnValueOnce(first.promise).mockResolvedValueOnce(noteRecord('B'));
	const pending = init();
	context.id = 'B';
	await init();
	first.reject(new Error('Denied'));
	await pending;
	expect(context.note.id).toBe('B');
	expect(context.toast.error).not.toHaveBeenCalled();
	expect(context.goto).not.toHaveBeenCalled();
});
it('settles current loading failure', async () => {
	const { context, init } = setup();
	context.getNoteById.mockRejectedValue(new Error('Offline'));
	await init();
	expect(context.loading).toBe(false);
	expect(context.toast.error).toHaveBeenCalledOnce();
});
it('saves captured A when route already points to B', async () => {
	const { context, change, fire } = setup();
	context.id = 'B';
	change();
	context.note.title = 'After scheduling';
	context.files[0].id = 'changed';
	fire();
	await settle();
	expect(context.updateNoteById).toHaveBeenCalledWith('test-token', 'A', {
		title: 'Title A',
		data: { files: [{ id: 'file-A' }] },
		access_grants: [{ principal_id: 'reader' }]
	});
});
it('saves both notes instead of cancelling A on editing B', async () => {
	const { context, change, fire } = setup();
	change();
	context.id = 'B';
	context.note = noteRecord('B');
	context.files = context.note.data.files;
	change();
	fire();
	await settle();
	expect(context.updateNoteById.mock.calls.map((call) => call[1])).toEqual(['A', 'B']);
});
it('serializes API writes across editors and snapshots the form before waiting', async () => {
	const first = deferred<Response>();
	const fetch = vi
		.fn<Parameters<typeof globalThis.fetch>, ReturnType<typeof globalThis.fetch>>()
		.mockReturnValueOnce(first.promise)
		.mockResolvedValue(new Response(JSON.stringify(noteRecord())));
	const context = {
		WEBUI_API_BASE_URL: '',
		fetch,
		readNoteResponse,
		normalizeNote,
		noteUpdates: new Map<string, Promise<unknown>>()
	};
	const update = evaluate<(token: string, id: string, note: object) => Promise<unknown>>(
		`(${initializer(apiPath, 'updateNoteById')})`,
		context
	);
	const old = update('test', 'A', { title: 'Old' });
	await settle();
	const form = { title: 'Newest' };
	const next = update('test', 'A', form);
	form.title = 'After scheduling';
	await settle();
	expect(fetch).toHaveBeenCalledTimes(1);
	first.resolve(new Response(JSON.stringify(noteRecord())));
	await old;
	await next;
	expect(fetch).toHaveBeenCalledTimes(2);
	expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ title: 'Newest' });
	expect(context.noteUpdates.size).toBe(0);
});
it('keeps draft and allows retry after failed save', async () => {
	const { context, change, fire } = setup();
	const before = structuredClone(context.note);
	context.updateNoteById.mockRejectedValueOnce(new Error('Offline'));
	change();
	fire();
	await settle();
	expect(context.note).toEqual(before);
	expect(context.toast.error).toHaveBeenCalledOnce();
	change();
	fire();
	await settle();
	expect(context.updateNoteById).toHaveBeenCalledTimes(2);
});
it('does not publish a late pinned list into another user session', async () => {
	const { context, change, fire } = setup();
	const list = deferred<object[]>();
	context.getPinnedNoteList.mockReturnValueOnce(list.promise);
	change();
	fire();
	await settle();
	context.localStorage.token = 'other-user';
	list.resolve([{ id: 'private-A' }]);
	await settle();
	expect(context.pinnedNotes.set).not.toHaveBeenCalled();
});

it('preserves all valid content and unknown extensions', () => {
	const original = {
		...noteRecord(),
		extension: { keep: true },
		data: {
			...noteRecord().data,
			custom: { keep: true },
			content: { ...noteRecord().data.content, custom: 7 }
		}
	};
	expect(normalizeNote(original)).toEqual(original);
});
it.each([
	{ content: 'broken' },
	{ content: { md: 42 } },
	{ content: { html: [] } },
	{ files: 'broken' },
	{ files: [null] }
])('rejects malformed existing data rather than erasing it %s', (data) => {
	expect(() => normalizeNote({ ...noteRecord(), data })).toThrow();
});
it('ignores loads after unmount or session change', async () => {
	for (const mode of ['destroyed', 'session']) {
		const { context, init } = setup();
		const response = deferred<ReturnType<typeof noteRecord>>();
		context.getNoteById.mockReturnValueOnce(response.promise);
		const pending = init();
		if (mode === 'destroyed') context.destroyed = true;
		else context.localStorage.token = 'other';
		response.resolve(noteRecord('other'));
		await pending;
		expect(context.note.id).toBe('A');
		expect(context.$socket.emit).not.toHaveBeenCalled();
	}
});
it('does not issue pending saves after logout', async () => {
	const { context, change, fire } = setup();
	change();
	context.localStorage.token = '';
	fire();
	await settle();
	expect(context.updateNoteById).not.toHaveBeenCalled();
});
it('pinning neither refetches nor replaces an unsaved draft after switching notes', async () => {
	const { context } = setup();
	const response = deferred<object>();
	const pinContext = {
		...context,
		toggleNotePinnedStatusById: vi.fn().mockReturnValueOnce(response.promise)
	};
	const pin = evaluate<() => Promise<void>>(
		`(${initializer(editorPath, 'pinHandler')})`,
		pinContext
	);
	const pending = pin();
	pinContext.id = 'B';
	pinContext.note = noteRecord('B');
	pinContext.note.title = 'Unsaved';
	response.resolve({});
	await pending;
	expect(pinContext.note.title).toBe('Unsaved');
	expect(pinContext.getNoteById).not.toHaveBeenCalled();
	expect(pinContext.toggleNotePinnedStatusById).toHaveBeenCalledWith('test-token', 'A');
});
it.each(['403', 'invalid-json', 'null'])(
	'rejects API failure %s and lets the next update through',
	async (mode) => {
		const failure =
			mode === '403'
				? new Response(JSON.stringify({ detail: 'Denied' }), { status: 403 })
				: mode === 'null'
					? new Response('null')
					: new Response('{broken');
		const fetch = vi
			.fn<Parameters<typeof globalThis.fetch>, ReturnType<typeof globalThis.fetch>>()
			.mockResolvedValueOnce(failure)
			.mockResolvedValueOnce(new Response(JSON.stringify(noteRecord())));
		const context = {
			WEBUI_API_BASE_URL: '',
			fetch,
			readNoteResponse,
			normalizeNote,
			noteUpdates: new Map<string, Promise<unknown>>()
		};
		const update = evaluate<(token: string, id: string, note: object) => Promise<unknown>>(
			`(${initializer(apiPath, 'updateNoteById')})`,
			context
		);
		await expect(update('test', 'A', { title: 'Draft' })).rejects.toBeTruthy();
		await expect(update('test', 'A', { title: 'Retry' })).resolves.toMatchObject({
			title: 'Title A'
		});
		expect(context.noteUpdates.size).toBe(0);
	}
);

it('keeps a newer load active and handles A to B to A generations', async () => {
	const { context, init } = setup();
	const first = deferred<ReturnType<typeof noteRecord>>();
	const latest = deferred<ReturnType<typeof noteRecord>>();
	context.getNoteById
		.mockReturnValueOnce(first.promise)
		.mockResolvedValueOnce(noteRecord('B'))
		.mockReturnValueOnce(latest.promise);
	const old = init();
	context.id = 'B';
	await init();
	context.id = 'A';
	const current = init();
	first.resolve(noteRecord('A'));
	await old;
	expect(context.loading).toBe(true);
	expect(context.note.id).toBe('B');
	latest.resolve({ ...noteRecord('A'), title: 'Current A' });
	await current;
	expect(context.note.title).toBe('Current A');
	expect(context.loading).toBe(false);
});
it('rejects events for B while the retained draft belongs to A', async () => {
	const { context } = setup();
	context.id = 'B';
	const before = structuredClone(context.note);
	const eventContext = { ...context, console: { log: vi.fn() } };
	for (const name of ['noteEventHandler', 'applyExternalNoteContent']) {
		const handler = evaluate<(note: object) => Promise<unknown>>(
			`(${initializer(editorPath, name)})`,
			eventContext
		);
		await handler(noteRecord('B'));
		expect(eventContext.note).toEqual(before);
	}
});
it('lets another note save while A is slow, then recovers the queued A after failure', async () => {
	const first = deferred<Response>();
	const fetch = vi
		.fn<Parameters<typeof globalThis.fetch>, ReturnType<typeof globalThis.fetch>>()
		.mockReturnValueOnce(first.promise)
		.mockImplementation(async () => new Response(JSON.stringify(noteRecord())));
	const context = {
		WEBUI_API_BASE_URL: '',
		fetch,
		readNoteResponse,
		normalizeNote,
		noteUpdates: new Map<string, Promise<unknown>>()
	};
	const update = evaluate<(token: string, id: string, note: object) => Promise<unknown>>(
		`(${initializer(apiPath, 'updateNoteById')})`,
		context
	);
	const old = update('test', 'A', { title: 'Old' });
	const rejection = expect(old).rejects.toThrow('Offline');
	await settle();
	const next = update('test', 'A', { title: 'Latest' });
	await update('test', 'B', { title: 'B' });
	expect(fetch).toHaveBeenCalledTimes(2);
	first.reject(new Error('Offline'));
	await rejection;
	await next;
	expect(fetch).toHaveBeenCalledTimes(3);
	expect(context.noteUpdates.size).toBe(0);
});
