// @vitest-environment node
import { readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it } from 'vitest';

it.each([
	'src/lib/components/chat/MessageInput.svelte',
	'src/lib/components/chat/Messages/ResponseMessage.svelte'
])('%s forwards the selected precision to the actual worker constructor', async (path) => {
	const source = readFileSync(path, 'utf8');
	const argumentsFound: { start: number; end: number }[] = [];
	const visit = (value: unknown): void => {
		if (!value || typeof value !== 'object') return;
		const node = value as Record<string, unknown>;
		const callee = node.callee as { name?: string } | undefined;
		if (node.type === 'NewExpression' && callee?.name === 'KokoroWorker') {
			argumentsFound.push((node.arguments as { start: number; end: number }[])[0]);
		}
		for (const child of Object.values(node)) {
			if (Array.isArray(child)) child.forEach(visit);
			else if (child && typeof child === 'object') visit(child);
		}
	};
	visit(parse(source));
	expect(argumentsFound).toHaveLength(1);
	const argument = argumentsFound[0];
	const evaluate = new Function(
		'$settings',
		`return (${source.slice(argument.start, argument.end)})`
	);

	const requests: { payload: { dtype: unknown } }[] = [];
	type WorkerEvent = { data: { status: string } };
	class WorkerDouble {
		onmessage?: (event: WorkerEvent) => void;
		listeners = new Set<(event: WorkerEvent) => void>();
		postMessage(message: { payload: { dtype: unknown } }): void {
			requests.push(message);
			queueMicrotask(() => {
				const event = { data: { status: 'init:complete' } };
				this.onmessage?.(event);
				for (const listener of this.listeners) listener(event);
			});
		}
		addEventListener(name: string, listener: (event: WorkerEvent) => void): void {
			if (name === 'message') this.listeners.add(listener);
		}
		removeEventListener(name: string, listener: (event: WorkerEvent) => void): void {
			if (name === 'message') this.listeners.delete(listener);
		}
	}
	const workerSource = readFileSync('src/lib/workers/KokoroWorker.ts', 'utf8').replace(
		/^import WorkerInstance[^\n]+\n/,
		''
	);
	const compiled = ts.transpileModule(workerSource, {
		compilerOptions: { module: ts.ModuleKind.CommonJS }
	}).outputText;
	const exportsObject = {} as {
		KokoroWorker: new (dtype: unknown) => { init: () => Promise<void> };
	};
	new Function('WorkerInstance', 'exports', compiled)(WorkerDouble, exportsObject);
	for (const dtype of ['fp32', 'q8', undefined]) {
		const settings = { audio: { tts: { engineConfig: { dtype } } } };
		await new exportsObject.KokoroWorker(evaluate(settings)).init();
		expect(requests.at(-1)?.payload.dtype).toBe(dtype ?? 'fp32');
	}
});
