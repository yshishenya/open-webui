import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { vi } from 'vitest';
import type { SearchResponse, SearchResult } from '../../src/lib/apis/search';
export const result = (id: string): SearchResult => ({
	id,
	kind: 'chat',
	title: id,
	context: 'Personal chat',
	snippet: '',
	preview: '',
	url: `/c/${id}`,
	updated_at: 1,
	shared: false,
	pinned: false
});
export const response = (ids: string[], more = false): SearchResponse => ({
	items: ids.map(result),
	has_more: more,
	scopes: [],
	kinds: ['chat', 'note']
});
export const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};
export function searchRig() {
	const file = 'src/lib/components/layout/SearchModal.svelte';
	const source = readFileSync(file, 'utf8');
	const script = parse(source).instance!;
	const ast = ts.createSourceFile(
		'search.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const body = ast.statements
		.filter((s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s))
		.map((s) => s.getText(ast).replace(/^export /, ''))
		.join('\n');
	const searchWorkspace = vi.fn<
		Parameters<typeof import('../../src/lib/apis/search').searchWorkspace>,
		Promise<SearchResponse>
	>();
	const goto = vi.fn(async () => {});
	const onClose = vi.fn();
	const storage = { token: 'fixture' };
	let destroy = () => {};
	const context = {
		searchWorkspace,
		goto,
		onClose,
		localStorage: storage,
		AbortController,
		Set,
		Map,
		clearTimeout,
		setTimeout,
		getContext: () => ({}),
		$i18n: { t: (s: string) => s },
		ChatBubble: {},
		Hashtag: {},
		Document: {},
		tick: async () => {},
		onDestroy: (fn: () => void) => {
			destroy = fn;
		}
	};
	const api = runInNewContext(
		ts.transpileModule(
			body +
				`\nshow=true; onClose=closeSpy; ({fetch:fetchResults,schedule:()=>schedule(show,query,kind,sharing,scope),close,select,open,change:(values)=>{if(values.query!==undefined)query=values.query;if(values.kind!==undefined)kind=values.kind;if(values.sharing!==undefined)sharing=values.sharing;if(values.scope!==undefined)scope=values.scope;},state:()=>({results,loading,error,page,hasMore,selectedIndex,show}),scroll:(element)=>{list=element;}})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		{ ...context, closeSpy: onClose }
	) as {
		fetch: (page: number) => Promise<void>;
		schedule: () => void;
		close: () => void;
		select: (index: number) => Promise<void>;
		open: (value: SearchResult) => Promise<void>;
		change: (values: { query?: string; kind?: string; sharing?: string; scope?: string }) => void;
		state: () => {
			results: SearchResult[];
			loading: boolean;
			error: string;
			page: number;
			hasMore: boolean;
			selectedIndex: number;
			show: boolean;
		};
		scroll: (element: {
			querySelector: (selector: string) => { scrollIntoView: (options: object) => void };
		}) => void;
	};
	return { api, searchWorkspace, goto, onClose, storage, destroy: () => destroy() };
}
