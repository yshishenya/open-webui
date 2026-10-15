// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { resetVectorDB } from '$lib/apis/retrieval';
vi.mock('$lib/constants', () => ({ RETRIEVAL_API_BASE_URL: '/retrieval' }));
afterEach(() => {
	vi.unstubAllGlobals();
});

function resetHandler() {
	const source = readFileSync('src/lib/components/admin/Settings/Documents.svelte', 'utf8');
	const tree = parse(source, { modern: true });
	const component = tree.fragment.nodes.find(
		(n) => n.type === 'Component' && n.name === 'ResetVectorDBConfirmDialog'
	);
	if (!component || component.type !== 'Component') throw Error('Reset dialog missing');
	const handler = component.attributes.find(
		(a) => a.type === 'OnDirective' && a.name === 'confirm'
	);
	if (!handler || handler.type !== 'OnDirective' || !handler.expression)
		throw Error('Reset handler missing');
	const expression = handler.expression;
	if (
		!('start' in expression) ||
		typeof expression.start !== 'number' ||
		!('end' in expression) ||
		typeof expression.end !== 'number'
	)
		throw Error('Reset handler positions missing');
	const context = {
		localStorage: { token: 'fixture' },
		resetVectorDB: vi.fn(),
		toast: { success: vi.fn(), error: vi.fn() },
		$i18n: { t: (s: string) => s }
	};
	const run = runInNewContext(
		'(' +
			ts
				.transpileModule(source.slice(expression.start, expression.end), {
					compilerOptions: { target: ts.ScriptTarget.ES2022 }
				})
				.outputText.trim()
				.replace(/;$/, '') +
			')',
		context
	) as () => Promise<void>;
	return { context, run };
}
it('waits for reset confirmation before reporting success', async () => {
	const { context: c, run } = resetHandler();
	let finish!: (r: boolean) => void;
	c.resetVectorDB.mockImplementation(
		() =>
			new Promise<boolean>((resolve) => {
				finish = resolve;
			})
	);
	const pending = run();
	expect(c.resetVectorDB).toHaveBeenCalledOnce();
	expect(c.toast.success).not.toHaveBeenCalled();
	finish(true);
	await pending;
	expect(c.toast.success).toHaveBeenCalledOnce();
	expect(c.toast.error).not.toHaveBeenCalled();
});
it('a reset refusal reports error without success or an automatic retry', async () => {
	const { context: c, run } = resetHandler();
	c.resetVectorDB.mockRejectedValue(Error('Refused'));
	await run();
	expect(c.resetVectorDB).toHaveBeenCalledOnce();
	expect(c.toast.error).toHaveBeenCalledOnce();
	expect(c.toast.success).not.toHaveBeenCalled();
});
it.each([200, 204])('accepts the bodyless successful reset response (%s)', async (status) => {
	const fetch = vi.fn(async () => new Response(status === 200 ? 'null' : null, { status }));
	vi.stubGlobal('fetch', fetch);
	await expect(resetVectorDB('fixture')).resolves.toBe(true);
	expect(fetch).toHaveBeenCalledOnce();
	expect(fetch.mock.calls[0]).toBeDefined();
});
it.each(['http', 'network', 'read'])(
	'reset rejects %s refusal without repeating its POST',
	async (mode) => {
		const fetch = vi.fn(async () => {
			if (mode === 'network') throw Error('Offline');
			if (mode === 'read')
				return new Response(
					new ReadableStream({
						start(c) {
							c.error(Error('Read failed'));
						}
					})
				);
			return new Response('{"detail":"Refused"}', { status: 403 });
		});
		vi.stubGlobal('fetch', fetch);
		await expect(resetVectorDB('fixture')).rejects.toThrow();
		expect(fetch).toHaveBeenCalledOnce();
	}
);
function bannerHandlers() {
	const source = readFileSync('src/lib/components/admin/Settings/Interface/Banners.svelte', 'utf8');
	const instance = parse(source).instance!;
	const tree = ts.createSourceFile(
		'banners.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest
	);
	const declarations = tree.statements.flatMap((s) =>
		ts.isVariableStatement(s)
			? s.declarationList.declarations
					.filter((d) => ['init', 'positionChangeHandler'].includes(d.name.getText(tree)))
					.map((d) => 'const ' + d.getText(tree) + ';')
			: []
	);
	const destroy = tree.statements
		.filter(
			(s) =>
				ts.isExpressionStatement(s) &&
				ts.isCallExpression(s.expression) &&
				s.expression.expression.getText(tree) === 'onDestroy'
		)
		.map((s) => s.getText(tree));
	const destroyInstance = vi.fn();
	let destroyHook: (() => void) | undefined;
	const Sortable = vi.fn(function () {
		return { destroy: destroyInstance };
	});
	const context = {
		sortable: null,
		Sortable,
		bannerListElement: { children: [{ id: 'banner-item-b' }, { id: 'banner-item-a' }] },
		banners: [{ id: 'a' }, { id: 'b' }],
		onDestroy: (hook: () => void) => {
			destroyHook = hook;
		}
	};
	const init = runInNewContext(
		ts.transpileModule(declarations.concat(destroy).join('\n') + '\ninit;', {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	) as () => void;
	return { context, init, destroy: () => destroyHook?.(), destroyInstance };
}
it('releases the banner sorter when the component is destroyed', () => {
	const { init, destroy, destroyInstance } = bannerHandlers();
	init();
	destroy();
	expect(destroyInstance).toHaveBeenCalledOnce();
});
it('releases the previous sorter before replacing it', () => {
	const { init, destroyInstance } = bannerHandlers();
	init();
	init();
	expect(destroyInstance).toHaveBeenCalledOnce();
});
