// @vitest-environment jsdom
import { Blob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { decode } from 'html-entities';
import { marked, type Token, type Tokens } from 'marked';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const root = 'src/lib/components/chat/Messages/Markdown/';
const nodes = (value: unknown): Record<string, unknown>[] => {
	if (!value || typeof value !== 'object') return [];
	if (Array.isArray(value)) return value.flatMap(nodes);
	return [value as Record<string, unknown>, ...Object.values(value).flatMap(nodes)];
};
function load(name = 'MarkdownTokens', fixture: Record<string, unknown> = {}) {
	const text = readFileSync(
		process.env.AIRIS_MARKDOWN_BEFORE
			? `${process.env.AIRIS_MARKDOWN_BEFORE}/before-${name}.svelte`
			: `${root}${name}.svelte`,
		'utf8'
	);
	const parsed = parse(text);
	if (!parsed.instance) throw new Error('Missing actual renderer script');
	const ast = ts.createSourceFile(
		'renderer.ts',
		text.slice(parsed.instance.content.start, parsed.instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const script = ts.createPrinter().printList(
		ts.ListFormat.MultiLine,
		ts.factory.createNodeArray(
			ast.statements
				.filter((s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s))
				.map((s) =>
					ts.isVariableStatement(s)
						? ts.factory.updateVariableStatement(
								s,
								s.modifiers?.filter((m) => m.kind !== ts.SyntaxKind.ExportKeyword),
								s.declarationList
							)
						: s
				)
		),
		ast
	);
	const handlers = nodes(parsed.html)
		.filter(
			(node) => node.type === 'EventHandler' && ['change', 'load'].includes(String(node.name))
		)
		.map((node) => {
			const e = node.expression as { start: number; end: number };
			return text.slice(e.start, e.end);
		});
	const task = vi.fn(),
		save = vi.fn<[Blob, string], void>();
	const result = runInNewContext(
		ts.transpileModule(
			`${script}\nonTaskClick = task; id = 'fixture'; ({group: typeof getDisplayTokens === 'undefined' ? null : getDisplayTokens, detail: typeof getDetailTextContent === 'undefined' ? null : getDetailTextContent, csv: typeof exportTableToCSVHandler === 'undefined' ? null : exportTableToCSVHandler, handlers: [${handlers.join(',')}], tokens: () => tokens});`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		{
			getContext: () => ({}),
			decode,
			marked,
			Blob,
			fileSaver: { saveAs: save },
			task,
			$settings: {},
			console: { log: vi.fn() },
			...fixture
		}
	) as {
		group: (tokens?: Token[]) => (Token | { type: string; items: Token[] })[];
		detail: (token: { text?: string } | null) => string;
		csv: (token: Token, index?: number) => void;
		handlers: ((event: { currentTarget: unknown; target?: unknown }) => void)[];
		tokens: () => Token[] | undefined;
	};
	return { ...result, task, save, html: parsed.html };
}
const detail = (type: string, text = 'answer'): Token => ({
	type: 'details',
	raw: 'fixture',
	summary: type,
	text,
	attributes: { type }
});
it.each([
	{ tokens: [] },
	{ tokens: [detail('reasoning')] },
	{ tokens: [detail('reasoning'), detail('tool_calls')] },
	{ tokens: [detail('reasoning'), detail('code_interpreter'), detail('tool_calls')] }
])('preserves consecutive detail grouping %j', ({ tokens }) => {
	const r = load();
	const grouped = r.group(tokens);
	expect(grouped).toEqual(tokens.length > 1 ? [{ type: 'detail_group', items: tokens }] : tokens);
	expect(tokens).toHaveLength(tokens.length);
});
it('flushes groups at plain text, unknown details, and end without mutating tokens', () => {
	const r = load(),
		paragraph = marked.lexer('hello')[0],
		unknown = detail('other');
	const tokens = [
		detail('reasoning'),
		detail('tool_calls'),
		paragraph,
		unknown,
		detail('code_interpreter')
	];
	const snapshot = structuredClone(tokens);
	expect(r.group(tokens)).toEqual([
		{ type: 'detail_group', items: tokens.slice(0, 2) },
		paragraph,
		unknown,
		tokens[4]
	]);
	expect(tokens).toEqual(snapshot);
	expect(r.group()).toEqual([]);
});
it('decodes existing detail text and removes its inline summary', () => {
	const r = load();
	expect(r.detail({ text: '<summary>Title</summary>\n&amp; ответ' })).toBe('& ответ');
	expect(r.detail(null)).toBe('');
});
it('exports the actual marked table with BOM, quoting, Unicode and existing filename', async () => {
	const r = load(),
		table = marked.lexer('| Имя | Значение |\n| --- | --- |\n| Аня | a, "b" &amp; **c** |')[0];
	r.csv(table, 3);
	expect(r.save).toHaveBeenCalledOnce();
	const [blob, name] = r.save.mock.calls[0];
	expect(name).toBe('table-fixture-3.csv');
	expect(blob.type).toBe('text/csv;charset=utf-8');
	expect(Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3))).toEqual([239, 187, 191]);
	expect(await blob.text()).toBe('"Имя","Значение"\n"Аня","a, ""b"" & c"');
});
it('exports empty table cells and existing inline tokens without text', async () => {
	const r = load(),
		table = marked.lexer('| A | B |\n| --- | --- |\n| | <br> |')[0] as Tokens.Table;
	const paragraph = marked.lexer('a  \nb')[0] as Tokens.Paragraph;
	const br = paragraph.tokens.find((token) => token.type === 'br');
	if (!br) throw new Error('Missing actual marked break token');
	table.rows[0][1].tokens = [br];
	r.csv(table);
	const [blob, name] = r.save.mock.calls[0];
	expect(name).toBe('table-fixture-0.csv');
	expect(Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3))).toEqual([239, 187, 191]);
	expect(await blob.text()).toBe('"A","B"\n"",""');
});
it('both task checkboxes preserve their actual callback payload', () => {
	const token = marked.lexer('- [ ] Task')[0] as Token & { items: Token[] };
	const item = token.items[0];
	const r = load('MarkdownTokens', { token, item, tokenIdx: 2, itemIdx: 0 });
	const input = document.createElement('input');
	input.type = 'checkbox';
	input.checked = true;
	expect(r.handlers).toHaveLength(3);
	for (const handler of r.handlers.slice(0, 2)) handler({ target: input, currentTarget: input });
	expect(r.task.mock.calls.map(([value]) => value)).toEqual(
		Array(2).fill({ id: 'fixture', token, item, tokenIdx: 2, itemIdx: 0, checked: true })
	);
});
it.each(['MarkdownTokens', 'MarkdownInlineTokens', 'HTMLToken'])(
	'native %s iframe handlers preserve sizing and inaccessible frame height',
	(name) => {
		const r = load(name);
		const handlers = name === 'MarkdownTokens' ? r.handlers.slice(2) : r.handlers;
		expect(handlers).toHaveLength(name === 'HTMLToken' ? 2 : 1);
		for (const handler of handlers) {
			const frame = {
				style: { height: '100px' },
				contentWindow: { document: { body: { scrollHeight: 123 } } }
			};
			handler({ currentTarget: frame });
			expect(frame.style.height).toBe('143px');
			const denied = {
				style: { height: '100px' },
				get contentWindow() {
					throw new DOMException('cross-origin', 'SecurityError');
				}
			};
			expect(() => handler({ currentTarget: denied })).not.toThrow();
			expect(denied.style.height).toBe('100px');
			const absent = { style: { height: '100px' }, contentWindow: null };
			expect(() => handler({ currentTarget: absent })).not.toThrow();
			expect(absent.style.height).toBe('100px');
		}
	}
);
it('inline renderer has a safe default when optional child tokens are absent', () => {
	expect(load('MarkdownInlineTokens').tokens()).toEqual([]);
});

it('generic HTML iframe keeps the complete empty sandbox restriction', () => {
	const frames = nodes(load('HTMLToken').html).filter((node) => node.name === 'iframe');
	const attr = frames
		.flatMap((node) => nodes(node.attributes))
		.find((node) => node.type === 'Attribute' && node.name === 'sandbox');
	if (!attr) throw new Error('Missing generic iframe sandbox');
	const value = attr.value === true ? '' : (attr.value as { data: string }[])[0]?.data;
	if (typeof value !== 'string') throw new Error('Unexpected dynamic sandbox');
	const frame = document.createElement('iframe');
	frame.setAttribute('sandbox', value);
	expect(frame.getAttribute('sandbox')).toBe('');
});
