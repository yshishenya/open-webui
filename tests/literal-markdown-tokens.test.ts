import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const file = 'src/lib/utils/index.ts';
const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
const names = ['replaceOutsideCode', 'replaceTokens'];
const helpers = source.statements
	.filter((node) => ts.isVariableStatement(node))
	.filter((node) =>
		node.declarationList.declarations.some((d) => names.includes(d.name.getText(source)))
	)
	.map((node) => node.getText(source).replace(/^export /, ''))
	.join('\n');
const replaceTokens = runInNewContext(
	ts.transpileModule(`${helpers}\nreplaceTokens`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText,
	{ WEBUI_BASE_URL: 'https://example.test' }
) as (content: string, model?: string | null, user?: string | null) => string;

describe('actual Markdown name and file token helper', () => {
	it.each(['$&', '$`', "$'", '$$', '$1', 'Ян $& Петров', "A $` B $' C $$"])(
		'renders name %s literally',
		(name) => {
			expect(replaceTokens('before {{char}} / {{user}} after', name, name)).toBe(
				`before ${name} / ${name} after`
			);
		}
	);

	it('preserves case-insensitive repeated names and empty replacements', () => {
		expect(replaceTokens('{{CHAR}} {{char}} {{USER}} {{user}}', 'Luna', '')).toBe('Luna Luna  ');
	});

	it('leaves unavailable names unchanged', () => {
		expect(replaceTokens('{{char}} {{user}}', null, undefined)).toBe('{{char}} {{user}}');
	});

	it('does not interpret tokens introduced by a name as response tokens', () => {
		expect(replaceTokens('{{char}} / {{user}}', '{{user}}', 'Ян')).toBe('{{user}} / Ян');
		expect(replaceTokens('{{char}} / {{user}}', '{{HTML_FILE_ID_ab-12}}', 'Ян')).toBe(
			'{{HTML_FILE_ID_ab-12}} / Ян'
		);
	});

	it('keeps names and file tokens inside inline and fenced code unchanged', () => {
		const code = '`{{char}} {{user}}`\n```txt\n{{user}} {{VIDEO_FILE_ID_ab-12}}\n```';
		expect(replaceTokens(code, '$&', '$`')).toBe(code);
	});

	it('keeps existing media callbacks and rejects malformed file ids', () => {
		expect(
			replaceTokens('{{VIDEO_FILE_ID_ab-12}} {{HTML_FILE_ID_AB-12}} {{HTML_FILE_ID_../bad}}')
		).toBe(
			'<video src="https://example.test/api/v1/files/ab-12/content" controls></video> <file type="html" id="AB-12" /> {{HTML_FILE_ID_../bad}}'
		);
	});

	it('leaves content without tokens unchanged', () => {
		expect(replaceTokens('Простой ответ $&', '$&', '$`')).toBe('Простой ответ $&');
	});
});
