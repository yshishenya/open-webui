// @vitest-environment jsdom
import { createClassComponent } from 'svelte/legacy';
import { tick } from 'svelte';
import { EditorView } from 'codemirror';
import { readable, type Writable } from 'svelte/store';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CodeEditor from '$lib/components/common/CodeEditor.svelte';
import { user } from '$lib/stores';

const mocks = vi.hoisted(() => {
	vi.stubGlobal('APP_VERSION', 'test');
	vi.stubGlobal('APP_BUILD_HASH', 'test');
	return {
		format: vi.fn<[string, string], Promise<{ code: string | null }>>(),
		worker: vi.fn<[], Worker>()
	};
});
vi.mock('$lib/apis/utils', () => ({ formatPythonCode: mocks.format }));
vi.mock('$lib/pyodide/createPyodideWorker', () => ({ createPyodideWorker: mocks.worker }));
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { user: writable({ role: 'admin' }) };
});
const testUser = user as unknown as Writable<{ role: string }>;
const instances: ReturnType<typeof createClassComponent>[] = [];
const context = new Map([['i18n', readable({ t: (value: string) => value })]]);
const deferred = () => {
	let resolve!: (value: { code: string | null }) => void;
	const promise = new Promise<{ code: string | null }>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
};
const mount = async (value = 'original') => {
	const target = document.createElement('section');
	document.body.append(target);
	const change = vi.fn<[string], void>();
	const instance = createClassComponent({
		component: CodeEditor,
		target,
		context,
		props: { value, onChange: change }
	});
	instances.push(instance);
	await tick();
	const view = () => {
		const node = target.querySelector('.cm-editor');
		return node instanceof HTMLElement ? EditorView.findFromDOM(node) : null;
	};
	return { instance, target, change, view, text: () => view()?.state.doc.toString() };
};
beforeEach(() => {
	mocks.format.mockReset();
	mocks.worker.mockReset();
	testUser.set({ role: 'admin' });
	window.requestAnimationFrame = vi.fn(() => 1);
	window.cancelAnimationFrame = (id) => window.clearTimeout(id);
});
afterEach(async () => {
	instances.splice(0).forEach((instance) => instance.$destroy());
	await tick();
	document.body.replaceChildren();
	vi.useRealTimers();
	document.documentElement.classList.remove('dark');
});
it('applies empty external content without retaining the previous code', async () => {
	const form = await mount();
	form.instance.$set({ value: '' });
	await tick();
	expect(form.text()).toBe('');
	expect(form.change).toHaveBeenLastCalledWith('');
	form.instance.$set({ value: 'next' });
	await tick();
	expect(form.text()).toBe('next');
});
it('mounts each default-id editor in its own container', async () => {
	const first = await mount('first');
	const second = await mount('second');
	expect(first.target.querySelectorAll('.cm-editor')).toHaveLength(1);
	expect(second.target.querySelectorAll('.cm-editor')).toHaveLength(1);
	expect(first.text()).toBe('first');
	expect(second.text()).toBe('second');
});
it.each(['close', 'edit'] as const)(
	'ignores a late formatter response after %s',
	async (action) => {
		const form = await mount();
		const pending = deferred();
		mocks.format.mockReturnValue(pending.promise);
		const result = form.instance.formatPythonCodeHandler();
		if (action === 'close') {
			form.instance.$destroy();
			instances.splice(instances.indexOf(form.instance), 1);
		} else {
			form.instance.$set({ value: 'new input' });
			await tick();
		}
		pending.resolve({ code: 'old formatted input' });
		await expect(result).resolves.toBe(false);
		expect(form.change).not.toHaveBeenCalledWith('old formatted input');
		if (action === 'edit') expect(form.text()).toBe('new input');
	}
);
it('applies a current formatter result exactly once', async () => {
	const form = await mount();
	mocks.format.mockResolvedValue({ code: 'formatted' });
	await expect(form.instance.formatPythonCodeHandler()).resolves.toBe(true);
	expect(form.text()).toBe('formatted');
	expect(form.change.mock.calls.filter(([value]) => value === 'formatted')).toHaveLength(1);
});
it('settles pending worker formatting and removes its listeners on close', async () => {
	testUser.set({ role: 'user' });
	const events = new window.EventTarget();
	const add = vi.spyOn(events, 'addEventListener'),
		remove = vi.spyOn(events, 'removeEventListener');
	const terminate = vi.fn(),
		postMessage = vi.fn();
	mocks.worker.mockReturnValue(
		Object.assign(events, { terminate, postMessage }) as unknown as Worker
	);
	const form = await mount();
	const result = form.instance.formatPythonCodeHandler();
	expect(postMessage).toHaveBeenCalledOnce();
	form.instance.$destroy();
	instances.splice(instances.indexOf(form.instance), 1);
	await expect(result).resolves.toBe(false);
	expect(terminate).toHaveBeenCalledOnce();
	for (const [type, listener] of add.mock.calls)
		expect(remove).toHaveBeenCalledWith(type, listener);
});

const workerFixture = () => {
	testUser.set({ role: 'user' });
	const events = new window.EventTarget();
	const remove = vi.spyOn(events, 'removeEventListener');
	const terminate = vi.fn();
	const postMessage = vi.fn<[{ id: string; code: string; packages: string[] }], void>();
	mocks.worker.mockReturnValue(
		Object.assign(events, { terminate, postMessage }) as unknown as Worker
	);
	return {
		terminate,
		postMessage,
		remove,
		reply: (data: unknown) => events.dispatchEvent(new window.MessageEvent('message', { data })),
		error: () =>
			events.dispatchEvent(new window.ErrorEvent('error', { message: 'worker failure' })),
		output: (id: string, value: string) => ({
			id,
			stdout: `--||CODE-START-${id}||--\n${value}\n--||CODE-END-${id}||--`,
			stderr: null
		})
	};
};
it('uses only its worker reply and preserves code delimiters and a single change', async () => {
	const worker = workerFixture();
	const form = await mount('print("test")');
	const result = form.instance.formatPythonCodeHandler();
	const id = worker.postMessage.mock.calls[0][0].id;
	worker.reply(null);
	worker.reply(worker.output('unrelated', 'wrong'));
	expect(form.text()).toBe('print("test")');
	worker.reply(worker.output(id, 'print("formatted")'));
	await expect(result).resolves.toBe(true);
	expect(form.text()).toBe('print("formatted")');
	expect(form.change).toHaveBeenCalledOnce();
	expect(worker.remove).toHaveBeenCalledTimes(2);
});
it.each(['stderr', 'error'] as const)(
	'preserves input and cleans formatting after worker %s',
	async (failure) => {
		const worker = workerFixture();
		const form = await mount();
		const result = form.instance.formatPythonCodeHandler();
		if (failure === 'stderr')
			worker.reply({ id: worker.postMessage.mock.calls[0][0].id, stderr: 'invalid code' });
		else worker.error();
		await expect(result).resolves.toBe(false);
		expect(form.text()).toBe('original');
		expect(form.change).not.toHaveBeenCalled();
		expect(worker.remove).toHaveBeenCalledTimes(2);
	}
);
it('terminates timed-out formatting and leaves input unchanged', async () => {
	vi.useFakeTimers();
	const worker = workerFixture();
	const form = await mount();
	const result = form.instance.formatPythonCodeHandler();
	await vi.advanceTimersByTimeAsync(60000);
	await expect(result).resolves.toBe(false);
	expect(form.text()).toBe('original');
	expect(form.change).not.toHaveBeenCalled();
	expect(worker.remove).toHaveBeenCalledTimes(2);
	expect(worker.terminate).toHaveBeenCalledOnce();
	expect(vi.getTimerCount()).toBe(0);
});
it('cancels a previous worker format and applies only the current response', async () => {
	const worker = workerFixture();
	const form = await mount();
	const previous = form.instance.formatPythonCodeHandler();
	const previousId = worker.postMessage.mock.calls[0][0].id;
	const current = form.instance.formatPythonCodeHandler();
	const currentId = worker.postMessage.mock.calls[1][0].id;
	await expect(previous).resolves.toBe(false);
	worker.reply(worker.output(previousId, 'obsolete'));
	expect(form.text()).toBe('original');
	worker.reply(worker.output(currentId, 'current'));
	await expect(current).resolves.toBe(true);
	expect(form.text()).toBe('current');
	expect(form.change).toHaveBeenCalledOnce();
});
it('switches the mounted editor theme in both directions without losing code', async () => {
	const form = await mount();
	document.documentElement.classList.add('dark');
	await tick();
	expect(form.view()?.state.facet(EditorView.darkTheme)).toBe(true);
	document.documentElement.classList.remove('dark');
	await tick();
	expect(form.view()?.state.facet(EditorView.darkTheme)).toBe(false);
	expect(form.text()).toBe('original');
});

it('keeps local input while the parent value is unchanged', async () => {
	const form = await mount();
	const view = form.view();
	if (!view) throw new Error('Missing actual mounted editor');
	view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'local input' } });
	await tick();
	expect(form.text()).toBe('local input');
	expect(form.change).toHaveBeenLastCalledWith('local input');
});
