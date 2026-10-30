// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Keep the real loader, catalogues and i18next; delay only the catalogue response.
vi.mock('i18next-resources-to-backend', async (importOriginal) => {
	const original = await importOriginal<typeof import('i18next-resources-to-backend')>();
	return {
		default: (load: (language: string) => Promise<Record<string, string>>) =>
			original.default(async (language: string) => {
				await new Promise<void>((resolve) => setTimeout(resolve, 100));
				return load(language);
			})
	};
});

type InitI18n = typeof import('../src/lib/i18n').initI18n;

function startupStatements(): [string, string] {
	const source = readFileSync('src/routes/+layout.svelte', 'utf8');
	const start = source.indexOf('<script');
	const end = source.indexOf('</script>', start);
	if (start < 0 || end < 0) throw new Error('Root layout script was not found');
	const script = source.slice(source.indexOf('>', start) + 1, end);
	const ast = ts.createSourceFile('layout.ts', script, ts.ScriptTarget.Latest, true);
	const statements: string[] = [];
	const visit = (node: ts.Node): void => {
		if (ts.isExpressionStatement(node)) {
			const call = ts.isAwaitExpression(node.expression)
				? node.expression.expression
				: node.expression;
			if (ts.isCallExpression(call) && call.expression.getText(ast) === 'initI18n') {
				statements.push(node.getText(ast));
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(ast);
	if (statements.length !== 2) throw new Error('Expected the two root layout initializations');
	return [statements[0], statements[1]];
}

async function startLayout(removeInitialAwait = false): Promise<typeof import('i18next').default> {
	const { initI18n } = await import('../src/lib/i18n');
	const { default: i18next } = await import('i18next');
	const [initial, configured] = startupStatements();
	const run = new Function(
		'initI18n',
		'localStorage',
		'backendConfig',
		`return (async () => {
			${removeInitialAwait ? initial.replace(/^await\s+/, '') : initial}
			await new Promise((resolve) => setTimeout(resolve, 5));
			${configured}
		})();`
	) as (init: InitI18n, storage: Storage, config: { default_locale: string }) => Promise<void>;
	await run(initI18n, localStorage, { default_locale: '' });
	// In the negative control, let the original, now detached store finish loading too.
	await new Promise<void>((resolve) => setTimeout(resolve, 150));
	return i18next;
}

beforeEach((): void => {
	vi.resetModules();
	vi.doMock('i18next', async () => {
		const original = await vi.importActual<typeof import('i18next')>('i18next');
		return { ...original, default: original.default.createInstance() };
	});
	localStorage.clear();
	localStorage.setItem('locale', 'ru-RU');
});

afterEach((): void => {
	localStorage.clear();
});

it('retains the selected Russian catalogue when backend config arrives before translations', async () => {
	const i18next = await startLayout();
	expect(i18next.language).toBe('ru-RU');
	expect(localStorage.getItem('locale')).toBe('ru-RU');
	expect(i18next.t('Money')).toBe('Деньги');
	expect(i18next.t('Top-ups and refunds by day')).toBe('Пополнения и возвраты по дням');
});

it('reproduces the empty catalogue if the initial startup wait is removed', async () => {
	const i18next = await startLayout(true);
	expect(i18next.language).toBe('ru-RU');
	expect(i18next.t('Money')).toBe('Money');
	expect(i18next.t('Top-ups and refunds by day')).toBe('Top-ups and refunds by day');
});
