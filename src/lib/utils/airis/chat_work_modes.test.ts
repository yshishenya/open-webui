// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

it('switches Work to Chat, disables direct execution, and keeps Work selected on repeat', async () => {
	const source = readFileSync('src/lib/components/chat/MessageInput/TerminalMenu.svelte', 'utf8');
	const script = parse(source).instance;
	if (!script) throw new Error('Missing selector script');
	const parsed = ts.createSourceFile(
		'selector.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const body = parsed.statements
		.filter(
			(statement) =>
				ts.isVariableStatement(statement) &&
				statement.declarationList.declarations.some((declaration) =>
					['selectSystem', 'refreshTerminalServersStore'].includes(declaration.name.getText(parsed))
				)
		)
		.map((statement) => statement.getText(parsed))
		.join('\n');
	const context = {
		$selectedTerminalId: 'direct',
		window: { matchMedia: () => ({ matches: true }) },
		showControls: { set: vi.fn() },
		$settings: { terminalServers: [{ url: 'https://fixture.invalid', enabled: true }] },
		$terminalServers: [{ id: 'personal', name: 'Work' }, { url: 'https://fixture.invalid' }],
		selectedTerminalId: { set: vi.fn() },
		settings: { set: vi.fn() },
		terminalServers: { set: vi.fn() },
		getToolServersData: vi.fn(),
		show: true
	};
	const select = runInNewContext(
		ts.transpile(`${body}\nselectSystem`, { target: ts.ScriptTarget.ES2022 }),
		context
	) as (terminal: { id: string } | null) => Promise<void>;
	await select(null);
	expect(context.selectedTerminalId.set).toHaveBeenLastCalledWith(null);
	expect(context.settings.set).toHaveBeenLastCalledWith({
		terminalServers: [{ url: 'https://fixture.invalid', enabled: false }]
	});
	expect(context.terminalServers.set).toHaveBeenLastCalledWith([{ id: 'personal', name: 'Work' }]);
	expect(context.getToolServersData).not.toHaveBeenCalled();
	expect(context.show).toBe(false);
	context.$settings.terminalServers = [];
	context.$selectedTerminalId = 'personal';
	await select({ id: 'personal' });
	expect(context.selectedTerminalId.set).toHaveBeenLastCalledWith('personal');
});
