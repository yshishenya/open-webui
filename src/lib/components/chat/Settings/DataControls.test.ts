// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { convertOpenAIChats, getImportOrigin } from '$lib/utils';
import { getErrorMessage } from '$lib/utils/airis/error_message';
import { parseChatImport } from '$lib/utils/airis/chat_import';
vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
});
afterEach(() => {
	vi.restoreAllMocks();
});
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
const wrapped = {
	chat: { title: 'Private conversation', messages: [] },
	meta: { label: 'private' },
	folder_id: 'folder',
	created_at: 10,
	updated_at: 20,
	pinned: true
};
const rig = (text = JSON.stringify([wrapped])) => {
	const source = readFileSync('src/lib/components/chat/Settings/DataControls.svelte', 'utf8'),
		script = parse(source).instance!;
	const parsed = ts.createSourceFile(
		'controls.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const reactive = parsed.statements
		.filter(ts.isLabeledStatement)
		.map((n) => n.getText(parsed).replace(/^\$:/, ''))
		.join('\n');
	const code = parsed.statements
		.filter((n) => !ts.isImportDeclaration(n) && !ts.isLabeledStatement(n))
		.map((n) => n.getText(parsed).replace('const importChatsHandler', 'let importChatsHandler'))
		.join('\n');
	const api = vi.fn<[string, object[]], Promise<object[]>>(async () => [{ id: 'imported' }]),
		refresh = vi.fn<[string, { refreshPinned?: boolean; clearPinned?: boolean }?], Promise<object>>(
			async () => ({})
		);
	const error = vi.fn(),
		success = vi.fn(),
		save = vi.fn<[Blob, string], void>(),
		archive = vi.fn(async () => true),
		remove = vi.fn(async () => true),
		all = vi.fn(async () => [wrapped]),
		navigate = vi.fn(async () => {});
	const read = vi.fn(async () => text),
		input = { files: [{ text: read }], value: 'history.json' },
		storage = { token: 'original-session' },
		log = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
	const jobs: Promise<unknown>[] = [],
		destroy: (() => void)[] = [];
	class Reader {
		onload: ((event: { target: { result: string } }) => unknown) | null = null;
		onerror: (() => void) | null = null;
		readAsText(file: { text: () => Promise<string> }): void {
			const job = file.text().then(
				(result) => this.onload?.({ target: { result } }),
				() => this.onerror?.()
			);
			job.catch(() => {});
			jobs.push(job);
		}
	}
	const actual = runInNewContext(
		ts.transpileModule(
			code +
				`\nif (typeof importChatsHandler === 'function') { const original = importChatsHandler; importChatsHandler = (...args) => { const job = original(...args); job.catch(() => {}); jobs.push(job); return job; }; }` +
				`\n({ load: async (input) => { if (typeof importFileHandler === 'function') await importFileHandler({ currentTarget: input }); else { importFiles = input.files; ${reactive}; for (let i = 0; i < jobs.length; i++) await jobs[i]; } }, busy: () => typeof importing === 'undefined' ? false : importing, export: exportChats, archive: archiveAllChatsHandler, remove: deleteAllChatsHandler });`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		{
			parseChatImport,
			convertOpenAIChats,
			getImportOrigin,
			getErrorMessage,
			jobs,
			getContext: () => ({}),
			onDestroy: (fn: () => void) => destroy.push(fn),
			$i18n: { t: (key: string) => key },
			importChats: api,
			refreshChatList: refresh,
			getAllChats: all,
			archiveAllChats: archive,
			deleteAllChats: remove,
			goto: navigate,
			toast: { error, success },
			saveAs: save,
			fileSaver: { saveAs: save },
			localStorage: storage,
			console: log,
			FileReader: Reader,
			Blob
		}
	) as {
		load: (selected: typeof input) => Promise<void>;
		busy: () => boolean;
		export: () => Promise<void>;
		archive: () => Promise<void>;
		remove: () => Promise<void>;
	};
	return {
		actual,
		api,
		refresh,
		error,
		success,
		save,
		archive,
		remove,
		all,
		navigate,
		read,
		input,
		storage,
		log,
		destroy: () => destroy.forEach((fn) => fn())
	};
};
it('imports wrapped and legacy AIRIS data without logging private content', async () => {
	const legacy = { title: 'Legacy', created_at: 30 },
		r = rig(JSON.stringify([wrapped, legacy]));
	await r.actual.load(r.input);
	expect(r.api).toHaveBeenCalledWith('original-session', [
		{
			chat: wrapped.chat,
			meta: wrapped.meta,
			pinned: false,
			folder_id: 'folder',
			created_at: 10,
			updated_at: 20
		},
		{ chat: legacy, meta: {}, pinned: false, folder_id: null, created_at: 30, updated_at: null }
	]);
	expect(r.log.log).not.toHaveBeenCalled();
	expect(r.refresh).toHaveBeenCalledWith('original-session', { refreshPinned: true });
	expect(r.input.value).toBe('');
});
it('handles invalid JSON and outer shapes without starting an import', async () => {
	for (const text of [
		'private malformed JSON',
		'null',
		'{}',
		'[null]',
		'[1]',
		'[[]]',
		'[{"chat":null}]',
		'[{"chat":[],"meta":{}}]',
		'[{"chat":{},"meta":1}]',
		'[{"mapping":null}]'
	]) {
		const r = rig(text);
		await expect(r.actual.load(r.input)).resolves.toBeUndefined();
		expect(r.api).not.toHaveBeenCalled();
		expect(r.error).toHaveBeenCalledOnce();
		expect(r.error.mock.calls[0][0]).not.toContain('private malformed');
		expect(r.actual.busy()).toBe(false);
	}
});
it('handles canceled selection and file failure, then permits the same file to retry', async () => {
	const r = rig();
	await expect(r.actual.load({ ...r.input, files: [] })).resolves.toBeUndefined();
	expect(r.api).not.toHaveBeenCalled();
	r.read.mockRejectedValueOnce(new Error('File unavailable'));
	await expect(r.actual.load(r.input)).resolves.toBeUndefined();
	expect(r.error).toHaveBeenCalledOnce();
	expect(r.api).not.toHaveBeenCalled();
	expect(r.actual.busy()).toBe(false);
	await r.actual.load(r.input);
	expect(r.api).toHaveBeenCalledOnce();
	expect(r.input.value).toBe('');
});
it('handles an API rejection without a success or list refresh and permits retry', async () => {
	const r = rig();
	r.api.mockRejectedValueOnce('Denied');
	await expect(r.actual.load(r.input)).resolves.toBeUndefined();
	expect(r.success).not.toHaveBeenCalled();
	expect(r.refresh).not.toHaveBeenCalled();
	expect(r.error).toHaveBeenCalledWith('Denied');
	expect(r.actual.busy()).toBe(false);
	await r.actual.load(r.input);
	expect(r.api).toHaveBeenCalledTimes(2);
});
it('blocks repeated import for the entire read and server response', async () => {
	const r = rig(),
		read = deferred<string>(),
		response = deferred<object[]>();
	r.read.mockImplementationOnce(() => read.promise);
	r.api.mockImplementationOnce(() => response.promise);
	const first = r.actual.load(r.input);
	expect(r.actual.busy()).toBe(true);
	await r.actual.load(r.input);
	read.resolve(JSON.stringify([wrapped]));
	await vi.waitFor(() => expect(r.api).toHaveBeenCalledOnce());
	expect(r.actual.busy()).toBe(true);
	await r.actual.load(r.input);
	response.resolve([{ id: 'created' }]);
	await first;
	expect(r.api).toHaveBeenCalledOnce();
	expect(r.read).toHaveBeenCalledOnce();
	expect(r.actual.busy()).toBe(false);
});
it('does not start an import when reading finishes after destroy or session change', async () => {
	for (const mode of ['destroy', 'session']) {
		const r = rig(),
			read = deferred<string>();
		r.read.mockImplementationOnce(() => read.promise);
		const action = r.actual.load(r.input);
		if (mode === 'destroy') r.destroy();
		else r.storage.token = 'new-session';
		read.resolve(JSON.stringify([wrapped]));
		await action;
		expect(r.api).not.toHaveBeenCalled();
		expect(r.refresh).not.toHaveBeenCalled();
		expect(r.success).not.toHaveBeenCalled();
	}
});
it('does not update another session after an already sent import completes', async () => {
	const r = rig(),
		response = deferred<object[]>();
	r.api.mockImplementationOnce(() => response.promise);
	const action = r.actual.load(r.input);
	await vi.waitFor(() => expect(r.api).toHaveBeenCalledOnce());
	r.storage.token = 'new-session';
	response.resolve([{ id: 'created' }]);
	await action;
	expect(r.api.mock.calls[0][0]).toBe('original-session');
	expect(r.refresh).not.toHaveBeenCalled();
	expect(r.success).not.toHaveBeenCalled();
});
it('retains the confirmed import result when refreshing the list fails', async () => {
	const r = rig();
	r.refresh.mockRejectedValueOnce('Refresh unavailable');
	await expect(r.actual.load(r.input)).resolves.toBeUndefined();
	expect(r.api).toHaveBeenCalledOnce();
	expect(r.success).toHaveBeenCalledWith('Successfully imported 1 chats.');
	expect(r.error).toHaveBeenCalledWith('Refresh unavailable');
	expect(r.input.value).toBe('');
	expect(r.actual.busy()).toBe(false);
});
it('handles export and navigation failures without exporting invalid data or throwing', async () => {
	const r = rig();
	r.all.mockRejectedValueOnce('Export denied');
	await expect(r.actual.export()).resolves.toBeUndefined();
	expect(r.save).not.toHaveBeenCalled();
	expect(r.error).toHaveBeenCalledWith('Export denied');
	for (const action of [r.actual.archive, r.actual.remove]) {
		r.navigate.mockRejectedValueOnce('Navigation failed');
		await expect(action()).resolves.toBeUndefined();
	}
	expect(r.archive).not.toHaveBeenCalled();
	expect(r.remove).not.toHaveBeenCalled();
	await r.actual.export();
	expect(r.save).toHaveBeenCalledOnce();
	expect(r.save.mock.calls[0][0].type).toBe('application/json');
	await r.actual.archive();
	expect(r.archive).toHaveBeenCalledWith('original-session');
	expect(r.refresh).toHaveBeenCalledWith('original-session', { clearPinned: true });
	await r.actual.remove();
	expect(r.remove).toHaveBeenCalledWith('original-session');
	expect(r.refresh).toHaveBeenLastCalledWith('original-session');
	const refreshes = r.refresh.mock.calls.length;
	r.archive.mockRejectedValueOnce('Archive denied');
	r.remove.mockRejectedValueOnce('Delete denied');
	await expect(r.actual.archive()).resolves.toBeUndefined();
	await expect(r.actual.remove()).resolves.toBeUndefined();
	expect(r.refresh).toHaveBeenCalledTimes(refreshes);
	expect(r.error).toHaveBeenCalledWith('Archive denied');
	expect(r.error).toHaveBeenCalledWith('Delete denied');
	r.navigate.mockImplementationOnce(async () => {
		r.storage.token = 'new-session';
	});
	await r.actual.archive();
	expect(r.archive).toHaveBeenCalledTimes(2);
});
it('keeps mixed ChatGPT exports, text, roles, models, dates and skipped metadata', () => {
	const entries = [
		{ title: 'Private project' },
		{
			title: 'Conversation',
			create_time: 10.9,
			update_time: 20.9,
			mapping: {
				one: { message: { author: { role: 'user' }, content: { parts: ['Question'] } } },
				two: {
					message: {
						author: { role: 'assistant' },
						metadata: { model_slug: 'model' },
						content: { text: 'Answer' }
					}
				}
			}
		}
	];
	const rows = parseChatImport(JSON.stringify(entries));
	expect(rows).toMatchObject([
		{
			chat: {
				title: 'Conversation',
				models: ['model'],
				messages: [
					{ role: 'user', content: 'Question' },
					{ role: 'assistant', content: 'Answer' }
				]
			},
			created_at: 10,
			updated_at: 20,
			meta: {},
			pinned: false,
			folder_id: null
		}
	]);
	expect(parseChatImport('[]')).toEqual([]);
});
it('never logs a skipped project title or corrupted message body', () => {
	const logs = vi.spyOn(console, 'log').mockImplementation(() => {}),
		warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
	convertOpenAIChats([
		{ title: 'private-project-title' },
		{ mapping: { broken: { message: { content: null } } } }
	] as unknown as Parameters<typeof convertOpenAIChats>[0]);
	expect(JSON.stringify([...logs.mock.calls, ...warnings.mock.calls])).not.toContain(
		'private-project-title'
	);
	expect(JSON.stringify([...logs.mock.calls, ...warnings.mock.calls])).not.toContain('content');
});
