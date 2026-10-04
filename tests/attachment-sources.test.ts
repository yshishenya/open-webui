import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';

const base = '/api/v1';
const helperPath = 'src/lib/utils/airis/attachment_source.ts';
const helperExports: Record<string, unknown> = {};
if (existsSync(helperPath)) {
	runInNewContext(
		ts.transpileModule(readFileSync(helperPath, 'utf8'), {
			compilerOptions: { module: ts.ModuleKind.CommonJS }
		}).outputText,
		{ exports: helperExports, require: () => ({ WEBUI_API_BASE_URL: base }) }
	);
}

const consumers = [
	'chat/MessageInput',
	'channel/MessageInput',
	'channel/Messages/Message',
	'chat/Messages/UserMessage'
].flatMap((name) => {
	const source = readFileSync(`src/lib/components/${name}.svelte`, 'utf8');
	return [...source.matchAll(/\{@const fileUrl =([\s\S]*?)\}\s*<div/g)].map((match, index) => ({
		name: `${name}:${index}`,
		expression: match[1]
	}));
});

it('covers all five actual input, saved view/edit and channel expressions', () => {
	expect(consumers).toHaveLength(5);
});

it.each(consumers)(
	'resolves actual consumer $name without losing valid sources',
	({ expression }) => {
		const cases = [
			{ file: {}, expected: '' },
			{ file: { url: null }, expected: '' },
			{ file: { url: '', id: null }, expected: '' },
			{ file: { type: 'file', name: 'plan.txt' }, expected: '' },
			{ file: { url: null, id: 'image-id' }, expected: `${base}/files/image-id/content` },
			{
				file: { url: '', id: 'video-id', content_type: 'video/mp4' },
				expected: `${base}/files/video-id/content`
			},
			{ file: { url: 'legacy-id' }, expected: `${base}/files/legacy-id` },
			{
				file: { url: 'uploaded-id', content_type: 'image/png' },
				expected: `${base}/files/uploaded-id/content`
			},
			{ file: { url: 'data:image/png;base64,abc' }, expected: 'data:image/png;base64,abc' },
			{ file: { url: 'https://example.com/a.png' }, expected: 'https://example.com/a.png' }
		];
		for (const { file, expected } of cases) {
			const before = structuredClone(file);
			expect(
				runInNewContext(expression.trim(), {
					file,
					WEBUI_API_BASE_URL: base,
					...helperExports
				})
			).toBe(expected);
			expect(file).toEqual(before);
		}
	}
);

it('retains the exact native modal predicate for omitted and supported types', () => {
	const source = readFileSync('src/lib/components/chat/MessageInput.svelte', 'utf8');
	const expression = source.match(/modal=\{([^\n]+)\}/)?.[1];
	if (!expression) throw new Error('Missing actual modal predicate');
	for (const type of [undefined, 'image', 'web', 'file', 'collection']) {
		expect(runInNewContext(expression, { file: { type } })).toBe(
			type === 'file' || type === 'collection'
		);
	}
});
