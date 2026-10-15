import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import {
	normalizeNote,
	readNoteResponse,
	prepareNoteChatOperation,
	completeNoteChatOperation
} from '../src/lib/utils/airis/notes';
import { webcrypto } from 'node:crypto';

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
	access_grants: [{ principal_type: 'user', principal_id: 'reader', permission: 'read' }],
	write_access: true,
	created_at: 1,
	updated_at: 1
});

it('note backing creation retries the original operation after a lost response', async () => {
	const operation = '00000000-0000-4000-8000-000000000001';
	const chat = { id: 'backing-chat', user_id: 'user', meta: { note_id: 'A' } };
	const c = {
		note: noteRecord(),
		$user: { id: 'user' },
		localStorage: { token: 'token' },
		noteChatDraftKey: operation,
		noteChatCreating: false,
		noteChatId: null,
		noteChats: [],
		showNoteChat: false,
		createNoteChatById: vi
			.fn()
			.mockRejectedValueOnce(new Error('lost response'))
			.mockResolvedValue(chat),
		getNoteChatsById: vi.fn().mockResolvedValue([chat]),
		completeNoteChatOperation: vi.fn(),
		transferComposerDraft: vi.fn(),
		readComposerDraft: vi.fn().mockReturnValue(null),
		consumeComposerDraft: vi.fn(),
		sessionStorage: {},
		console: { error: vi.fn(), warn: vi.fn() },
		toast: { error: vi.fn() },
		$i18n: { t: (s: string) => s }
	};
	const create = evaluate<() => Promise<object | null>>(
		`(${initializer(editorPath, 'createNoteChatOnFirstMessage')})`,
		c
	);
	expect(await create()).toBe(null);
	expect(await create()).toEqual(chat);
	expect(c.createNoteChatById.mock.calls).toEqual([
		['token', 'A', operation],
		['token', 'A', operation]
	]);
	expect(c.completeNoteChatOperation).toHaveBeenCalledTimes(1);
});

it.each(['account', 'note', 'draft'])(
	'late backing creation cannot change the new %s',
	async (change) => {
		const response = deferred<object>();
		const c = {
			note: noteRecord(),
			$user: { id: 'user' },
			localStorage: { token: 'token' },
			noteChatDraftKey: '00000000-0000-4000-8000-000000000001',
			noteChatCreating: false,
			noteChats: [] as object[],
			showNoteChat: false,
			createNoteChatById: vi.fn().mockReturnValue(response.promise),
			getNoteChatsById: vi.fn().mockResolvedValue([]),
			completeNoteChatOperation: vi.fn(),
			transferComposerDraft: vi.fn(),
			readComposerDraft: vi.fn().mockReturnValue(null),
			consumeComposerDraft: vi.fn(),
			sessionStorage: {},
			console: { error: vi.fn(), warn: vi.fn() },
			toast: { error: vi.fn() },
			$i18n: { t: (s: string) => s }
		};
		const create = evaluate<() => Promise<object | null>>(
			`(${initializer(editorPath, 'createNoteChatOnFirstMessage')})`,
			c
		);
		const pending = create();
		if (change === 'account') {
			c.$user.id = 'other';
			c.localStorage.token = 'other-token';
		}
		if (change === 'note') c.note = noteRecord('B');
		if (change === 'draft') c.noteChatDraftKey = '00000000-0000-4000-8000-000000000002';
		response.resolve({ id: 'old-chat', user_id: 'user', meta: { note_id: 'A' } });
		expect(await pending).toBe(null);
		expect(c.noteChats).toEqual([]);
		expect(c.getNoteChatsById).not.toHaveBeenCalled();
		expect(c.completeNoteChatOperation).not.toHaveBeenCalled();
	}
);

it('note operation persists across retries and is isolated by actor and note', async () => {
	const data = new Map<string, string>();
	const storage = {
		getItem: (key: string): string | null => data.get(key) ?? null,
		setItem: (key: string, value: string): void => {
			data.set(key, value);
		},
		removeItem: (key: string): void => {
			data.delete(key);
		},
		clear: (): void => {
			data.clear();
		},
		key: (index: number): string | null => [...data.keys()][index] ?? null,
		get length(): number {
			return data.size;
		}
	};
	vi.stubGlobal('crypto', webcrypto);
	vi.stubGlobal('navigator', {
		locks: { request: async (_key: string, run: () => Promise<string>) => await run() }
	});
	try {
		const original = await prepareNoteChatOperation(storage, 'user', 'A');
		expect(await prepareNoteChatOperation(storage, 'user', 'A')).toBe(original);
		expect(await prepareNoteChatOperation(storage, 'other', 'A')).not.toBe(original);
		expect(await prepareNoteChatOperation(storage, 'user', 'B')).not.toBe(original);
		completeNoteChatOperation(storage, 'user', 'A', 'stale');
		expect(await prepareNoteChatOperation(storage, 'user', 'A')).toBe(original);
		completeNoteChatOperation(storage, 'user', 'A', original);
		expect(await prepareNoteChatOperation(storage, 'user', 'A')).not.toBe(original);
		storage.setItem('airis-pending-note-chat:["user","A"]', 'corrupt');
		await expect(prepareNoteChatOperation(storage, 'user', 'A')).rejects.toThrow('Invalid saved');
		vi.spyOn(storage, 'setItem').mockImplementation(() => {
			throw new Error('quota exceeded');
		});
		await expect(prepareNoteChatOperation(storage, 'user', 'C')).rejects.toThrow('quota exceeded');
	} finally {
		vi.unstubAllGlobals();
	}
});

it('note chat API sends the operation identifier to the native endpoint', async () => {
	const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'created' }) });
	const create = evaluate<(token: string, noteId: string, operation: string) => Promise<object>>(
		`(${initializer(apiPath, 'createNoteChatById')})`,
		{ fetch, WEBUI_API_BASE_URL: '/api/v1', encodeURIComponent }
	);
	const operation = '00000000-0000-4000-8000-000000000001';
	expect(await create('token', 'A', operation)).toEqual({ id: 'created' });
	expect(fetch.mock.calls[0][0]).toBe(`/api/v1/notes/A/chat?operation_id=${operation}`);
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
		access_grants: [{ principal_type: 'user', principal_id: 'reader', permission: 'read' }]
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
it('keeps omitted content on socket updates and normalizes explicit legacy nulls', async () => {
	const { context } = setup();
	const eventContext = {
		...context,
		editor: null,
		lastLocalContentChangeAt: 0,
		normalizeNote,
		console: { log: vi.fn(), info: vi.fn() },
		tick: async (): Promise<void> => {},
		applyExternalNoteContent: null as ((note: object) => Promise<boolean>) | null
	};
	eventContext.applyExternalNoteContent = evaluate<(note: object) => Promise<boolean>>(
		`(${initializer(editorPath, 'applyExternalNoteContent')})`,
		eventContext
	);
	const update = evaluate<(note: object) => Promise<void>>(
		`(${initializer(editorPath, 'noteEventHandler')})`,
		eventContext
	);
	const content = structuredClone(context.note.data.content);
	await update({ id: 'A', title: 'Remote', data: { files: [] }, updated_at: 2 });
	expect(eventContext.note.data.content).toEqual(content);
	expect(eventContext.note.data.files).toEqual([]);
	await update({ id: 'A', data: { content: { md: 'Remote text' } }, updated_at: 3 });
	expect(eventContext.note.data.content).toEqual({ ...content, md: 'Remote text' });
	await update({ id: 'A', data: { content: { md: null, html: null, json: null } }, updated_at: 4 });
	expect(eventContext.note.data.content).toEqual({ md: '', html: '', json: null });
	await update({ id: 'A', data: { content: { md: 'Stale' } }, updated_at: 1 });
	expect(eventContext.note.data.content.md).toBe('');
});
it('keeps image compression optional and applies numeric upper bounds with empty settings', async () => {
	const compressImage = vi.fn().mockResolvedValue('compressed');
	const compress = evaluate<(url: string, settings?: object, config?: object) => Promise<string>>(
		`(${initializer(editorPath, 'compressImageHandler')})`,
		{ compressImage }
	);
	expect(await compress('image')).toBe('image');
	expect(compressImage).not.toHaveBeenCalled();
	expect(
		await compress('image', {
			imageCompression: true,
			imageCompressionSize: { width: '', height: 900 }
		})
	).toBe('compressed');
	expect(compressImage).toHaveBeenLastCalledWith('image', null, 900);
	await compress(
		'image',
		{ imageCompression: true, imageCompressionSize: { width: 1200, height: 0 } },
		{ file: { image_compression: { width: 800, height: 600 } } }
	);
	expect(compressImage).toHaveBeenLastCalledWith('image', 800, null);
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

// Persisted metadata must be safe before the editor consumes it.
it.each([
	{ created_at: '1' },
	{ updated_at: null },
	{ created_at: NaN },
	{ write_access: 'false' },
	{ access_grants: [{ principal_type: 'user' }] },
	{ data: { content: { json: { content: [null] } } } },
	{ data: { content: { json: { marks: [{ type: 1 }] } } } },
	{ data: { versions: 'broken' } },
	{ data: { versions: [null] } },
	{ data: { versions: [{ md: 42 }] } },
	{ data: { files: [{ content_type: 42 }] } }
])('rejects unsafe persisted note fields %s', (fields) => {
	expect(() => normalizeNote({ ...noteRecord(), ...fields })).toThrow();
});
it('preserves sparse versions, attachments and nullable legacy lists', () => {
	const original = {
		...noteRecord(),
		data: {
			content: noteRecord().data.content,
			files: [{ id: null, name: 'draft', type: 'file', status: 'uploading', custom: 42 }],
			versions: [{ md: 'old', custom: { keep: true } }]
		}
	};
	expect(normalizeNote(original)).toEqual(original);
	expect(
		normalizeNote({ ...noteRecord(), data: { versions: null, files: null } }).data.files
	).toEqual([]);
});

it.each(['json', 'markdown', 'html', 'empty'])('keeps the shared rich-text %s path', (mode) => {
	const doc = {
		type: 'doc',
		content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New' }] }]
	};
	const setContent = vi.fn();
	const clearContent = vi.fn();
	const context = {
		value: mode === 'json' ? doc : mode === 'empty' ? '' : 'New',
		json: mode === 'json',
		raw: mode === 'html',
		preserveBreaks: false,
		editor: {
			getJSON: () => ({ type: 'doc' }),
			getHTML: () => '<p>Old</p>',
			commands: { setContent, clearContent }
		},
		turndownService: { turndown: () => 'Old' },
		marked: { parse: (s: string) => `<p>${s}</p>` },
		equal: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b),
		selectTemplate: vi.fn()
	};
	const change = evaluate<() => void>(
		`(${initializer('src/lib/components/common/RichTextInput.svelte', 'onValueChange')})`,
		context
	);
	change();
	if (mode === 'empty') expect(clearContent).toHaveBeenCalledOnce();
	else
		expect(setContent).toHaveBeenCalledWith(
			mode === 'json' ? doc : mode === 'html' ? 'New' : '<p>New</p>'
		);
});

it('replaces variables with an own hasOwnProperty key and a null prototype', () => {
	for (const variables of [
		{ name: 'Kept', hasOwnProperty: 'shadow' },
		Object.assign(Object.create(null), { name: 'Kept' })
	]) {
		const replaceWith = vi.fn().mockReturnThis();
		const dispatch = vi.fn();
		const state = {
			doc: {
				descendants: (visit: (node: object, pos: number) => void) =>
					visit({ isText: true, text: '{{ name }}' }, 0)
			},
			tr: { replaceWith },
			schema: { text: (text: string) => text }
		};
		const context = {
			editor: { state, view: { dispatch } },
			textToNodes: (_: object, text: string) => text
		};
		const replace = evaluate<(variables: Record<string, unknown>) => void>(
			`(${initializer('src/lib/components/common/RichTextInput.svelte', 'replaceVariables')})`,
			context
		);
		replace(variables);
		expect(replaceWith).toHaveBeenCalledWith(0, 10, 'Kept');
		expect(dispatch).toHaveBeenCalledOnce();
	}
});

it('keeps valid JSON awareness states and rejects malformed decoded records', () => {
	const path = 'src/lib/components/common/RichTextInput/Collaboration.ts';
	const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest);
	const definition = source.statements.find(
		(statement) => ts.isClassDeclaration(statement) && statement.name?.text === 'SimpleAwareness'
	);
	if (!definition) throw new Error('Missing SimpleAwareness');
	type State = Record<string, unknown> | null;
	type Change = { added: number[]; updated: number[]; removed: number[] };
	type Fixture = {
		setLocalStateField: (name: string, value: unknown) => void;
		on: (event: string, handler: (change: Change, origin: string) => void) => void;
		encodeUpdate: (clients: number[]) => Uint8Array;
		applyUpdate: (update: Uint8Array, origin: string) => void;
		getStates: () => Map<number, State>;
	};
	const warn = vi.fn();
	const create = evaluate<(doc: { clientID: number }) => Fixture>(
		`const isAwarenessState=${initializer(path, 'isAwarenessState')}; ${definition.getText(source)}; (doc=>new SimpleAwareness(doc))`,
		{ TextEncoder, TextDecoder, console: { warn } }
	);
	const first = create({ clientID: 7 });
	const changed = vi.fn();
	first.on('change', changed);
	const state = { name: 'User', custom: { keep: true } };
	first.setLocalStateField('user', state);
	expect(changed).toHaveBeenCalledOnce();
	const second = create({ clientID: 8 });
	second.applyUpdate(first.encodeUpdate([7]), 'server');
	expect(second.getStates().get(7)).toEqual({ user: state });
	second.applyUpdate(new TextEncoder().encode('{"9":null}'), 'server');
	expect(second.getStates().get(9)).toBeNull();
	for (const invalid of ['[]', 'null', '{"7":"broken"}']) {
		second.applyUpdate(new TextEncoder().encode(invalid), 'server');
		expect(second.getStates().get(7)).toEqual({ user: state });
	}
	expect(warn).toHaveBeenCalledTimes(3);
});

it('opening a pending note restores its operation without a new backing creation', async () => {
	const c = {
		note: noteRecord(),
		$user: { id: 'user' },
		localStorage: { token: 'token' },
		noteChatLoading: false,
		noteChatId: null,
		noteChatDraftKey: '',
		showNoteChat: false,
		readNoteChatOperation: vi.fn().mockReturnValue('saved-operation'),
		getNoteChatById: vi.fn(),
		console: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
		toast: { error: vi.fn() },
		$i18n: { t: (s: string) => s }
	};
	await evaluate<() => Promise<void>>(`(${initializer(editorPath, 'openNoteChat')})`, c)();
	expect(c.noteChatDraftKey).toBe('saved-operation');
	expect(c.showNoteChat).toBe(true);
	expect(c.getNoteChatById).not.toHaveBeenCalled();
});

it('failed draft transfer keeps the note operation and does not accept its backing chat', async () => {
	const c = {
		note: noteRecord(),
		$user: { id: 'user' },
		localStorage: { token: 'token' },
		sessionStorage: {},
		noteChatDraftKey: 'operation',
		noteChatCreating: false,
		noteChats: [],
		showNoteChat: false,
		createNoteChatById: vi
			.fn()
			.mockResolvedValue({ id: 'backing', user_id: 'user', meta: { note_id: 'A' } }),
		getNoteChatsById: vi.fn().mockResolvedValue([]),
		readComposerDraft: vi.fn().mockReturnValue({ prompt: 'raw', files: [] }),
		transferComposerDraft: vi.fn(() => {
			throw new Error('quota exceeded');
		}),
		consumeComposerDraft: vi.fn(),
		completeNoteChatOperation: vi.fn(),
		console: { error: vi.fn(), warn: vi.fn() },
		toast: { error: vi.fn() },
		$i18n: { t: (s: string) => s }
	};
	expect(
		await evaluate<() => Promise<object | null>>(
			`(${initializer(editorPath, 'createNoteChatOnFirstMessage')})`,
			c
		)()
	).toBe(null);
	expect(c.completeNoteChatOperation).not.toHaveBeenCalled();
	expect(c.consumeComposerDraft).not.toHaveBeenCalled();
	expect(c.noteChatDraftKey).toBe('operation');
});
