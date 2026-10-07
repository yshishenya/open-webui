// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { getCodeBlockContents } from '$lib/utils';

vi.mock('$lib/constants', () => ({ WEBUI_BASE_URL: '' }));

it('preserves the artifact extraction contract for grouped, inline and hidden code', () => {
	const fenced = (lang: string, code: string): string => '```' + lang + '\n' + code + '\n```';
	const result = getCodeBlockContents(
		[
			'<details type="reasoning">' + fenced('html', '<p>hidden</p>') + '</details>',
			fenced('html', '<p>one</p>'),
			fenced('css', 'p { color: red; }'),
			fenced('js', 'console.log(1);'),
			fenced('html', '<p>two</p>'),
			fenced('svg', '<svg></svg>')
		].join('\n')
	);
	expect(result.htmlGroups).toEqual([
		{ html: '<p>one</p>', css: 'p { color: red; }', js: 'console.log(1);' },
		{ html: '<p>two</p>', css: '', js: '' }
	]);
	expect(result.codeBlocks.map((block) => block.lang)).toEqual([
		'html',
		'css',
		'js',
		'html',
		'svg'
	]);
	expect(result.codeBlocks.at(-1)?.code.trim()).toBe('<svg></svg>');
	expect([result.html, result.css, result.js]).toEqual([
		'<p>one</p>\n\n<p>two</p>',
		'p { color: red; }',
		'console.log(1);'
	]);
	expect(
		getCodeBlockContents('<html><p>inline</p></html><style>p{}</style><script>1;</script>')
			.htmlGroups
	).toEqual([{ html: '<p>inline</p>', css: 'p{}', js: '1;' }]);
	expect(getCodeBlockContents('plain text')).toEqual({
		codeBlocks: [],
		html: '',
		css: '',
		js: '',
		htmlGroups: []
	});
});
