import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { NoteSearchResponse } from '../src/lib/utils/airis/notes';

// Run the component's actual pagination handlers with a failing search and a retry.
const source = readFileSync(
	new URL('../src/lib/components/notes/Notes.svelte', import.meta.url),
	'utf8'
)
	.split('</script>')[0]
	.replace('<script lang="ts">', '');
const ast = ts.createSourceFile('Notes.ts', source, ts.ScriptTarget.Latest, true);
const handlers = new Map<string, string>();
const find = (node: ts.Node): void => {
	if (
		ts.isVariableDeclaration(node) &&
		['getItemsPage', 'loadMoreItems'].includes(node.name.getText(ast))
	) {
		handlers.set(node.name.getText(ast), node.initializer?.getText(ast) ?? '');
	}
	ts.forEachChild(node, find);
};
find(ast);
if (handlers.size !== 2) throw new Error('Notes pagination handlers missing');
const code = ts.transpileModule(
	[...handlers].map(([name, body]) => `const ${name} = ${body};`).join('\n'),
	{ compilerOptions: { target: ts.ScriptTarget.ESNext } }
).outputText;
type Search = (...args: (string | number | null)[]) => Promise<NoteSearchResponse | null>;
const makePagination = new Function(
	'searchNotes',
	`
	const localStorage = { token: 'test' };
	const toast = { error() {} };
	let query = '', viewOption = null, permission = null, sortKey = 'updated_at', sortDirection = 'desc';
	let page = 1, total = 3, items = [{ id: 'existing' }], itemsLoading = false, itemsLoadFailed = false, allItemsLoaded = false;
	${code}
	return { loadMoreItems, state: () => ({ page, total, items, itemsLoading, itemsLoadFailed, allItemsLoaded }) };
`
) as (search: Search) => {
	loadMoreItems: () => Promise<void>;
	state: () => {
		page: number;
		total: number;
		items: { id: string }[];
		itemsLoading: boolean;
		itemsLoadFailed: boolean;
		allItemsLoaded: boolean;
	};
};

it('keeps existing notes, releases loading and retries the failed page without duplicate rows', async () => {
	const pages: (string | number | null)[] = [];
	let attempts = 0;
	const item = {
		id: 'next',
		title: 'Next',
		user_id: 'owner',
		data: null,
		meta: null,
		is_pinned: false,
		access_grants: [],
		created_at: 1,
		updated_at: 1
	};
	const pagination = makePagination(async (...args) => {
		pages.push(args[5]);
		if (++attempts === 1) throw new Error('Search unavailable');
		return { items: [{ ...item, id: 'existing' }, item], total: 3 };
	});
	await expect(pagination.loadMoreItems()).resolves.toBeUndefined();
	expect(pagination.state()).toEqual({
		page: 1,
		total: 3,
		items: [{ id: 'existing' }],
		itemsLoading: false,
		itemsLoadFailed: true,
		allItemsLoaded: false
	});
	await pagination.loadMoreItems();
	expect(pages).toEqual([2, 2]);
	expect(pagination.state().items.map((note) => note.id)).toEqual(['existing', 'next']);
	expect(pagination.state().itemsLoading).toBe(false);
	expect(pagination.state().itemsLoadFailed).toBe(false);
});
