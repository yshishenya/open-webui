// @vitest-environment node
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

it.each(['loaded', 'closed-while-loading', 'failed'] as const)(
	'releases the actual cell editor when language is %s',
	async (mode) => {
		let resolve!: (value: object) => void;
		let reject!: (reason: Error) => void;
		const pending = new Promise<object>((done, fail) => {
			resolve = done;
			reject = fail;
		});
		const load = vi.fn(() => pending);
		const dispatch = vi.fn(),
			warn = vi.fn(),
			focus = vi.fn(),
			destroy = vi.fn(),
			apply = vi.fn();
		const observe = vi.fn(),
			disconnect = vi.fn();
		const mounts: (() => unknown)[] = [],
			closes: (() => void)[] = [];
		const shortcuts: { key: string; run: () => boolean }[] = [];
		let onChange!: (event: {
			docChanged: boolean;
			state: { doc: { toString: () => string } };
		}) => void;
		class Editor {
			static updateListener = {
				of: (callback: typeof onChange) => {
					onChange = callback;
					return callback;
				}
			};
			static theme = (value: object) => value;
			dispatch = apply;
			focus = focus;
			destroy = destroy;
		}
		class Compartment {
			of(value: unknown): unknown {
				return value;
			}
			reconfigure(value: unknown): unknown {
				return value;
			}
		}
		const file = 'src/lib/components/chat/FileNav/CellEditor.svelte';
		const source = readFileSync(file, 'utf8').split('<script lang="ts">')[1].split('</script>')[0];
		const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
		const script = ast.statements
			.filter((s) => !ts.isImportDeclaration(s))
			.map((s) => s.getText(ast).replace(/^export /, ''))
			.join('\n');
		runInNewContext(
			ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
				.outputText,
			{
				createEventDispatcher: () => dispatch,
				onMount: (callback: () => unknown) => mounts.push(callback),
				onDestroy: (callback: () => void) => closes.push(callback),
				EditorView: Editor,
				Compartment,
				EditorState: { create: (value: object) => value },
				Prec: { highest: (value: unknown) => value },
				basicSetup: {},
				oneDark: {},
				keymap: {
					of: (bindings: typeof shortcuts) => {
						shortcuts.push(...bindings);
						return bindings;
					}
				},
				indentWithTab: {},
				indentUnit: { of: (value: string) => value },
				languages: [{ alias: ['python'], load }],
				document: { documentElement: { classList: { contains: () => false } } },
				MutationObserver: class {
					observe = observe;
					disconnect = disconnect;
				},
				console: { warn }
			}
		);
		const result = mounts[0]();
		const errors: unknown[] = [];
		const observedMount = Promise.resolve(result).catch((error) => {
			errors.push(error);
		});
		const close = () => {
			if (typeof result === 'function') result();
			closes.forEach((callback) => callback());
		};
		if (mode === 'closed-while-loading') close();
		if (mode === 'failed') reject(new Error('private language failure'));
		else resolve({ language: 'python' });
		await observedMount;
		await setImmediate();
		if (mode !== 'closed-while-loading') close();
		expect(errors).toEqual([]);
		expect(typeof result).toBe('function');
		expect(observe).toHaveBeenCalledOnce();
		expect(disconnect).toHaveBeenCalledOnce();
		expect(destroy).toHaveBeenCalledOnce();
		if (mode === 'closed-while-loading') expect(apply).not.toHaveBeenCalled();
		if (mode === 'failed') {
			expect(warn).toHaveBeenCalledWith('Could not load cell editor language');
			expect(JSON.stringify(warn.mock.calls)).not.toContain('private language failure');
		}
		if (mode === 'loaded') {
			expect(apply).toHaveBeenCalledOnce();
			expect(focus).toHaveBeenCalledOnce();
			expect(shortcuts.find((s) => s.key === 'Mod-Enter')?.run()).toBe(true);
			expect(shortcuts.find((s) => s.key === 'Escape')?.run()).toBe(true);
			onChange({ docChanged: true, state: { doc: { toString: () => 'edited' } } });
			expect(dispatch.mock.calls).toEqual([['run'], ['cancel'], ['change', 'edited']]);
		}
	}
);
