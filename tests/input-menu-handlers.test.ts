// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import type { ChatAttachment } from '$lib/utils/airis/chat_history';

const source = readFileSync('src/lib/components/chat/MessageInput/InputMenu.svelte', 'utf8')
	.split('</script>')[0]
	.replace('<script lang="ts">', '');
const ast = ts.createSourceFile('InputMenu.ts', source, ts.ScriptTarget.Latest, true);
const names = ['onSelect', 'handleFileChange'];
const initializers = new Map<string, string>();
for (const statement of ast.statements) {
	if (!ts.isVariableStatement(statement)) continue;
	for (const declaration of statement.declarationList.declarations) {
		const name = declaration.name.getText(ast);
		if (names.includes(name) && declaration.initializer)
			initializers.set(name, declaration.initializer.getText(ast));
	}
}
if (initializers.size !== 2) throw new Error('Actual InputMenu handlers missing');
const code = ts.transpileModule(
	names.map((name) => `const ${name} = ${initializers.get(name)};`).join('\n'),
	{ compilerOptions: { target: ts.ScriptTarget.ESNext } }
).outputText;
type Handlers = {
	onSelect: (item: ChatAttachment) => void;
	handleFileChange: (event: { target: HTMLInputElement }) => void;
	state: () => { files: ChatAttachment[]; show: boolean };
};

it('keeps complete selection records, ignores duplicate ids and forwards native files once', () => {
	const upload = vi.fn();
	const handlers = new Function(
		'inputFilesHandler',
		`let files = [], show = true; ${code}; return {onSelect, handleFileChange, state: () => ({files, show})};`
	)(upload) as Handlers;
	const item: ChatAttachment = {
		id: 'stored',
		type: 'file',
		name: 'Файл.pdf',
		meta: { name: null },
		data: { content: 'kept' }
	};
	handlers.onSelect(item);
	expect(handlers.state()).toEqual({ files: [{ ...item, status: 'processed' }], show: false });
	handlers.onSelect({ ...item, name: 'Duplicate' });
	expect(handlers.state().files).toEqual([{ ...item, status: 'processed' }]);
	expect(item.status).toBeUndefined();
	const target = document.createElement('input');
	target.type = 'file';
	const file = new File(['picture'], 'photo.png', { type: 'image/png' });
	Object.defineProperty(target, 'files', { configurable: true, value: [file] });
	handlers.handleFileChange({ target });
	expect(upload).toHaveBeenCalledOnce();
	expect(upload).toHaveBeenCalledWith([file]);
	Object.defineProperty(target, 'files', { value: [] });
	handlers.handleFileChange({ target });
	expect(upload).toHaveBeenCalledOnce();
});
