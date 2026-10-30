// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { getErrorMessage } from './error_message';
const constantsSource = ts.createSourceFile('constants.ts', readFileSync('src/lib/constants.ts', 'utf8'), ts.ScriptTarget.Latest);
const origins = constantsSource.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations]).find(d => d.name.getText(constantsSource) === 'COMMUNITY_ORIGINS');
if (!origins?.initializer) throw new Error('Missing community origin list');
const COMMUNITY_ORIGINS = runInNewContext(origins.initializer.getText(constantsSource)) as string[];

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((fn) => (resolve = fn));
	return { promise, resolve };
};
const rig = (
	origin: string | null = 'https://chat.test',
	referrer = origin ? `${origin}/community` : ''
) => {
	const source = readFileSync(
		process.env.STATS_SOURCE ?? 'src/lib/components/chat/Settings/SyncStatsModal.svelte',
		'utf8'
	);
	const script = parse(source).instance!;
	const parsed = ts.createSourceFile(
		'component.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const code = parsed.statements
		.filter((s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s))
		.map((s) => s.getText(parsed).replace(/^export\s+/, ''))
		.join('\n');
	const reactive = parsed.statements
		.filter(ts.isLabeledStatement)
		.map((s) => s.statement.getText(parsed))
		.join('\n');
	const opener = { postMessage: vi.fn(), focus: vi.fn() };
	const destroy: (() => void)[] = [],
		mount: (() => void)[] = [];
	const win = {
		opener,
		location: { origin: 'https://chat.test' },
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		URL: { createObjectURL: vi.fn<[Blob], string>(() => 'blob:stats'), revokeObjectURL: vi.fn() }
	};
	const page = vi.fn(async () => ({ items: [{ id: 'chat' }], total: 1 }));
	const verify = vi.fn(async () => ({ id: 'chat', stats: { message_count: 1 } }));
	const controller = new AbortController();
	const download = vi.fn(async () => [new Response('{"id":"чат"}\n'), controller]);
	const click = vi.fn();
	const errors = vi.fn();
	const api = runInNewContext(
		ts.transpileModule(
			code +
				`\neventData={requestId:'request',searchParams:{}};openerOrigin=origin;show=true;${reactive}\n` +
				`({sync:syncStats,verify:handleMessage,download:downloadHandler,cancel:cancelOperation,close:closeModal,
				setShow:(v)=>{show=v;${reactive}},state:()=>({syncing,downloading,completed,error}),
				setOpener:(v)=>window.opener=v})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		{
			origin,
			COMMUNITY_ORIGINS,
			syncRequest: null,
			openerOrigin: null,
			window: win,
			document: {
				referrer,
				createElement: () => ({ click }),
				body: { appendChild: () => undefined, removeChild: () => undefined }
			},
			localStorage: { token: 'test-token' },
			exportChatStats: page,
			exportSingleChatStats: verify,
			downloadChatStats: download,
			getVersion: async () => ({ version: 'test' }),
			getErrorMessage,
			getContext: () => ({}),
			onMount: (fn: () => void) => mount.push(fn),
			onDestroy: (fn: () => void) => destroy.push(fn),
			tick: async () => undefined,
			toast: { error: errors },
			console: { error: vi.fn() },
			URL,
			TextDecoder,
			Blob,
			Error,
			AbortController
		}
	) as {
		sync: () => Promise<void>;
		verify: (event: { origin: string; source: unknown; data: unknown }) => Promise<void>;
		download: () => Promise<void>;
		cancel: () => void;
		close: () => void;
		setShow: (v: boolean) => void;
		state: () => { syncing: boolean; downloading: boolean; completed: boolean; error: boolean };
		setOpener: (v: unknown) => void;
	};
	mount.forEach((fn) => fn());
	opener.postMessage.mockClear();
	return {
		api,
		opener,
		win,
		page,
		verify,
		download,
		controller,
		click,
		errors,
		destroy: () => destroy.forEach((fn) => fn()),
		event: (
			data: unknown = { type: 'verify:chat', id: 'chat' }
		): { origin: string; source: unknown; data: unknown } => ({
			origin: origin ?? '',
			source: opener,
			data
		})
	};
};
it('does not export a chat before the user selects Sync', async () => {
	const r = rig();
	await r.api.verify(r.event());
	expect(r.verify).not.toHaveBeenCalled();
	expect(r.opener.postMessage).not.toHaveBeenCalled();
});
it.each(['https://chat.test', 'http://localhost:9999'])(
	'preserves sync and both verify formats for consenting opener %s',
	async (origin) => {
		const r = rig(origin);
		await r.api.sync();
		expect(r.api.state().completed).toBe(true);
		for (const data of [
			{ type: 'verify:chat', id: 'chat' },
			{ type: 'verify:chat', data: { id: 'chat' } }
		]) {
			await r.api.verify(r.event(data));
		}
		expect(r.verify).toHaveBeenCalledTimes(2);
		const messages = r.opener.postMessage.mock.calls;
		expect(messages.map(([m]) => m.type)).toContain('sync:stats:chats');
		expect(messages.every(([, target]) => target === origin)).toBe(true);
	}
);
it.each(['origin', 'source', 'null-source', 'null-data', 'array-id', 'empty-id'])(
	'rejects untrusted or malformed verify:chat: %s',
	async (kind) => {
		const r = rig();
		await r.api.sync();
		r.opener.postMessage.mockClear();
		const event = r.event();
		if (kind === 'origin') event.origin = 'https://attacker.test';
		if (kind === 'source') event.source = {};
		if (kind === 'null-source') event.source = null;
		if (kind === 'null-data') event.data = null;
		if (kind === 'array-id') event.data = { type: 'verify:chat', id: ['chat'] };
		if (kind === 'empty-id') event.data = { type: 'verify:chat', id: '' };
		await r.api.verify(event);
		expect(r.verify).not.toHaveBeenCalled();
		expect(r.opener.postMessage).not.toHaveBeenCalled();
	}
);
it.each(['cancel', 'close', 'hide', 'destroy'])(
	'ignores a pending verify result after %s',
	async (action) => {
		const r = rig(),
			d = deferred<{ id: string; stats: { message_count: number } }>();
		await r.api.sync();
		r.verify.mockImplementation(() => d.promise);
		const pending = r.api.verify(r.event());
		if (action === 'cancel') r.api.cancel();
		if (action === 'close') r.api.close();
		if (action === 'hide') r.api.setShow(false);
		if (action === 'destroy') r.destroy();
		r.opener.postMessage.mockClear();
		d.resolve({ id: 'chat', stats: { message_count: 1 } });
		await pending;
		expect(r.opener.postMessage).not.toHaveBeenCalled();
	}
);
it('does not send a cancelled page or let it complete a newer sync', async () => {
	const r = rig(),
		old = deferred<{ items: { id: string }[]; total: number }>();
	r.page.mockImplementationOnce(() => old.promise);
	const first = r.api.sync();
	await setImmediate();
	r.api.cancel();
	await r.api.sync();
	r.opener.postMessage.mockClear();
	old.resolve({ items: [{ id: 'old' }], total: 2 });
	await first;
	expect(r.opener.postMessage).not.toHaveBeenCalled();
	expect(r.page).toHaveBeenCalledTimes(2);
	expect(r.api.state().completed).toBe(true);
});
it('pins the target origin when the opener navigates and never uses wildcard for stats/errors', async () => {
	const r = rig();
	await r.api.sync();
	r.verify.mockRejectedValue(Error('failed'));
	await r.api.verify(r.event());
	expect(
		r.opener.postMessage.mock.calls.every(([, origin]) => origin === 'https://chat.test')
	).toBe(true);
	r.api.setOpener({});
	r.opener.postMessage.mockClear();
	await r.api.verify(r.event());
	expect(r.opener.postMessage).not.toHaveBeenCalled();
});
it('refuses a disallowed opener origin before fetching stats', async () => {
	const r = rig('https://attacker.test');
	await r.api.sync();
	expect(r.page).not.toHaveBeenCalled();
	expect(r.opener.postMessage).not.toHaveBeenCalled();
	expect(r.api.state().error).toBe(true);
});
it('downloads valid UTF-8 NDJSON locally without permitting remote verification', async () => {
	const r = rig();
	await r.api.download();
	expect(r.click).toHaveBeenCalledTimes(1);
	await r.api.verify(r.event());
	expect(r.verify).not.toHaveBeenCalled();
});
it.each(['bad-line', 'http-error', 'empty-body'])(
	'does not save a partial or invalid stats response: %s',
	async (kind) => {
		const r = rig();
		const res =
			kind === 'bad-line'
				? new Response('{"id":"first"}\ninvalid\n')
				: kind === 'http-error'
					? new Response('{"detail":"denied"}', { status: 401 })
					: new Response(null);
		r.download.mockResolvedValue([res, r.controller]);
		await r.api.download();
		expect(r.click).not.toHaveBeenCalled();
		expect(r.errors).toHaveBeenCalledTimes(1);
		expect(r.api.state().error).toBe(true);
	}
);

it('uses only a permitted referrer when opened directly and refuses an absent referrer', async () => {
	const valid = rig(null, 'http://localhost:9999/community');
	await valid.api.sync();
	expect(valid.page).toHaveBeenCalledTimes(1);
	expect(
		valid.opener.postMessage.mock.calls.every(([, origin]) => origin === 'http://localhost:9999')
	).toBe(true);
	for (const referrer of ['', 'invalid', 'https://attacker.test/']) {
		const r = rig(null, referrer);
		await r.api.sync();
		expect(r.page).not.toHaveBeenCalled();
		expect(r.opener.postMessage).not.toHaveBeenCalled();
	}
});
it('preserves pagination and pins the synchronization request id', async () => {
	const r = rig();
	r.page
		.mockResolvedValueOnce({ items: [{ id: 'first' }], total: 2 })
		.mockResolvedValueOnce({ items: [{ id: 'second' }], total: 2 });
	await r.api.sync();
	expect(r.page.mock.calls).toEqual([
		['test-token', 1, {}],
		['test-token', 2, {}]
	]);
	expect(
		r.opener.postMessage.mock.calls.every(([message]) => message.requestId === 'request')
	).toBe(true);
});
it('preserves multibyte UTF-8 split between chunks and a final line without newline', async () => {
	const r = rig(),
		bytes = new TextEncoder().encode('\n{"id":"чат"}\n{"id":"last"}');
	const stream = new ReadableStream({
		start(controller) {
			for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
			controller.close();
		}
	});
	r.download.mockResolvedValue([new Response(stream), r.controller]);
	await r.api.download();
	const blob = r.win.URL.createObjectURL.mock.calls[0][0];
	expect(JSON.parse(await blob.text())).toEqual([{ id: 'чат' }, { id: 'last' }]);
});
it('does not save malformed or incomplete UTF-8', async () => {
	const r = rig();
	r.download.mockResolvedValue([new Response(new Uint8Array([0x7b, 0xc3])), r.controller]);
	await r.api.download();
	expect(r.click).not.toHaveBeenCalled();
	expect(r.errors).toHaveBeenCalledTimes(1);
	expect(r.controller.signal.aborted).toBe(true);
});
it('aborts a late download controller without saving or unlocking a newer download', async () => {
	const r = rig(),
		old = deferred<(Response | AbortController)[]>();
	r.download.mockImplementationOnce(() => old.promise);
	const first = r.api.download();
	await setImmediate();
	r.api.cancel();
	const page = deferred<{ items: { id: string }[]; total: number }>();
	r.page.mockImplementationOnce(() => page.promise);
	const second = r.api.download();
	old.resolve([new Response('{}'), r.controller]);
	await first;
	expect(r.controller.signal.aborted).toBe(true);
	expect(r.api.state().downloading).toBe(true);
	expect(r.click).not.toHaveBeenCalled();
	page.resolve({ items: [], total: 0 });
	await second;
	expect(r.click).toHaveBeenCalledTimes(1);
});
it('rejects a failed old verification after cancellation without sending an error', async () => {
	const r = rig(),
		d = deferred<{ id: string; stats: { message_count: number } }>();
	await r.api.sync();
	r.verify.mockImplementation(() =>
		d.promise.then(() => {
			throw Error('late failure');
		})
	);
	const pending = r.api.verify(r.event());
	r.api.cancel();
	r.opener.postMessage.mockClear();
	d.resolve({ id: 'chat', stats: { message_count: 1 } });
	await pending;
	expect(r.opener.postMessage).not.toHaveBeenCalled();
});
