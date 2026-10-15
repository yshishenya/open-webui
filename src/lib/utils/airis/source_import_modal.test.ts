// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { loadToolByUrl } from '$lib/apis/tools';
import { getErrorMessage } from './error_message';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));

const transpile = (code: string): string =>
	ts.transpileModule(code.replace(/\bexport\s+/g, ''), {
		compilerOptions: { target: ts.ScriptTarget.ES2022, alwaysStrict: true }
	}).outputText;
const scriptParts = (path: string) => {
	const source = readFileSync(path, 'utf8'),
		script = parse(source).instance!;
	const parsed = ts.createSourceFile(
		'component.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	return {
		code: parsed.statements
			.filter((s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s))
			.map((s) => s.getText(parsed))
			.join('\n'),
		reactive: parsed.statements
			.filter(ts.isLabeledStatement)
			.map((s) => s.statement.getText(parsed))
			.join('\n')
	};
};
const utils = ts.createSourceFile(
	'utils.ts',
	readFileSync('src/lib/utils/index.ts', 'utf8'),
	ts.ScriptTarget.Latest,
	true
);
const realUtils = utils.statements
	.filter(
		(s) =>
			ts.isVariableStatement(s) &&
			['extractFrontmatter', 'nameToId'].includes(
				s.declarationList.declarations[0].name.getText(utils)
			)
	)
	.map((s) => s.getText(utils))
	.join('\n');
const deferred = <T>() => {
	let resolve!: (v: T) => void;
	const promise = new Promise<T>((fn) => {
		resolve = fn;
	});
	return { promise, resolve };
};
const payload = {
	name: 'Example',
	content: '"""\ntitle: Source title\ndescription: Source description\n"""\ncode',
	meta: { extra: 7 }
};
const importRig = () => {
	const p = scriptParts(process.env.IMPORT_SOURCE ?? 'src/lib/components/ImportModal.svelte');
	const destroy: (() => void)[] = [],
		errors: string[] = [],
		successes: string[] = [];
	const loader = vi.fn<[string, AbortSignal?], Promise<unknown>>(async () => ({ ...payload }));
	const accept = vi.fn<[unknown], Promise<void>>(async () => undefined),
		close = vi.fn();
	const api = runInNewContext(
		transpile(
			realUtils +
				'\n' +
				p.code +
				`\nloadUrlHandler=loader;onImport=accept;onClose=close;show=true;url='https://example.test/source';
 ({submit:submitHandler,loading:()=>loading,show:()=>show,message:()=>successMessage,setShow:(v)=>{show=v;${p.reactive}},setUrl:(v)=>url=v})`
		),
		{
			exports: {},
			AbortController,
			Error,
			getErrorMessage,
			getContext: () => ({}),
			$i18n: { t: (s: string) => s },
			onMount: () => undefined,
			onDestroy: (fn: () => void) => destroy.push(fn),
			toast: { error: (s: string) => errors.push(s), success: (s: string) => successes.push(s) },
			loader,
			accept,
			close
		}
	) as {
		submit: () => Promise<void>;
		loading: () => boolean;
		show: () => boolean;
		message: () => string;
		setShow: (v: boolean) => void;
		setUrl: (v: string) => void;
	};
	api.setShow(true);
	return {
		api,
		loader,
		accept,
		close,
		errors,
		successes,
		destroy: () => destroy.forEach((fn) => fn())
	};
};
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
it('accepts a valid source and releases loading without changing the response', async () => {
	const r = importRig(),
		response = { ...payload };
	r.loader.mockResolvedValue(response);
	await r.api.submit();
	expect(r.accept).toHaveBeenCalledWith({
		...payload,
		id: 'example',
		name: 'Source title',
		meta: { extra: 7, description: 'Source description' }
	});
	expect(r.api.loading()).toBe(false);
	expect(response).toEqual(payload);
	expect(r.successes).toHaveLength(1);
});
it('accepts frozen responses without mutating the success prop', async () => {
	const r = importRig();
	r.loader.mockResolvedValue(Object.freeze({ ...payload, meta: Object.freeze(payload.meta) }));
	await expect(r.api.submit()).resolves.toBeUndefined();
	expect(r.accept).toHaveBeenCalledTimes(1);
	expect(r.api.message()).toBe('');
});
it.each([
	null,
	{},
	[],
	{ ...payload, content: 2 },
	{ ...payload, meta: [] },
	{ ...payload, id: 7 }
])('contains invalid response %j and allows retry', async (value) => {
	const r = importRig();
	r.loader.mockResolvedValue(value);
	await expect(r.api.submit()).resolves.toBeUndefined();
	expect(r.accept).not.toHaveBeenCalled();
	expect(r.successes).toEqual([]);
	expect(r.errors).toHaveLength(1);
	expect(r.api.loading()).toBe(false);
	r.loader.mockResolvedValue({ ...payload });
	await r.api.submit();
	expect(r.accept).toHaveBeenCalledTimes(1);
});
it('awaits acceptance and contains callback refusal before success', async () => {
	const r = importRig(),
		d = deferred<void>();
	r.accept.mockImplementation(() => d.promise);
	const pending = r.api.submit();
	await setImmediate();
	expect(r.successes).toEqual([]);
	expect(r.api.loading()).toBe(true);
	d.resolve();
	await pending;
	expect(r.successes).toHaveLength(1);
	const refusal = importRig();
	refusal.accept.mockRejectedValue(Error('editor refused'));
	await expect(refusal.api.submit()).resolves.toBeUndefined();
	expect(refusal.successes).toEqual([]);
	expect(refusal.errors).toEqual(['editor refused']);
	expect(refusal.api.loading()).toBe(false);
});
it('contains network refusal and does not overlap duplicate submits', async () => {
	const r = importRig(),
		d = deferred<unknown>();
	r.loader.mockImplementation(() => d.promise);
	const pending = r.api.submit();
	await r.api.submit();
	expect(r.loader).toHaveBeenCalledTimes(1);
	d.resolve(payload);
	await pending;
	const failed = importRig();
	failed.loader.mockRejectedValue(Error('network refused'));
	await failed.api.submit();
	expect(failed.errors).toEqual(['network refused']);
	expect(failed.api.loading()).toBe(false);
});
it.each(['close', 'destroy'] as const)(
	'ignores late response after %s and cancels its request',
	async (action) => {
		const r = importRig(),
			d = deferred<unknown>();
		r.loader.mockImplementation(() => d.promise);
		const pending = r.api.submit();
		if (action === 'close') r.api.setShow(false);
		else r.destroy();
		expect(r.loader.mock.calls[0][1]?.aborted).toBe(true);
		d.resolve(payload);
		await pending;
		expect(r.accept).not.toHaveBeenCalled();
		expect(r.successes).toEqual([]);
		expect(r.errors).toEqual([]);
		expect(r.api.loading()).toBe(false);
	}
);
it('ignores an old result after close and reopen without unlocking a newer request', async () => {
	const r = importRig(),
		old = deferred<unknown>(),
		fresh = deferred<unknown>();
	r.loader.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => fresh.promise);
	const first = r.api.submit();
	r.api.setShow(false);
	r.api.setShow(true);
	const second = r.api.submit();
	old.resolve(payload);
	await first;
	expect(r.api.loading()).toBe(true);
	expect(r.accept).not.toHaveBeenCalled();
	fresh.resolve(payload);
	await second;
	expect(r.accept).toHaveBeenCalledTimes(1);
	expect(r.api.loading()).toBe(false);
});
it('rejects a tools URL network refusal with the real adapter', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => {
			throw Error('network refused');
		})
	);
	await expect(loadToolByUrl('token', 'https://example.test')).rejects.toThrow('network refused');
});
it('preserves URL POST, bearer and body; cancellation remains active through the response', async () => {
	vi.useFakeTimers();
	let signal!: AbortSignal;
	const fetch = vi.fn(async (_url: string, init: RequestInit) => {
		signal = init.signal!;
		return {
			ok: true,
			json: () =>
				new Promise((_resolve, reject) =>
					signal.addEventListener('abort', () => reject(signal.reason), { once: true })
				)
		};
	});
	vi.stubGlobal('fetch', fetch);
	const controller = new AbortController(),
		pending = loadToolByUrl('token', 'https://example.test', controller.signal),
		assertion = expect(pending).rejects.toThrow('cancelled');
	await vi.advanceTimersByTimeAsync(0);
	expect(fetch.mock.calls[0]).toEqual([
		'/api/v1/tools/load/url',
		expect.objectContaining({
			method: 'POST',
			body: JSON.stringify({ url: 'https://example.test' }),
			headers: expect.objectContaining({ Authorization: 'Bearer token' })
		})
	]);
	controller.abort(Error('cancelled'));
	await assertion;
	expect(vi.getTimerCount()).toBe(0);
});

class TrackedTarget {
	listeners = new Map<string, Set<unknown>>();
	addEventListener(name: string, fn: unknown): void {
		if (!this.listeners.has(name)) this.listeners.set(name, new Set());
		this.listeners.get(name)!.add(fn);
	}
	removeEventListener(name: string, fn: unknown): void {
		this.listeners.get(name)?.delete(fn);
	}
	count(): number {
		return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
	}
}
class FakeElement extends TrackedTarget {
	parentNode: FakeBody | null = null;
	contains(target: unknown): boolean {
		return target === this;
	}
	closest(): null {
		return null;
	}
}
class FakeBody {
	style = { overflow: 'auto' };
	children: FakeElement[] = [];
	appendChild(el: FakeElement): void {
		this.children = this.children.filter((e) => e !== el);
		this.children.push(el);
		el.parentNode = this;
	}
	removeChild(el: FakeElement): void {
		if (el.parentNode !== this) throw Error('not a child');
		this.children = this.children.filter((e) => e !== el);
		el.parentNode = null;
	}
}
const modalEnvironment = () => {
	const body = new FakeBody(),
		doc = Object.assign(new TrackedTarget(), { body, getElementsByClassName: () => body.children }),
		win = new TrackedTarget();
	return { body, doc, win };
};
const modalRig = (env = modalEnvironment()) => {
	const p = scriptParts(process.env.MODAL_SOURCE ?? 'src/lib/components/common/Modal.svelte'),
		destroy: (() => void)[] = [],
		element = new FakeElement();
	const trap = { activate: vi.fn(), deactivate: vi.fn(), pause: vi.fn(), unpause: vi.fn() };
	const api = runInNewContext(
		transpile(
			p.code +
				`\nmodalElement=element;({open:()=>{show=true;${p.reactive}},close:()=>{show=false;${p.reactive}}})`
		),
		{
			exports: {},
			element,
			document: env.doc,
			window: env.win,
			Element: FakeElement,
			Node: FakeElement,
			console: { log: () => undefined },
			FocusTrap: { createFocusTrap: () => trap },
			onMount: (fn: () => void) => fn(),
			onDestroy: (fn: () => void) => destroy.push(fn)
		}
	) as { open: () => void; close: () => void };
	return { env, api, element, trap, destroy: () => destroy.forEach((fn) => fn()) };
};
it('normal close removes its listeners, node and scroll lock', () => {
	const r = modalRig();
	r.api.open();
	r.api.close();
	expect(r.env.body.children).toEqual([]);
	expect(r.env.doc.count() + r.env.win.count() + r.element.count()).toBe(0);
	expect(r.env.body.style.overflow).not.toBe('hidden');
});
it('destroy removes all listeners and restores scrolling', () => {
	const r = modalRig();
	r.api.open();
	r.destroy();
	expect(r.env.body.children).toEqual([]);
	expect(r.env.doc.count() + r.env.win.count() + r.element.count()).toBe(0);
	expect(r.env.body.style.overflow).not.toBe('hidden');
});
it('retains the scroll lock of another open dialog and cleanup is idempotent', () => {
	const env = modalEnvironment(),
		first = modalRig(env),
		second = modalRig(env);
	first.api.open();
	second.api.open();
	first.api.close();
	expect(env.body.style.overflow).toBe('hidden');
	expect(() => first.destroy()).not.toThrow();
	second.destroy();
	expect(env.body.style.overflow).not.toBe('hidden');
	expect(env.doc.count() + env.win.count()).toBe(0);
});

it('loads a real tools source response and enforces the 60 second deadline', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify(payload)))
	);
	await expect(loadToolByUrl('token', 'https://example.test')).resolves.toEqual(payload);
	vi.useFakeTimers();
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, init: RequestInit) => ({
			ok: true,
			json: () =>
				new Promise((_resolve, reject) =>
					init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })
				)
		}))
	);
	const pending = loadToolByUrl('token', 'https://example.test');
	const assertion = expect(pending).rejects.toThrow('timed out');
	await vi.advanceTimersByTimeAsync(60_000);
	await assertion;
	expect(vi.getTimerCount()).toBe(0);
});
it('reports close once and tolerates repeated cleanup before reopening', async () => {
	const r = importRig();
	r.api.setShow(false);
	r.api.setShow(false);
	expect(r.close).toHaveBeenCalledTimes(1);
	r.api.setShow(true);
	await r.api.submit();
	expect(r.accept).toHaveBeenCalledTimes(1);
	const modal = modalRig();
	modal.api.open();
	modal.api.close();
	modal.api.close();
	modal.destroy();
	expect(modal.env.doc.count() + modal.env.win.count()).toBe(0);
});
it('does not report success for an acceptance completed after close', async () => {
	const r = importRig(),
		d = deferred<void>();
	r.accept.mockImplementation(() => d.promise);
	const pending = r.api.submit();
	await setImmediate();
	r.api.setShow(false);
	d.resolve();
	await pending;
	expect(r.successes).toEqual([]);
	expect(r.errors).toEqual([]);
	expect(r.api.loading()).toBe(false);
});
