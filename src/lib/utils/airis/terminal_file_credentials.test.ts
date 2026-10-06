import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it } from 'vitest';

type Server = { id?: string; url: string };
type Direct = { url: string; key?: string };
const direct = { url: 'https://direct.example.test', key: 'direct-fixture-key' };
const system = { id: 'system-fixture', url: '/api/v1/terminals/system-fixture' };

const resolve = async (
	stored: Server[],
	configured: Direct[],
	selected: string | null
): Promise<{ url: string; key: string } | null> => {
	const source = await readFile('src/lib/components/chat/FileNav.svelte', 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('FileNav script missing');
	const script = source.slice(instance.content.start, instance.content.end);
	const parsed = ts.createSourceFile('FileNav.ts', script, ts.ScriptTarget.Latest, true);
	const declaration = parsed.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => [...statement.declarationList.declarations])
		.find((node) => ts.isIdentifier(node.name) && node.name.text === 'getTerminal');
	if (!declaration?.initializer) throw new Error('FileNav resolver missing');
	const code = ts.transpileModule(`(${declaration.initializer.getText(parsed)})`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
	const handler = runInNewContext(code, {
		$terminalServers: stored,
		$settings: { terminalServers: configured },
		$selectedTerminalId: selected,
		localStorage: { token: 'airis-fixture-session' }
	}) as () => { url: string; key: string } | null;
	return handler();
};

it.each([null, direct.url])(
	'direct files use configured key with selection=%s',
	async (selected) => {
		expect(await resolve([direct, system], [direct], selected)).toEqual(direct);
	}
);

it('default direct without a key never falls back to the AIRIS session', async () => {
	expect(await resolve([direct, system], [{ url: direct.url }], null)).toEqual({
		url: direct.url,
		key: ''
	});
});

it('a stale default direct entry without matching settings yields no connection', async () => {
	expect(await resolve([direct, system], [], null)).toBeNull();
});

it.each([null, system.id])('system files keep session key with selection=%s', async (selected) => {
	expect(await resolve([system, direct], [direct], selected)).toEqual({
		url: system.url,
		key: 'airis-fixture-session'
	});
});

it.each([null, 'missing-fixture'])(
	'absent or stale selection=%s yields no connection',
	async (selected) => {
		expect(await resolve([], [], selected)).toBeNull();
	}
);
