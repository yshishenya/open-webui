// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const source = (): string =>
	readFileSync(
		process.env.AIRIS_WORKSPACE_MODEL_SOURCE ?? 'src/lib/components/workspace/Models.svelte',
		'utf8'
	);
const fixture = { id: 'fixture', name: 'Fixture', meta: {}, params: {}, is_active: true };
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};
const nodes = (value: unknown): Record<string, unknown>[] => {
	if (!value || typeof value !== 'object') return [];
	if (Array.isArray(value)) return value.flatMap(nodes);
	const node = value as Record<string, unknown>;
	return [node, ...Object.values(node).flatMap(nodes)];
};
function setup() {
	const text = source(),
		parsed = parse(text);
	if (!parsed.instance) throw new Error('Missing actual script');
	const ast = ts.createSourceFile(
		'models.ts',
		text.slice(parsed.instance.content.start, parsed.instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const script = ast.statements
		.filter((s) => !ts.isImportDeclaration(s))
		.map((s) => s.getText(ast))
		.join('\n');
	const input = nodes(parsed.html).find(
		(n) =>
			n.name === 'input' &&
			typeof n.start === 'number' &&
			typeof n.end === 'number' &&
			text.slice(n.start, n.end).includes('id="models-import-input"')
	);
	const expression = nodes(input).find((n) => n.type === 'EventHandler' && n.name === 'change')
		?.expression as { start: number; end: number };
	if (!expression) throw new Error('Missing actual import');
	let mount!: () => unknown;
	const target = new window.EventTarget();
	const popup = { postMessage: vi.fn(), closed: false };
	const open = vi.fn((): typeof popup | null => popup);
	const error = vi.fn(),
		success = vi.fn(),
		refresh = vi.fn(async () => []),
		set = vi.fn(),
		actions = vi.fn();
	const list = vi.fn(async () => ({ items: [fixture], total: 1 })),
		tags = vi.fn(async () => ['fixture-tag']);
	const update = vi.fn(async () => fixture),
		create = vi.fn(async () => fixture),
		full = vi.fn(async () => fixture),
		save = vi.fn();
	const tick = deferred<void>();
	const readers: {
		onload: (event: { target: { result: unknown } | null }) => Promise<void>;
		readAsText: ReturnType<typeof vi.fn>;
	}[] = [];
	const api = runInNewContext(
		ts.transpileModule(
			`${script}\n({ mount: () => mounted(), load: getModelList, share: shareModelHandler, hide: hideModelHandler, download: downloadModels, change: ${text.slice(expression.start, expression.end)}, ready: () => {loaded = true;}, query: (value: string) => {query = value;}, reset: () => {models = null;}, files: (value: unknown) => {importFiles = value;}, timer: (value: unknown) => {searchDebounceTimer = value;}, state: () => ({loaded, models, tags, total, shiftKey}) });`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		{
			mounted: () => mount(),
			onMount: (callback: () => unknown) => {
				mount = callback;
			},
			tick: () => tick.promise,
			getContext: () => ({}),
			dayjs: { extend: vi.fn() },
			relativeTime: {},
			fileSaver: { saveAs: save },
			window: {
				location: { origin: 'https://fixture.invalid' },
				open,
				addEventListener: target.addEventListener.bind(target),
				removeEventListener: target.removeEventListener.bind(target)
			},
			AbortController: window.AbortController,
			localStorage: { token: 'fixture' },
			sessionStorage: {},
			getGroups: vi.fn(async () => []),
			getWorkspaceModels: list,
			getModelTags: tags,
			updateModelById: update,
			createNewModel: create,
			getModelById: full,
			getModels: refresh,
			_models: { set },
			workspaceActions: { set: actions },
			$_models: [],
			$i18n: { t: (text: string) => text },
			$settings: {},
			$config: undefined,
			toast: { error, success },
			console: { log: vi.fn(), error: vi.fn() },
			clearTimeout,
			setTimeout,
			Blob,
			FileReader: class {
				onload = async (): Promise<void> => {};
				readAsText = vi.fn();
				constructor() {
					readers.push(this);
				}
			}
		}
	) as {
		mount: () => unknown;
		load: () => Promise<void>;
		share: (model: typeof fixture) => Promise<void>;
		hide: (model: typeof fixture) => Promise<void>;
		download: (models: null) => Promise<void>;
		change: () => void;
		ready: () => void;
		query: (value: string) => void;
		reset: () => void;
		files: (value: unknown) => void;
		timer: (value: unknown) => void;
		state: () => {
			loaded: boolean;
			models: (typeof fixture)[] | null;
			tags: string[];
			total: number | null;
			shiftKey: boolean;
		};
	};
	const mountPage = async () => {
		const cleanup = api.mount();
		tick.resolve();
		await Promise.resolve();
		await Promise.resolve();
		return { cleanup };
	};
	const emit = (origin = 'https://fixture.invalid', sender: unknown = popup) =>
		target.dispatchEvent(
			new window.MessageEvent('message', { origin, source: sender as Window, data: 'loaded' })
		);
	return {
		api,
		mountPage,
		target,
		popup,
		open,
		emit,
		error,
		success,
		refresh,
		set,
		actions,
		list,
		tags,
		update,
		create,
		full,
		save,
		tick,
		readers
	};
}
it('mount returns synchronous cleanup and cancels delayed loading, listeners and timer', async () => {
	const r = setup(),
		cleanup = r.api.mount();
	expect(typeof cleanup).toBe('function');
	const pending = vi.fn();
	r.api.timer(setTimeout(pending, 0));
	(cleanup as () => void)();
	r.tick.resolve();
	await Promise.resolve();
	await new Promise((yes) => setTimeout(yes, 5));
	expect(r.api.state().loaded).toBe(false);
	expect(pending).not.toHaveBeenCalled();
	expect(r.actions).toHaveBeenCalledWith([]);
});
it('ready page cleanup removes all keyboard and blur listeners', async () => {
	const r = setup(),
		{ cleanup } = await r.mountPage();
	expect(typeof cleanup).toBe('function');
	r.target.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Shift' }));
	expect(r.api.state().shiftKey).toBe(true);
	r.target.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Shift' }));
	expect(r.api.state().shiftKey).toBe(false);
	(cleanup as () => void)();
	r.target.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Shift' }));
	expect(r.api.state().shiftKey).toBe(false);
	expect(r.api.state().loaded).toBe(false);
});
it.each(['list', 'tags', 'error', 'changed query', 'destroyed'])(
	'late %s cannot overwrite the current request',
	async (mode) => {
		const r = setup();
		const { cleanup } = await r.mountPage();
		r.api.ready();
		const a = deferred<{ items: (typeof fixture)[]; total: number }>(),
			oldTags = deferred<string[]>();
		r.list.mockImplementationOnce(() => a.promise);
		r.tags.mockImplementationOnce(() => oldTags.promise);
		const old = r.api.load();
		if (mode === 'tags') {
			a.resolve({ items: [{ ...fixture, id: 'old' }], total: 9 });
			await vi.waitFor(() => expect(r.tags).toHaveBeenCalledOnce());
		}
		r.api.query('new');
		if (mode === 'destroyed') {
			expect(typeof cleanup).toBe('function');
			(cleanup as () => void)();
		} else if (mode !== 'changed query') {
			if (mode !== 'tags') r.tags.mockReset().mockResolvedValue(['new-tag']);
			else r.tags.mockResolvedValueOnce(['new-tag']);
			await r.api.load();
		}
		if (mode === 'error') a.reject('obsolete error');
		else a.resolve({ items: [{ ...fixture, id: 'old' }], total: 9 });
		oldTags.resolve(['old-tag']);
		await old;
		if (mode === 'changed query' || mode === 'destroyed') expect(r.api.state().models).toBeNull();
		else {
			expect(r.api.state().models?.[0].id).toBe('fixture');
			expect(r.api.state().tags).toEqual(['new-tag']);
			expect(r.api.state().total).toBe(1);
		}
		expect(r.error).not.toHaveBeenCalled();
	}
);
it.each(['cancelled', 'empty', 'bad reader', 'object', 'mixed', 'valid', 'legacy'])(
	'import handles %s',
	async (mode) => {
		const r = setup();
		r.api.files(
			mode === 'cancelled' ? null : mode === 'empty' ? [] : [new File(['fixture'], 'models.json')]
		);
		expect(() => r.api.change()).not.toThrow();
		if (mode === 'cancelled' || mode === 'empty') {
			expect(r.readers).toHaveLength(0);
			return;
		}
		const result =
			mode === 'object'
				? '{}'
				: mode === 'mixed'
					? JSON.stringify([fixture, null])
					: JSON.stringify(mode === 'legacy' ? [{ id: 'fixture', info: fixture }] : [fixture]);
		await expect(
			r.readers[0].onload({ target: mode === 'bad reader' ? null : { result } })
		).resolves.toBeUndefined();
		if (mode === 'valid' || mode === 'legacy') {
			expect(r.create).toHaveBeenCalledWith('fixture', fixture);
			expect(r.error).not.toHaveBeenCalled();
		} else {
			expect(r.create).not.toHaveBeenCalled();
			expect(r.error).toHaveBeenCalledOnce();
		}
	}
);
it.each(['other origin', 'other window', 'duplicate', 'blocked', 'closed', 'destroyed', 'valid'])(
	'share rejects %s or sends once to its own origin',
	async (mode) => {
		const r = setup();
		const { cleanup } = await r.mountPage();
		const pending = deferred<typeof fixture>();
		r.full.mockImplementationOnce(() => pending.promise);
		if (mode === 'blocked') r.open.mockReturnValueOnce(null);
		if (mode === 'closed') r.popup.closed = true;
		await r.api.share(fixture);
		if (mode === 'destroyed') {
			expect(typeof cleanup).toBe('function');
			(cleanup as () => void)();
		}
		r.emit(
			mode === 'other origin' ? 'https://other.invalid' : undefined,
			mode === 'other window' ? {} : undefined
		);
		if (mode === 'duplicate') r.emit();
		pending.resolve(fixture);
		await new Promise((yes) => setTimeout(yes, 0));
		if (['other origin', 'other window', 'blocked', 'closed', 'destroyed'].includes(mode))
			expect(r.popup.postMessage).not.toHaveBeenCalled();
		else {
			expect(r.popup.postMessage).toHaveBeenCalledOnce();
			expect(r.popup.postMessage).toHaveBeenCalledWith(
				JSON.stringify(fixture),
				'https://fixture.invalid'
			);
		}
	}
);
it('pending hide preserves a reloaded null list and catalog refresh', async () => {
	const r = setup(),
		pending = deferred<typeof fixture>();
	r.update.mockImplementationOnce(() => pending.promise);
	const work = r.api.hide(fixture);
	r.api.reset();
	pending.resolve(fixture);
	await expect(work).resolves.toBeUndefined();
	expect(r.api.state().models).toBeNull();
	expect(r.refresh).toHaveBeenCalledOnce();
});
it('export while list is loading does not write an empty file', async () => {
	const r = setup();
	await expect(r.api.download(null)).resolves.toBeUndefined();
	expect(r.save).not.toHaveBeenCalled();
});
