import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the component's real native-reader loop without substituting its body.
const source = readFileSync(
	new URL('../src/lib/components/workspace/Knowledge/KnowledgeBase.svelte', import.meta.url),
	'utf8'
)
	.split('</script>')[0]
	.replace('<script lang="ts">', '');
const ast = ts.createSourceFile('KnowledgeBase.ts', source, ts.ScriptTarget.Latest, true);
let body = '';
const find = (node: ts.Node): void => {
	if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'readDirectoryEntries') {
		body = node.initializer?.getText(ast) ?? '';
	}
	ts.forEachChild(node, find);
};
find(ast);
if (!body) throw new Error('KnowledgeBase native-reader handler missing');
const code = ts.transpileModule(`const readDirectoryEntries = ${body};`, {
	compilerOptions: { target: ts.ScriptTarget.ESNext }
}).outputText;
type Entry = { name: string };
type Reader = {
	readEntries: (resolve: (entries: Entry[]) => void, reject: (error: Error) => void) => void;
};
const readEntries = new Function(`${code}; return readDirectoryEntries;`)() as (
	reader: Reader
) => Promise<Entry[]>;

it('reads every native batch through the empty terminator and propagates a reader failure', async () => {
	const batches: Entry[][] = [[{ name: 'first' }, { name: 'second' }], [{ name: 'third' }], []];
	let calls = 0;
	const reader: Reader = {
		readEntries: (resolve) => {
			const batch = batches[calls++];
			if (!batch) throw new Error('Reader was called after the empty terminator');
			resolve(batch);
		}
	};
	expect(await readEntries(reader)).toEqual(batches.flat());
	expect(calls).toBe(3);
	const failure = new Error('Native directory unavailable');
	await expect(readEntries({ readEntries: (_resolve, reject) => reject(failure) })).rejects.toBe(
		failure
	);
});
