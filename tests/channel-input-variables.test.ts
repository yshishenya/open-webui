// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const initializer = (path: string, name: string): string => {
	const file = readFileSync(path, 'utf8');
	const source = ts.createSourceFile(
		path,
		file.split('<script lang="ts">').at(-1)!.split('</script>')[0],
		ts.ScriptTarget.Latest
	);
	for (const statement of source.statements) {
		if (ts.isVariableStatement(statement)) {
			const declaration = statement.declarationList.declarations.find(
				(item) => item.name.getText(source) === name
			);
			if (declaration?.initializer) return declaration.initializer.getText(source);
		}
	}
	throw new Error(`Missing ${name} in ${path}`);
};

it.each<['channel' | 'chat', boolean, string, string, boolean]>([
	['channel', false, 'Before {{ NAME }}', ' + text', false],
	['channel', true, '/task', '{{ NAME }}', false],
	['channel', false, 'Before', '{{ NAME }}', true],
	['chat', false, 'Before {{ NAME }}', ' + text', false],
	['chat', true, '/task', '{{ NAME }}', false]
])(
	'uses current %s editor text (command=%s, initial=%s, insertion=%s, resolve=%s)',
	async (kind, command, initial, inserted, resolve) => {
		const input = { scrollTop: 3, scrollHeight: 100, focus: vi.fn(), dispatchEvent: vi.fn() };
		const container = { scrollTop: 0, scrollHeight: 200 };
		let current: string = initial;
		const context = {
			content: current,
			prompt: kind === 'chat' ? current : vi.fn(),
			command: command ? '/task' : '',
			document: { getElementById: (id: string) => (id === 'chat-input' ? input : container) },
			Event,
			tick: async (): Promise<void> => {},
			textVariableHandler: async (text: string): Promise<string> => text,
			inputVariableHandler: async (text: string): Promise<string> => {
				if (resolve) {
					current = current.replace('{{ NAME }}', 'Alice');
					context.content = current;
					if (kind === 'chat') context.prompt = current;
				}
				return text;
			},
			replaceCommandWithText: (text: string): void => update(text),
			chatInputElement: { insertContent: (text: string): void => update(current + text) }
		};
		const update = (text: string): void => {
			current = text;
			context.content = current;
			if (kind === 'chat') context.prompt = current;
		};
		const code = `const extractCurlyBraceWords = ${initializer('src/lib/utils/index.ts', 'extractCurlyBraceWords')}; (${initializer(`src/lib/components/${kind}/MessageInput.svelte`, 'insertTextAtCursor')})`;
		const handler = runInNewContext(
			ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
			context
		) as (text: string) => Promise<void>;
		await handler(inserted);
		expect(current).toBe(
			command
				? inserted
				: resolve
					? (initial + inserted).replace('{{ NAME }}', 'Alice')
					: initial + inserted
		);
		expect(input.dispatchEvent).toHaveBeenCalledOnce();
		expect(input.scrollTop).toBe(current.includes('{{') ? 3 : 100);
		expect(container.scrollTop).toBe(200);
	}
);
