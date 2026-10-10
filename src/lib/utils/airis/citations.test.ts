// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { groupCitations, type Citation } from './citations';

const script = (path: string): string => {
	const source = readFileSync(`src/lib/components/${path}`, 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing component script');
	const ast = ts.createSourceFile(
		'component.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	return ast.statements
		.filter((s) => !ts.isImportDeclaration(s))
		.sort((a, b) => Number(ts.isLabeledStatement(a)) - Number(ts.isLabeledStatement(b)))
		.map((s) => s.getText(ast).replace(/^export /, ''))
		.join('\n');
};
const run = (code: string, context: Record<string, unknown>): unknown =>
	runInNewContext(
		ts.transpileModule(`(() => {${code}})()`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	);
const setup = (input: unknown) => {
	const embed = { set: vi.fn() },
		showControls = { set: vi.fn() },
		showEmbeds = { set: vi.fn() };
	const code = script('chat/Messages/Citations.svelte').replace(
		/let sources(?:\s*:[^=]+)?\s*=\s*\[\];/,
		'let sources = input;'
	);
	const api = run(
		code + '\nreturn {citations, showSourceModal, selected: () => selectedCitation};',
		{
			input,
			groupCitations,
			getContext: () => ({}),
			console: { log: () => {} },
			embed,
			showControls,
			showEmbeds,
			window: { open: vi.fn() }
		}
	) as {
		citations: Citation[];
		showSourceModal: (id: string | number) => void;
		selected: () => Citation | null;
	};
	return { ...api, embed, showControls, showEmbeds };
};
const labels = (sources: unknown): string[] =>
	run(
		script('chat/Messages/ContentRenderer.svelte').replace(
			'let sources = null;',
			'let sources = input;'
		) + '\nreturn sourceIds;',
		{ input: sources, groupCitations, onDestroy: () => {}, model: null }
	) as string[];
const documents = (
	citation: Citation | null
): { document: string; metadata?: { page?: number }; distance?: number }[] =>
	run(
		script('chat/Messages/Citations/CitationModal.svelte').replace(
			/let citation(?:\s*:[^=;]+)?(?:\s*=\s*null)?;/,
			'let citation = input;'
		) + '\nreturn mergedDocuments;',
		{ input: citation, getContext: () => ({}), WEBUI_API_BASE_URL: '/api/v1' }
	) as { document: string; metadata?: { page?: number }; distance?: number }[];

it('two different source ids with the same name keep two matching labels and click targets', () => {
	const input = [
		{ source: { id: 'one', name: 'Report' }, document: ['First'] },
		{ source: { id: 'two', name: 'Report' }, document: ['Second'] }
	];
	const c = setup(input);
	expect(labels(input)).toEqual(['Report', 'Report']);
	c.showSourceModal(2);
	expect(c.selected()?.document).toEqual(['Second']);
});

it('missing metadata and scores do not borrow the next chunk values', () => {
	const input = [
		{
			source: { id: 'file', name: 'Report' },
			document: ['First', 'Second'],
			metadata: [null, { page: 2, file_id: 'file', source: 'file', parameters: { a: 1 } }],
			distances: [undefined, 0.9]
		}
	];
	const c = setup(input);
	const docs = documents(c.citations[0]);
	expect(docs.map((d) => [d.document, d.metadata?.page, d.distance])).toEqual([
		['First', undefined, undefined],
		['Second', 2, 0.9]
	]);
});

it.each([null, [null], [{ document: ['Text'] }], [{ source: { id: 12 }, document: ['Text'] }]])(
	'incomplete legacy sources %j do not crash or produce a non-string name',
	(input) => {
		const c = setup(input);
		expect(labels(input)).toEqual(c.citations.map((citation) => citation.source.name));
		c.citations.forEach((citation) => expect(typeof citation.source.name).toBe('string'));
	}
);

it('an empty citation can be opened without running every on undefined', () => {
	expect(
		documents({
			id: 'empty',
			source: { id: 'empty', name: 'Empty' },
			document: [],
			metadata: [],
			distances: []
		})
	).toEqual([]);
});

it('the source button keeps legacy one-based numbers', () => {
	const source = readFileSync(
		'src/lib/components/chat/Messages/Markdown/SourceToken.svelte',
		'utf8'
	);
	const expression = source.match(/\{@const identifier = ([^}]+)\}/)?.[1];
	if (!expression) throw new Error('Missing actual identifier expression');
	const identifier = run(`return ${expression};`, { token: { ids: [2] }, id: 2 });
	const c = setup([
		{ source: { id: 'first' }, document: ['First'] },
		{ source: { id: 'second' }, document: ['Second'] }
	]);
	c.showSourceModal(identifier as number);
	expect(c.selected()?.id).toBe('second');
});

it('an embedded citation keeps the original query, hash and full source identifier', () => {
	const c = setup([
		{
			source: { id: 'embed', name: 'Widget', embed_url: '/widget?mode=view#section' },
			document: ['Text']
		}
	]);
	c.showSourceModal('1#chunk');
	const value = c.embed.set.mock.calls[0]?.[0];
	expect(value.sourceId).toBe('1#chunk');
	const url = run(
		script('chat/ChatControls/Embeds.svelte') +
			'\nreturn getSrcUrl(input.url, input.chatId, input.messageId, input.sourceId);',
		{
			input: value,
			URL,
			window: { location: { href: 'https://chat.airis.you/c/chat' } }
		}
	) as string;
	const parsed = new URL(url, 'https://chat.airis.you');
	expect(parsed.searchParams.get('source_id')).toBe('1#chunk');
	expect(parsed.hash).toBe('#section');
});

it('grouping preserves payload extras, first appearance and sparse positions', () => {
	const source = { id: 'file', name: 'File', custom: { keep: true } };
	const input = [
		{
			source,
			document: ['A', 'B'],
			metadata: [null, { parameters: { b: 2 } }],
			distances: [null, 0]
		}
	];
	const copy = structuredClone(input);
	const c = groupCitations(input)[0];
	expect(c.document).toEqual(['A', 'B']);
	expect(c.distances).toEqual([undefined, 0]);
	expect(c.metadata[0]).toBeUndefined();
	expect(c.metadata[1]?.parameters).toEqual({ b: 2 });
	expect(c.source.custom).toEqual({ keep: true });
	expect(input).toEqual(copy);
});

it('text fragments preserve file pages and Russian text', () => {
	const url = run(
		script('chat/Messages/Citations/CitationModal.svelte') +
			'\nreturn getTextFragmentUrl(inputDoc);',
		{
			getContext: () => ({}),
			WEBUI_API_BASE_URL: '/api/v1',
			inputDoc: {
				source: { id: 'file', name: 'File' },
				document: 'Первое последнее',
				metadata: { file_id: 'file', page: 2 }
			}
		}
	) as string;
	expect(decodeURIComponent(url)).toBe('/api/v1/files/file/content#page=3:~:text=Первое,последнее');
});
