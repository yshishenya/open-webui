import { expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
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
let collectBody = '';
const find = (node: ts.Node): void => {
	if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'readDirectoryEntries') {
		body = node.initializer?.getText(ast) ?? '';
	}
	if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'collectDirectoryFiles') {
		collectBody = node.initializer?.getText(ast) ?? '';
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

type PickedFile = { name: string };
type FileHandle = { kind: 'file'; name: string; getFile: () => Promise<PickedFile> };
type DirectoryHandle = {
	kind: 'directory';
	name: string;
	values: () => AsyncIterableIterator<DirectoryHandle | FileHandle>;
};
const directory = (name: string, entries: (FileHandle | DirectoryHandle)[]): DirectoryHandle => ({
	kind: 'directory',
	name,
	async *values() {
		yield* entries;
	}
});
const file = (name: string): FileHandle => ({
	kind: 'file',
	name,
	getFile: async () => ({ name })
});
const collect = (root: DirectoryHandle) => {
	if (!collectBody) throw new Error('Actual directory collection handler missing');
	const error = vi.fn();
	const run = runInNewContext(
		ts.transpileModule(`(${collectBody})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		{
			window: { showDirectoryPicker: async () => root },
			hasHiddenFolder: (path: string) => path.split('/').some((part) => part.startsWith('.')),
			handleUploadError: error,
			Error
		}
	) as () => Promise<{ path: string; filename: string; file: PickedFile }[] | null>;
	return { run, error };
};
it('collects nested modern directory handles and skips hidden files and folders', async () => {
	const r = collect(
		directory('root', [
			file('first.md'),
			file('.secret'),
			directory('nested', [file('second.md')]),
			directory('.private', [file('hidden.md')])
		])
	);
	expect(await r.run()).toEqual([
		{ path: 'root', filename: 'first.md', file: { name: 'first.md' } },
		{ path: 'root/nested', filename: 'second.md', file: { name: 'second.md' } }
	]);
	expect(r.error).not.toHaveBeenCalled();
});
it('reports a nested file read refusal with its path and returns no partial manifest', async () => {
	const refused: FileHandle = {
		kind: 'file',
		name: 'refused.md',
		getFile: async () => {
			throw new Error('permission denied');
		}
	};
	const r = collect(directory('root', [file('first.md'), directory('nested', [refused])]));
	expect(await r.run()).toBeNull();
	expect(r.error).toHaveBeenCalledTimes(1);
	expect(r.error.mock.calls[0][0].message).toBe(
		'"root/nested/refused.md": Error: permission denied'
	);
});
