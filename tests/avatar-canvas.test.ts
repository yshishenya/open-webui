// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';

const source = ts.createSourceFile(
	'index.ts',
	readFileSync('src/lib/utils/index.ts', 'utf8'),
	ts.ScriptTarget.Latest
);
const helpers = source.statements
	.filter(ts.isVariableStatement)
	.flatMap((statement) => statement.declarationList.declarations)
	.filter((node) =>
		['canvasPixelTest', 'generateInitialsImage'].includes(node.name.getText(source))
	)
	.map((node) => `const ${node.getText(source)};`)
	.join('\n');

const probe = (contexts: boolean[], mismatch = false) => {
	let pixels: Uint8ClampedArray = new Uint8ClampedArray(4);
	const text: string[] = [];
	const context = {
		putImageData: (image: { data: Uint8ClampedArray }): void => {
			pixels = image.data;
		},
		getImageData: () => ({
			data: mismatch ? Uint8ClampedArray.from(pixels, (p) => p ^ 1) : pixels
		}),
		fillRect: (): void => {},
		fillText: (initials: string): void => {
			text.push(initials);
		}
	};
	const runtime = runInNewContext(
		ts.transpileModule(`${helpers}\n({canvasPixelTest, generateInitialsImage})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		{
			WEBUI_BASE_URL: '',
			console: { log: (): void => {} },
			ImageData: class {
				data = new Uint8ClampedArray(4);
			},
			document: {
				createElement: () => ({
					getContext: () => (contexts.shift() ? context : null),
					toDataURL: () => 'data:image/png;test'
				})
			}
		}
	) as {
		canvasPixelTest: () => boolean;
		generateInitialsImage: (name: string | null | undefined) => string;
	};
	return { ...runtime, text };
};

it('uses the default avatar when either drawing or pixel-test context is unavailable', () => {
	expect(probe([false]).canvasPixelTest()).toBe(false);
	for (const contexts of [[false], [true, false]]) {
		const result = probe(contexts);
		expect(result.generateInitialsImage('AIRIS User')).toBe('/user.png');
		expect(result.text).toEqual([]);
	}
});

it('preserves pixel mismatch fallback, normal initials and absent profile names', () => {
	expect(probe([true, true], true).generateInitialsImage('AIRIS User')).toBe('/user.png');
	for (const [name, initials] of [
		['  AIRIS User  ', 'AU'],
		['AIRIS', 'A'],
		['', ''],
		[null, ''],
		[undefined, '']
	] as const) {
		const result = probe([true, true]);
		expect(result.generateInitialsImage(name)).toBe('data:image/png;test');
		expect(result.text).toEqual([initials]);
	}
});
