import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

it('does not start a frontend-update reload before dirty navigation is accepted', async () => {
	const source = readFileSync('src/routes/+layout.svelte', 'utf8');
	const script = parse(source).instance;
	if (!script) throw new Error('Root script missing');
	const ast = ts.createSourceFile(
		'root.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const hooks = ast.statements
		.filter(
			(statement) =>
				ts.isExpressionStatement(statement) &&
				ts.isCallExpression(statement.expression) &&
				['beforeNavigate', 'onNavigate'].includes(statement.expression.expression.getText(ast))
		)
		.map((statement) => statement.getText(ast))
		.join('\n');
	type Navigation = {
		from: { url: URL };
		to: { url: URL };
		willUnload: boolean;
		cancel: () => void;
	};
	type Callback = (navigation: Navigation) => unknown;
	const before: Callback[] = [];
	const accepted: Callback[] = [];
	const cleanup = vi.fn(async (): Promise<void> => {});
	const location = { href: 'http://localhost/billing/balance' };
	runInNewContext(hooks, {
		beforeNavigate: (callback: Callback): void => {
			before.push(callback);
		},
		onNavigate: (callback: Callback): void => {
			accepted.push(callback);
		},
		isPublicMarketingRoute: () => false,
		updated: { current: true },
		unregisterServiceWorkers: cleanup,
		location
	});
	const navigation: Navigation = {
		from: { url: new URL(location.href) },
		to: { url: new URL('http://localhost/billing/history') },
		willUnload: false,
		cancel: vi.fn()
	};
	for (const callback of before) await callback(navigation);
	navigation.cancel(); // A leaf form rejects departure after the root beforeNavigate callback.
	expect(cleanup).not.toHaveBeenCalled();
	expect(location.href).toBe(navigation.from.url.href);
	expect(accepted).toHaveLength(1);
	const committed = await accepted[0](navigation);
	expect(cleanup).toHaveBeenCalledOnce();
	expect(location.href).toBe(navigation.from.url.href);
	expect(committed).toBeTypeOf('function');
	(committed as () => void)(); // Router runs this only after the accepted DOM transition.
	expect(location.href).toBe(navigation.to.url.href);
});
