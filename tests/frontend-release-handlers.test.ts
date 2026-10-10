import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const root = process.env.AIRIS_HANDLER_SOURCE ?? '.';
const read = (file: string): string => readFileSync(`${root}/${file}`, 'utf8');
const script = (file: string): string =>
	read(file).split('<script lang="ts">')[1].split('</script>')[0];
function declaration(source: string, name: string): string {
	const ast = ts.createSourceFile('actual.ts', source, ts.ScriptTarget.Latest, true);
	const node = ast.statements.find(
		(node) =>
			(ts.isFunctionDeclaration(node) && node.name?.text === name) ||
			(ts.isVariableStatement(node) &&
				node.declarationList.declarations.some((item) => item.name.getText(ast) === name))
	);
	if (!node) throw new Error(`Missing actual handler: ${name}`);
	return node.getText(ast).replace(/^export /, '');
}
function evaluate(source: string, name: string, context: Record<string, unknown>): unknown {
	return runInNewContext(
		ts.transpileModule(`${source}\n${name}`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	);
}

it('serializes real worker results, proxies and failing getters without losing siblings', () => {
	const source = read('src/lib/workers/pyodide.worker.ts');
	const types = source.match(/type ProcessedResult = [\s\S]*?;\n/)?.[0] ?? '';
	const serialize = evaluate(types + declaration(source, 'processResult'), 'processResult', {
		Error
	}) as (value: unknown) => unknown;
	expect(serialize({ text: 'Привет', items: [null, undefined, 3n, true, 12] })).toEqual({
		text: 'Привет',
		items: [null, null, '3', true, 12]
	});
	const proxy = {
		value: [1, 2],
		toJs() {
			return this.value;
		}
	};
	expect(serialize(proxy)).toEqual([1, 2]);
	expect(
		serialize({
			get toJs() {
				throw new Error('getter failed');
			}
		})
	).toBe('[processResult error]: getter failed');
	expect(
		serialize({
			good: 1,
			bad: {
				get toJs() {
					throw new Error('nested');
				}
			}
		})
	).toEqual({
		good: 1,
		bad: '[processResult error]: nested'
	});
	expect(serialize(Symbol('x'))).toBeUndefined();
});

it('reads the actual upload stream through DONE and EOF, retaining processing errors', async () => {
	const source = read('src/lib/apis/files/index.ts');
	const response = { id: 'file', data: {}, error: undefined };
	const chunks = [
		'data: {"status":"processing"}\n',
		'data: {"error":"failed"}\n',
		'data: [DONE]\n'
	];
	const reader = {
		read: vi.fn(async () =>
			chunks.length ? { value: chunks.shift(), done: false } : { done: true }
		)
	};
	const stream = { pipeThrough: () => stream, getReader: () => reader };
	const fetch = vi.fn(async () => ({ ok: true, json: async () => response }));
	const upload = evaluate(declaration(source, 'uploadFile'), 'uploadFile', {
		fetch,
		FormData,
		URLSearchParams,
		TextDecoderStream: class {},
		splitStream: () => ({}),
		WEBUI_API_BASE_URL: '/api',
		getFileProcessStatus: async () => ({ ok: true, body: stream }),
		console: { log: vi.fn(), error: vi.fn() }
	}) as (token: string, file: Blob) => Promise<typeof response>;
	expect(await upload('token', new Blob(['test']))).toBe(response);
	expect(response.error).toBe('failed');
	expect(reader.read).toHaveBeenCalledTimes(4);
	expect(fetch).toHaveBeenCalledTimes(1);
});

it('preserves actual iframe dependency HTML and the same-origin gate', async () => {
	const source = script('src/lib/components/common/FullHeightIframe.svelte');
	const body = declaration(source, 'processHtmlForDeps')
		.replace("await import('alpinejs/dist/cdn.min.js?raw')", 'alpineDependency')
		.replace("await import('chart.js/auto')", 'chartDependency');
	const Chart = function () {};
	const window: Record<string, unknown> = {};
	const context = {
		allowSameOrigin: false,
		alpineDirectives: ['x-data'],
		alpineDependency: { default: 'Alpine' },
		chartDependency: { default: Chart },
		Blob,
		URL: { createObjectURL: () => 'blob:alpine' },
		window,
		console
	};
	const processHtml = evaluate(body, 'processHtmlForDeps', context) as (
		html: string
	) => Promise<string>;
	const html = '<head></head><body x-data="{}">new Chart(</body>';
	expect(await processHtml(html)).toBe(html);
	expect(window.Chart).toBeUndefined();
	context.allowSameOrigin = true;
	const accepted = await processHtml(html);
	expect(accepted).toContain('<script src="blob:alpine" defer></script>');
	expect(accepted).toContain('window.Chart = parent.Chart;');
	expect(accepted.match(/<\/script>/g)).toHaveLength(2);
	expect(accepted.indexOf('window.Chart')).toBeLessThan(accepted.indexOf('</head>'));
	expect(window.Chart).toBe(Chart);
	expect(await processHtml('plain')).toBe('plain');
});

it('rejects foreign iframe messages and keeps the registered window and args', async () => {
	const source = script('src/lib/components/common/FullHeightIframe.svelte');
	const postMessage = vi.fn();
	const target = { postMessage };
	const iframe = { contentWindow: target, style: { height: '' } };
	const embedWindows = new Set();
	const args = { query: 'Привет' };
	const context = {
		iframe,
		embedWindows,
		registeredWindow: null,
		args,
		payload: { private: true },
		console,
		requestAnimationFrame: vi.fn(),
		resizeSameOrigin: vi.fn()
	};
	const onMessage = evaluate(declaration(source, 'onMessage'), 'onMessage', context) as (
		event: object
	) => void;
	onMessage({ source: {}, data: { type: 'payload' } });
	expect(postMessage).not.toHaveBeenCalled();
	onMessage({ source: target, data: { type: 'iframe:height', height: -5 } });
	expect(iframe.style.height).toBe('0px');
	onMessage({ source: target, data: { type: 'payload', requestId: 'r' } });
	expect(postMessage).toHaveBeenCalledWith(
		{ type: 'payload', requestId: 'r', payload: { private: true } },
		'*'
	);
	const onLoad = evaluate(declaration(source, 'onLoad'), 'onLoad', context) as () => Promise<void>;
	await onLoad();
	expect(embedWindows.has(target)).toBe(true);
	expect((target as typeof target & { args?: unknown }).args).toBe(args);
});

it('refreshes files after sync failure without repeating writes', async () => {
	const source = script('src/lib/components/chat/PyodideFileNav.svelte');
	const loadDir = vi.fn(),
		sendWorkerMessage = vi.fn(async () => {
			throw new Error('sync failed');
		});
	const context = {
		loadDir,
		sendWorkerMessage,
		currentPath: '/mnt/uploads',
		console: { error: vi.fn() }
	};
	const changed = evaluate(
		declaration(source, 'onFilesChanged'),
		'onFilesChanged',
		context
	) as () => Promise<void>;
	await changed();
	expect(loadDir).toHaveBeenCalledWith('/mnt/uploads');
	expect(sendWorkerMessage).toHaveBeenCalledTimes(1);
	const refresh = read('src/lib/components/chat/PyodideFileNav.svelte').match(
		/onRefresh=\{(async \(\) => \{[\s\S]*?)\n\t\t\}\}/
	)?.[1];
	if (!refresh) throw new Error('Missing actual toolbar refresh');
	const openEntry = vi.fn();
	const run = evaluate(`const refresh = ${refresh}\n};`, 'refresh', {
		...context,
		selectedFile: '/mnt/uploads/данные.txt',
		openEntry
	}) as () => Promise<void>;
	await run();
	expect(openEntry).toHaveBeenCalledWith({ name: 'данные.txt', type: 'file', size: 0 });
	expect(sendWorkerMessage).toHaveBeenCalledTimes(2);
});
