// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { createInstance } from 'i18next';
import InputVariablesHarness from './fixtures/InputVariablesHarness.svelte';
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { models: writable([]), config: writable({}) };
});
vi.mock('$lib/utils', () => ({ copyToClipboard: vi.fn() }));
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({
		activate: vi.fn(),
		deactivate: vi.fn(),
		pause: vi.fn(),
		unpause: vi.fn()
	})
}));
let component: Record<string, unknown> | null = null;
let target: HTMLDivElement | null = null;
const settle = async (): Promise<void> => {
	for (let i = 0; i < 6; i++) await tick();
};
beforeEach(() => {
	if (!Element.prototype.animate)
		Object.defineProperty(Element.prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => ({
				cancel: vi.fn(),
				finished: Promise.resolve(),
				finish: vi.fn(),
				pause: vi.fn(),
				play: vi.fn()
			}))
		});
});
afterEach(async () => {
	if (component) await unmount(component);
	target?.remove();
	component = null;
	target = null;
});
const kinds = ['chat', 'channel'] as const;
const actions = ['Cancel', 'Close', 'Escape', 'Outside', 'Destroy', 'Save'] as const;
it.each(kinds.flatMap((kind) => actions.map((action) => [kind, action] as const)))(
	'settles %s once on %s',
	async (kind, action) => {
		const path = `src/lib/components/${kind}/MessageInput.svelte`;
		const source = ts.createSourceFile(
			path,
			readFileSync(path, 'utf8').split('<script lang="ts">').at(-1)!.split('</script>')[0],
			ts.ScriptTarget.Latest
		);
		const declaration = source.statements
			.filter(ts.isVariableStatement)
			.flatMap((s) => Array.from(s.declarationList.declarations))
			.find((d) => d.name.getText(source) === 'inputVariableHandler');
		if (!declaration?.initializer) throw new Error('Missing real handler');
		const replaceVariables = vi.fn();
		const context: {
			[key: string]: unknown;
			inputVariablesModalCallback?: (values: Record<string, unknown>) => void;
			inputVariablesModalCancelCallback?: () => void;
		} = {
			extractInputVariables: () => ({ NAME: { type: 'text' } }),
			inputVariables: {},
			showInputVariablesModal: false,
			inputVariableValues: {},
			replaceVariables,
			inputVariablesModalCancelCallback: () => {}
		};
		const handler = runInNewContext(
			ts.transpileModule(`(${declaration.initializer.getText(source)})`, {
				compilerOptions: { target: ts.ScriptTarget.ES2022 }
			}).outputText,
			context
		) as (text: string) => Promise<string | null>;
		let settled = false;
		let result: string | null | undefined;
		const cancelSignal = vi.fn(() => context.inputVariablesModalCancelCallback?.());
		const pending = handler('{{NAME}}').then((value) => {
			settled = true;
			result = value;
		});
		const i18n = createInstance();
		await i18n.init({ lng: 'en', resources: {}, initImmediate: false });
		target = document.createElement('div');
		document.body.append(target);
		component = mount(InputVariablesHarness, {
			target,
			context: new Map([['i18n', writable(i18n)]]),
			props: {
				props: {
					variables: { NAME: { type: 'text' } },
					onSave: (values: Record<string, unknown>) =>
						context.inputVariablesModalCallback?.(values),
					onCancel: cancelSignal
				} as Record<string, unknown>
			}
		});
		await settle();
		if (action === 'Save') {
			document
				.querySelector('form')!
				.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		} else if (action === 'Destroy') {
			await unmount(component);
			component = null;
		} else if (action === 'Escape')
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		else if (action === 'Outside')
			document
				.querySelector('.modal')!
				.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		else if (action === 'Close')
			document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
		else
			[...document.querySelectorAll('button')]
				.find((b) => b.textContent?.trim() === 'Cancel')!
				.click();
		await settle();
		expect(settled).toBe(true);
		await pending;
		if (action === 'Save') {
			expect(result).toBe('{{NAME}}');
			expect(replaceVariables).toHaveBeenCalledOnce();
			expect(cancelSignal).not.toHaveBeenCalled();
		} else {
			expect(result).toBeNull();
			expect(replaceVariables).not.toHaveBeenCalled();
			expect(cancelSignal).toHaveBeenCalledOnce();
		}
		if (component) {
			await unmount(component);
			component = null;
		}
		expect(cancelSignal).toHaveBeenCalledTimes(action === 'Save' ? 0 : 1);
	}
);

const initializer = (kind: 'chat' | 'channel' | 'form', name: string): string => {
	const path =
		kind === 'form'
			? 'src/lib/components/chat/MessageInput/InputVariablesModal.svelte'
			: `src/lib/components/${kind}/MessageInput.svelte`;
	const source = ts.createSourceFile(
		path,
		readFileSync(path, 'utf8').split('<script lang="ts">').at(-1)!.split('</script>')[0],
		ts.ScriptTarget.Latest
	);
	const declaration = source.statements
		.filter(ts.isVariableStatement)
		.flatMap((s) => Array.from(s.declarationList.declarations))
		.find((d) => d.name.getText(source) === name);
	if (!declaration?.initializer) throw new Error(`Missing real ${name}`);
	return declaration.initializer.getText(source);
};
const caller = (kind: 'chat' | 'channel') => {
	let draft = '';
	const input = { focus: vi.fn(), dispatchEvent: vi.fn(), scrollTop: 0, scrollHeight: 100 };
	const replacement = vi.fn();
	const context: {
		[key: string]: unknown;
		inputVariablesModalCallback: (values: Record<string, unknown>) => void;
		inputVariablesModalCancelCallback: () => void;
	} = {
		inputVariables: {},
		inputVariableValues: {},
		showInputVariablesModal: false,
		inputVariablesModalCallback: () => {},
		inputVariablesModalCancelCallback: () => {},
		extractInputVariables: (text: string) =>
			text.includes('{{') ? { NAME: { type: 'text' } } : {},
		replaceVariables: replacement,
		textVariableHandler: async (text: string): Promise<string> => text,
		extractCurlyBraceWords: () => [],
		tick: async (): Promise<void> => {},
		document: { getElementById: () => input },
		$showCallOverlay: false,
		command: '',
		Event,
		chatInputElement: {
			setText: (text: string): void => {
				draft = text;
			},
			focus: vi.fn(),
			insertContent: (text: string): void => {
				draft += text;
			}
		},
		content: '',
		prompt: ''
	};
	const evaluate = (
		name: string
	): ((text: string, cb?: (text: string) => void) => Promise<string | null | void | boolean>) =>
		runInNewContext(
			ts.transpileModule(`(${initializer(kind, name)})`, {
				compilerOptions: { target: ts.ScriptTarget.ES2022 }
			}).outputText,
			context
		) as (text: string, cb?: (text: string) => void) => Promise<string | null | void | boolean>;
	context.inputVariableHandler = evaluate('inputVariableHandler');
	return { context, input, replacement, evaluate, draft: (): string => draft };
};
it.each(
	kinds.flatMap((kind) =>
		['setText', 'insertTextAtCursor'].flatMap((method) =>
			[false, true].map((save) => [kind, method, save] as const)
		)
	)
)('guards %s %s continuation (save=%s)', async (kind, method, save) => {
	const c = caller(kind);
	const continuation = vi.fn();
	const pending = c.evaluate(method)('{{NAME}}', continuation);
	await settle();
	expect(c.context.showInputVariablesModal).toBe(true);
	if (save) c.context.inputVariablesModalCallback({ NAME: 'Alice' });
	else c.context.inputVariablesModalCancelCallback();
	const result = await pending;
	if (method === 'setText') expect(result).toBe(save);
	expect(c.draft()).toBe('{{NAME}}');
	expect(c.replacement).toHaveBeenCalledTimes(save ? 1 : 0);
	expect(continuation).toHaveBeenCalledTimes(method === 'setText' && save ? 1 : 0);
	expect(c.input.dispatchEvent).toHaveBeenCalledTimes(
		method === 'insertTextAtCursor' && save ? 1 : 0
	);
});
it.each(kinds)('settles replaced %s requests and ignores their late saves', async (kind) => {
	const c = caller(kind);
	const handler = c.evaluate('inputVariableHandler');
	const first = handler('{{FIRST}}');
	const lateSave = c.context.inputVariablesModalCallback;
	const second = handler('{{SECOND}}');
	expect(await first).toBeNull();
	lateSave({ NAME: 'Stale' });
	expect(c.replacement).not.toHaveBeenCalled();
	c.context.inputVariablesModalCallback({ NAME: 'Current' });
	expect(await second).toBe('{{SECOND}}');
	expect(c.replacement).toHaveBeenCalledOnce();
	expect(c.context.inputVariableValues).toEqual({ NAME: 'Current' });
});
it.each(kinds)('settles pending %s input when the editor is cleared', async (kind) => {
	const c = caller(kind);
	const continuation = vi.fn();
	const first = c.evaluate('setText')('{{NAME}}', continuation);
	await settle();
	const lateSave = c.context.inputVariablesModalCallback;
	await c.evaluate('setText')('');
	await first;
	lateSave({ NAME: 'Stale' });
	expect(c.draft()).toBe('');
	expect(c.replacement).not.toHaveBeenCalled();
	expect(continuation).not.toHaveBeenCalled();
	expect(c.context.showInputVariablesModal).toBe(false);
});
it.each(kinds)('returns false for %s when the editor is absent', async (kind) => {
	const c = caller(kind);
	c.context.document = { getElementById: () => null };
	const continuation = vi.fn();
	expect(await c.evaluate('setText')('Plain', continuation)).toBe(false);
	expect(continuation).not.toHaveBeenCalled();
	expect(c.draft()).toBe('');
});
it.each(kinds)('passes %s text without variables through without a modal', async (kind) => {
	const c = caller(kind);
	const continuation = vi.fn();
	expect(await c.evaluate('setText')('Plain', continuation)).toBe(true);
	expect(c.draft()).toBe('Plain');
	expect(continuation).toHaveBeenCalledWith('Plain');
	expect(c.context.showInputVariablesModal).toBe(false);
});

it.each(kinds)('settles the %s owner request even before the form paints', async (kind) => {
	const c = caller(kind);
	const path = `src/lib/components/${kind}/MessageInput.svelte`;
	const source = ts.createSourceFile(
		path,
		readFileSync(path, 'utf8').split('<script lang="ts">').at(-1)!.split('</script>')[0],
		ts.ScriptTarget.Latest
	);
	const statement = source.statements
		.filter(ts.isExpressionStatement)
		.find(
			(s) =>
				ts.isCallExpression(s.expression) &&
				s.expression.expression.getText(source) === 'onDestroy' &&
				s.getText(source).includes('inputVariablesModalCancelCallback')
		);
	if (!statement || !ts.isCallExpression(statement.expression))
		throw Error('Missing real owner cleanup');
	const cleanup = runInNewContext(
		ts.transpileModule(`(${statement.expression.arguments[0].getText(source)})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		c.context
	) as () => void;
	const pending = c.evaluate('inputVariableHandler')('{{NAME}}');
	const lateSave = c.context.inputVariablesModalCallback;
	cleanup();
	expect(await pending).toBeNull();
	lateSave({ NAME: 'Stale' });
	expect(c.replacement).not.toHaveBeenCalled();
});

it.each(kinds)('keeps the %s request cancellable after replacement fails', async (kind) => {
	const c = caller(kind);
	const continuation = vi.fn();
	const pending = c.evaluate('setText')('{{NAME}}', continuation);
	await settle();
	const error = new Error('Editor unavailable');
	c.replacement.mockImplementationOnce(() => {
		throw error;
	});
	expect(() => c.context.inputVariablesModalCallback({ NAME: 'Alice' })).toThrow(error);
	c.context.inputVariablesModalCancelCallback();
	const resolved = await Promise.race([
		pending.then(() => true),
		new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 15))
	]);
	expect(resolved).toBe(true);
	expect(continuation).not.toHaveBeenCalled();
	expect(c.context.inputVariableValues).toEqual({});
});
it('leaves a failed shared save open and cancellable', () => {
	const cancel = vi.fn();
	const error = new Error('Save failed');
	const context = {
		variableValues: { NAME: 'Alice' },
		awaitingInput: true,
		show: true,
		onSave: () => {
			throw error;
		},
		cancelCallback: cancel
	};
	const evaluate = (name: string): (() => void) =>
		runInNewContext(
			ts.transpileModule(`(${initializer('form', name)})`, {
				compilerOptions: { target: ts.ScriptTarget.ES2022 }
			}).outputText,
			context
		) as () => void;
	expect(evaluate('submitHandler')).toThrow(error);
	expect(context.show).toBe(true);
	expect(context.awaitingInput).toBe(true);
	evaluate('cancelHandler')();
	expect(cancel).toHaveBeenCalledOnce();
});
