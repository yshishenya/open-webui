// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.useRealTimers();
});
const image = 'data:image/png;base64,fixture';
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
};
function setup(shared = true, engine = 'pyodide') {
	vi.useFakeTimers();
	const source = readFileSync(
		process.env.AIRIS_CODEBLOCK_SOURCE ?? 'src/lib/components/chat/Messages/CodeBlock.svelte',
		'utf8'
	);
	const parsed = parse(source);
	const instance = parsed.instance;
	if (!instance) throw new Error('Missing actual CodeBlock script');
	const ast = ts.createSourceFile(
		'codeblock.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const statements = ast.statements.filter(
		(s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s)
	);
	const script = ts.createPrinter().printList(
		ts.ListFormat.MultiLine,
		ts.factory.createNodeArray(
			statements.map((s) =>
				ts.isVariableStatement(s)
					? ts.factory.updateVariableStatement(
							s,
							s.modifiers?.filter((m) => m.kind !== ts.SyntaxKind.ExportKeyword),
							s.declarationList
						)
					: s
			)
		),
		ast
	);
	const nodes = (value: unknown): Record<string, unknown>[] => {
		if (!value || typeof value !== 'object') return [];
		if (Array.isArray(value)) return value.flatMap(nodes);
		return [value as Record<string, unknown>, ...Object.values(value).flatMap(nodes)];
	};
	const visibleBlock = nodes(parsed.html).find(
		(node) =>
			node.type === 'IfBlock' &&
			['result', 'hasResult'].includes(String((node.expression as { name?: string })?.name))
	);
	const visibility = (visibleBlock?.expression as { name: string } | undefined)?.name;
	if (!visibility) throw new Error('Missing actual result condition');
	const derived = ast.statements.find(
		(statement) =>
			ts.isLabeledStatement(statement) && statement.getText(ast).includes('hasResult =')
	);
	const projection = `() => { let hasResult; ${derived?.getText(ast) ?? ''} return Boolean(${visibility}); }`;
	let destroy!: () => void;
	const listeners = { message: new Set<EventListener>(), error: new Set<EventListener>() };
	const externalError = vi.fn<[Event], void>();
	const worker = {
		onerror: externalError,
		postMessage: vi.fn<[{ id: string; code: string; packages: string[] }], void>(),
		terminate: vi.fn(),
		addEventListener: (type: 'message' | 'error', listener: EventListener) => {
			if (type === 'message') listeners.message.add(listener);
			else listeners.error.add(listener);
		},
		removeEventListener: (type: 'message' | 'error', listener: EventListener) => {
			if (type === 'message') listeners.message.delete(listener);
			else listeners.error.delete(listener);
		}
	};
	const createWorker = vi.fn(() => worker),
		execute = vi.fn(async () => ({ stdout: '', stderr: '', result: '' }));
	const dispatch = vi.fn(),
		error = vi.fn();
	let sequence = 0;
	const api = runInNewContext(
		ts.transpileModule(
			`${script}\nid='fixture-block'; ({run:executePython, destroy:()=>destroy(), state:()=>({executing,stdout,stderr,result,files,visible:(${projection})()}), resetCode:()=>{code='';}, code:()=>_code});`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		{
			$config: { code: { engine } },
			$pyodideWorkerStore: shared ? worker : null,
			onMount: vi.fn(),
			onDestroy: (callback: () => void) => {
				destroy = callback;
			},
			destroy: () => destroy(),
			getContext: () => ({}),
			createPyodideWorker: createWorker,
			executeCode: execute,
			localStorage: { token: 'fixture' },
			crypto: { randomUUID: () => `run-${++sequence}` },
			window: { dispatchEvent: dispatch },
			Event: window.Event,
			ErrorEvent: window.ErrorEvent,
			setTimeout,
			clearTimeout,
			console: { log: vi.fn(), error: vi.fn() },
			toast: { error },
			$i18n: { t: (text: string) => text }
		}
	) as {
		run: (code: string) => Promise<void>;
		destroy: () => void;
		state: () => {
			executing: boolean;
			visible: boolean;
			stdout: string | null;
			stderr: string | null;
			result: unknown;
			files: { type: string; data: string }[] | null;
		};
	};
	const reply = (data: unknown): void => {
		for (const listener of [...listeners.message])
			listener(new window.MessageEvent('message', { data }));
	};
	return { api, worker, listeners, externalError, createWorker, execute, dispatch, error, reply };
}
it.each([true, false])(
	'cleans a %s-shared execution on timeout and destruction',
	async (shared) => {
		const r = setup(shared);
		await r.api.run('print(1)');
		expect(r.worker.postMessage).toHaveBeenCalledOnce();
		expect(r.api.state().executing).toBe(true);
		vi.advanceTimersByTime(60000);
		expect(r.api.state().executing).toBe(false);
		expect(r.api.state().stderr).toBe('Execution Time Limit Exceeded');
		expect(r.listeners.message.size).toBe(0);
		expect(r.listeners.error.size).toBe(0);
		expect(r.worker.terminate).toHaveBeenCalledTimes(shared ? 0 : 1);
		await r.api.run('print(2)');
		r.api.destroy();
		expect(r.listeners.message.size).toBe(0);
		expect(r.listeners.error.size).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
		expect(r.worker.terminate).toHaveBeenCalledTimes(shared ? 0 : 2);
	}
);
it('does not replace another owner error callback', async () => {
	const r = setup();
	await r.api.run('1');
	expect(r.worker.onerror).toBe(r.externalError);
});
it('late response from a timed-out execution cannot replace the next result', async () => {
	const r = setup();
	await r.api.run('1');
	const previous = r.worker.postMessage.mock.calls[0][0].id;
	vi.advanceTimersByTime(60000);
	await r.api.run('2');
	const current = r.worker.postMessage.mock.calls[1][0].id;
	expect(current).not.toBe(previous);
	r.reply({ id: previous, stdout: 'obsolete', result: 'old' });
	expect(r.api.state().executing).toBe(true);
	expect(r.api.state().stdout).toBeNull();
	r.reply({ id: current, stdout: 'current', result: 2 });
	expect(r.api.state().result).toBe(2);
	expect(r.api.state().executing).toBe(false);
});
it('ignores other requests and filesystem messages', async () => {
	const r = setup();
	await r.api.run('1');
	const id = r.worker.postMessage.mock.calls[0][0].id;
	r.reply({ id: 'different', result: 'other' });
	r.reply({ id, type: 'fs:list', result: 'wrong' });
	expect(r.api.state().executing).toBe(true);
	expect(r.api.state().result).toBeNull();
	r.reply({ id, result: 'ok' });
	expect(r.api.state().executing).toBe(false);
});
it.each([0, false, 3, 'sample', { answer: 3 }, [1, 2], `${image}\ntext`])(
	'supports structured/scalar/image result %j',
	async (result) => {
		const r = setup();
		await r.api.run('fixture');
		const id = r.worker.postMessage.mock.calls[0][0].id;
		expect(() => r.reply({ id, stdout: 'hello', stderr: '', result })).not.toThrow();
		expect(r.api.state().result).toEqual(
			typeof result === 'string' && result.startsWith(image) ? 'text' : result
		);
		if (typeof result === 'string' && result.startsWith(image))
			expect(r.api.state().files).toEqual([{ type: 'image/png', data: image }]);
		expect(r.api.state().executing).toBe(false);
		expect(r.api.state().visible).toBe(true);
		expect(r.listeners.message.size).toBe(0);
		expect(r.listeners.error.size).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
		expect(r.dispatch).toHaveBeenCalledOnce();
	}
);
it('a new execution clears previous graphs and duplicated run clicks', async () => {
	const r = setup();
	await r.api.run('plot');
	r.reply({ id: r.worker.postMessage.mock.calls[0][0].id, stdout: image });
	expect(r.api.state().files).toHaveLength(1);
	await r.api.run('other');
	expect(r.api.state().files).toBeNull();
	await r.api.run('duplicate');
	expect(r.worker.postMessage).toHaveBeenCalledTimes(2);
});
it('registers before send, including immediate replies', async () => {
	const r = setup();
	r.worker.postMessage.mockImplementation(({ id }) => r.reply({ id, result: 'cached' }));
	await r.api.run('1');
	expect(r.api.state().result).toBe('cached');
	expect(r.api.state().executing).toBe(false);
	expect(vi.getTimerCount()).toBe(0);
});
it.each(['creation', 'send', 'worker error'])(
	'releases busy state after %s failure',
	async (mode) => {
		const r = setup(mode !== 'creation');
		if (mode === 'creation')
			r.createWorker.mockImplementationOnce(() => {
				throw new Error('creation failed');
			});
		if (mode === 'send')
			r.worker.postMessage.mockImplementationOnce(() => {
				throw new Error('send failed');
			});
		await expect(r.api.run('fixture')).resolves.toBeUndefined();
		if (mode === 'worker error') {
			const event = new window.ErrorEvent('error', { message: 'worker failed' });
			r.worker.onerror(event);
			for (const listener of [...r.listeners.error]) listener(event);
		}
		expect(r.api.state().executing).toBe(false);
		expect(r.api.state().stderr).toMatch(/failed/);
		expect(r.listeners.message.size).toBe(0);
		expect(r.listeners.error.size).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	}
);
it('destroyed block ignores pending Jupyter result', async () => {
	const r = setup(true, 'jupyter'),
		pending = deferred<{ stdout: string; stderr: string; result: string }>();
	r.execute.mockImplementationOnce(() => pending.promise);
	const work = r.api.run('1');
	r.api.destroy();
	pending.resolve({ stdout: 'late', stderr: '', result: 'late' });
	await work;
	expect(r.api.state().stdout).toBeNull();
	expect(r.api.state().result).toBeNull();
	expect(r.api.state().executing).toBe(false);
});
it('Jupyter uses identical output image extraction and scalar strings', async () => {
	const r = setup(true, 'jupyter');
	r.execute.mockResolvedValueOnce({
		stdout: `${image}\nhello`,
		stderr: '',
		result: `${image}\ntext`
	});
	await r.api.run('fixture');
	expect(r.execute).toHaveBeenCalledWith('fixture', 'fixture');
	expect(r.api.state()).toMatchObject({
		executing: false,
		stdout: 'hello',
		stderr: null,
		result: 'text'
	});
	expect(r.api.state().files).toHaveLength(2);
});

it('cleanup preserves other listeners on the shared worker', async () => {
	const r = setup(),
		foreignMessage = vi.fn(),
		foreignError = vi.fn();
	r.listeners.message.add(foreignMessage);
	r.listeners.error.add(foreignError);
	await r.api.run('fixture');
	vi.advanceTimersByTime(60000);
	r.api.destroy();
	expect([...r.listeners.message]).toEqual([foreignMessage]);
	expect([...r.listeners.error]).toEqual([foreignError]);
	expect(r.worker.terminate).not.toHaveBeenCalled();
});

it.each(['pyodide', 'jupyter'])('image-only %s result has no empty text label', async (engine) => {
	const r = setup(true, engine);
	if (engine === 'jupyter')
		r.execute.mockResolvedValueOnce({ stdout: '', stderr: '', result: image });
	await r.api.run('fixture');
	if (engine === 'pyodide')
		r.reply({ id: r.worker.postMessage.mock.calls[0][0].id, result: image });
	expect(r.api.state().files).toEqual([{ type: 'image/png', data: image }]);
	expect(r.api.state().visible).toBe(false);
});
