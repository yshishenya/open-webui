import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = process.env.AIRIS_TEST_ARTIFACT_ROOT ?? '.';
const source = readFileSync(join(root, 'src/lib/components/chat/Navbar.svelte'), 'utf8');
const instance = parse(source).instance;
if (!instance) throw new Error('Missing Navbar script');
const script = ts.createSourceFile(
	'navbar.ts',
	source.slice(instance.content.start, instance.content.end),
	ts.ScriptTarget.Latest,
	true
);
const declaration = script.statements
	.filter(ts.isVariableStatement)
	.flatMap((statement) => [...statement.declarationList.declarations])
	.find((node) => node.name.getText(script) === 'getDismissedBannerIds');
if (!declaration) throw new Error('Missing persisted banner reader');

it('keeps only string banner IDs and tolerates invalid or unavailable persisted state', () => {
	for (const [value, expected] of [
		[null, []],
		['[]', []],
		['["first","second"]', ['first', 'second']],
		['["first",null,2,{},"second"]', ['first', 'second']],
		['null', []],
		['{}', []],
		['2', []],
		['"first"', []],
		['[', []]
	] as const) {
		const read = runInNewContext(
			ts.transpileModule(`const ${declaration.getText(script)}; getDismissedBannerIds;`, {})
				.outputText,
			{ localStorage: { getItem: () => value } }
		) as () => string[];
		expect(read()).toEqual(expected);
		expect(() => [...read()]).not.toThrow();
	}
	const read = runInNewContext(
		ts.transpileModule(`const ${declaration.getText(script)}; getDismissedBannerIds;`, {})
			.outputText,
		{
			localStorage: {
				getItem: (): never => {
					throw new Error('Storage denied');
				}
			}
		}
	) as () => string[];
	expect(read()).toEqual([]);
});

it('preserves the one-shot null opt-out and normal temporary-mode initialization', async () => {
	const chat = readFileSync(join(root, 'src/lib/components/chat/Chat.svelte'), 'utf8');
	const start = chat.indexOf(
		"if ($user?.role !== 'admin' && $user?.permissions?.chat?.temporary_enforced)",
		chat.indexOf('const initNewChat')
	);
	const end = chat.indexOf('const availableModels', start);
	if (start < 0 || end < start) throw new Error('Missing temporary initialization');
	for (const [initial, defaultEnabled, expected] of [
		[null, true, false],
		[false, true, true],
		[true, true, true],
		[false, false, false],
		[true, false, true]
	] as const) {
		const context = {
			$page: { url: new URL('https://chat.test/') },
			$user: { role: 'user', permissions: { chat: { temporary: true } } },
			$settings: { temporaryChatByDefault: defaultEnabled },
			$temporaryChatEnabled: initial as boolean | null,
			temporaryChatEnabled: {
				set: (value: boolean | null): void => {
					context.$temporaryChatEnabled = value;
				}
			}
		};
		await runInNewContext(`(async () => {${chat.slice(start, end)}})()`, context);
		expect(context.$temporaryChatEnabled).toBe(expected);
	}
});

it('closes a dismissible banner for the session when persisting it is denied', () => {
	const start = source.indexOf('on:dismiss={') + 'on:dismiss={'.length;
	const end = source.indexOf('}}', start);
	if (start < 'on:dismiss={'.length || end < start) throw new Error('Missing dismiss handler');
	const dismiss = source.slice(start, end + 1);
	const invoke = runInNewContext(
		ts.transpileModule(
			`let closedBannerIds=[];const dismiss=${dismiss};({dismiss,closed:()=>closedBannerIds});`,
			{}
		).outputText,
		{
			banner: { dismissible: true },
			$banners: [{ id: 'welcome' }],
			getDismissedBannerIds: (): string[] => [],
			console: { warn: (): void => {} },
			localStorage: {
				setItem: (): never => {
					throw new Error('Storage denied');
				}
			}
		}
	) as { dismiss: (event: { detail: string }) => void; closed: () => string[] };
	expect(() => invoke.dismiss({ detail: 'welcome' })).not.toThrow();
	expect(invoke.closed()).toEqual(['welcome']);
});
