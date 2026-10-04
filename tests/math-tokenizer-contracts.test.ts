// @vitest-environment node
import { Marked, type Token, type Tokens } from 'marked';
import { describe, expect, it } from 'vitest';
import mathExtension, { tokenizeDisplayMath } from '$lib/utils/marked/katex-extension';

function mathTokens(source: string): Tokens.Generic[] {
	const marked = new Marked(mathExtension({ throwOnError: false }));
	const result: Tokens.Generic[] = [];
	marked.walkTokens(marked.lexer(source), (token: Token) => {
		if (token.type === 'inlineKatex' || token.type === 'blockKatex') result.push(token);
	});
	return result;
}

describe('existing math delimiters through the installed Marked lexer', () => {
	it.each([
		['$x$', 'inlineKatex', 'x', false],
		['$$x$$', 'blockKatex', 'x', true],
		['$$\nx\n$$', 'blockKatex', '\nx\n', true],
		['\\(x\\)', 'inlineKatex', 'x', false],
		['\\[x\\]', 'inlineKatex', 'x', false],
		['\\[\nx\n\\]', 'blockKatex', 'x', true],
		['\\begin{equation}\nx\n\\end{equation}', 'blockKatex', 'x', true],
		['\\ce{H2O}', 'inlineKatex', 'H2O', false],
		['\\pu{2 m}', 'inlineKatex', '2 m', false],
		['中文$x$。', 'inlineKatex', 'x', false],
		['かな$x$！', 'inlineKatex', 'x', false],
		['한$x$?', 'inlineKatex', 'x', false]
	])('retains %s token content and display mode', (source, type, text, displayMode) => {
		expect(mathTokens(String(source))).toMatchObject([{ type, text, displayMode }]);
	});

	it.each(['$x', '$5.00', 'word$x$', '$x$word'])(
		'leaves nonmatching text %s outside math tokens',
		(source) => expect(mathTokens(source)).toEqual([])
	);

	it('keeps inline code, escaped dollars and adjacent independent formulas intact', () => {
		expect(mathTokens('`$x$` \\$x')).toEqual([]);
		expect(mathTokens('$x$ and $y$')).toMatchObject([{ text: 'x' }, { text: 'y' }]);
		expect(mathTokens('$$a \\$ b$$')).toMatchObject([{ text: 'a \\$ b', displayMode: true }]);
	});

	it('does not accept empty display math or a block closing away from a line boundary', () => {
		expect(tokenizeDisplayMath('$$  $$', 'inlineKatex')).toBeUndefined();
		expect(tokenizeDisplayMath('$$x', 'inlineKatex')).toBeUndefined();
		expect(tokenizeDisplayMath('$$x$$ word', 'blockKatex', true)).toBeUndefined();
		expect(tokenizeDisplayMath('$$x$$\r\nnext', 'blockKatex', true)).toMatchObject({
			raw: '$$x$$',
			text: 'x',
			displayMode: true
		});
	});

	it('keeps the existing fallback renderer result', () => {
		const marked = new Marked(mathExtension());
		expect(marked.parse('before $x$ after')).toBe('<p>before x after</p>\n');
	});
});
