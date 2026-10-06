// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const source = readFileSync('src/lib/components/admin/Settings/Models.svelte', 'utf8');
const script = ts.createSourceFile(
	'admin.ts',
	source.split('<script lang="ts">')[1].split('</script>')[0],
	ts.ScriptTarget.Latest
);
const call = script.statements
	.filter(ts.isExpressionStatement)
	.map((statement) => statement.expression)
	.find(
		(expression) =>
			ts.isCallExpression(expression) && expression.expression.getText(script) === 'onMount'
	);
if (!call || !ts.isCallExpression(call)) throw new Error('Missing actual onMount');
const callback = call.arguments[0].getText(script);

function page(init: () => Promise<void> = async (): Promise<void> => {}) {
	const listeners = new Map<string, Set<(event: KeyboardEvent) => void>>();
	const context = {
		shiftKey: false,
		init: vi.fn(init),
		toast: { error: vi.fn() },
		$i18n: { t: (key: string): string => key },
		window: {
			addEventListener(name: string, handler: (event: KeyboardEvent) => void): void {
				const handlers = listeners.get(name) ?? new Set();
				handlers.add(handler);
				listeners.set(name, handlers);
			},
			removeEventListener(name: string, handler: (event: KeyboardEvent) => void): void {
				listeners.get(name)?.delete(handler);
			}
		}
	};
	const mount = runInNewContext(
		ts.transpileModule(`(${callback})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as () => unknown;
	return {
		context,
		mount,
		count: (): number => [...listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0),
		dispatch(name: string, key = ''): void {
			for (const handler of listeners.get(name) ?? []) handler({ key } as KeyboardEvent);
		}
	};
}

async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

it('cleans actual listeners across repeated visits and preserves modifier behavior', async () => {
	const current = page();
	for (let visit = 0; visit < 3; visit++) {
		const teardown = current.mount();
		expect(typeof teardown).toBe('function');
		await settle();
		expect(current.count()).toBe(3);
		current.dispatch('keydown', 'Shift');
		expect(current.context.shiftKey).toBe(true);
		current.dispatch('keyup', 'Shift');
		expect(current.context.shiftKey).toBe(false);
		current.dispatch('keydown', 'Shift');
		current.dispatch('blur');
		expect(current.context.shiftKey).toBe(false);
		if (typeof teardown === 'function') teardown();
		expect(current.count()).toBe(0);
		current.dispatch('keydown', 'Shift');
		expect(current.context.shiftKey).toBe(false);
	}
	expect(current.context.init).toHaveBeenCalledTimes(3);
	expect(current.context.toast.error).not.toHaveBeenCalled();
});

it('never attaches listeners when delayed initialization finishes after unmount', async () => {
	let finish: () => void = () => {};
	const current = page(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			})
	);
	const teardown = current.mount();
	if (typeof teardown === 'function') teardown();
	finish();
	await settle();
	expect(current.count()).toBe(0);
	expect(current.context.toast.error).not.toHaveBeenCalled();
});

it('reports refused initialization once and installs no listeners', async () => {
	const current = page(async (): Promise<void> => {
		throw 'offline';
	});
	current.mount();
	await settle();
	expect(current.count()).toBe(0);
	expect(current.context.toast.error).toHaveBeenCalledTimes(1);
	expect(current.context.toast.error).toHaveBeenCalledWith('offline');
});

it('does not notify an unmounted page when pending initialization fails', async () => {
	let refuse: (error: Error) => void = () => {};
	const current = page(
		() =>
			new Promise<void>((_resolve, reject) => {
				refuse = reject;
			})
	);
	const teardown = current.mount();
	if (typeof teardown === 'function') teardown();
	refuse(new Error('offline'));
	await settle();
	expect(current.count()).toBe(0);
	expect(current.context.toast.error).not.toHaveBeenCalled();
});
