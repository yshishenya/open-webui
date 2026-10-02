// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';

const path = 'src/lib/utils/index.ts';
const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest);
const initializers = new Map(
	source.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) =>
			statement.declarationList.declarations.map(
				(declaration) =>
					[declaration.name.getText(source), declaration.initializer?.getText(source)] as const
			)
		)
);
const code = `const MONTH_NAMES = ${initializers.get('MONTH_NAMES')}; (${initializers.get('getTimeRange')})`;
const javascript = ts.transpileModule(code, {
	compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
const local = (year: number, month: number, day: number, hour = 12): number =>
	new Date(year, month - 1, day, hour).getTime() / 1000;

afterEach(() => {
	vi.useRealTimers();
});

it.each<[string, number, number | null | undefined, string]>([
	['month boundary', local(2026, 10, 1), local(2026, 9, 30), 'Yesterday'],
	['year boundary', local(2026, 1, 1), local(2025, 12, 31), 'Yesterday'],
	['leap day', local(2024, 3, 1), local(2024, 2, 29), 'Yesterday'],
	['DST spring', local(2026, 3, 9, 0), local(2026, 3, 8, 0), 'Yesterday'],
	['DST fall', local(2026, 11, 2, 0), local(2026, 11, 1, 0), 'Yesterday'],
	['missing null', local(2026, 10, 2), null, 'Unknown'],
	['missing undefined', local(2026, 10, 2), undefined, 'Unknown'],
	['invalid number', local(2026, 10, 2), NaN, 'Unknown'],
	['infinite number', local(2026, 10, 2), Infinity, 'Unknown'],
	['unrepresentable date', local(2026, 10, 2), 1e20, 'Unknown'],
	['epoch remains valid', local(2026, 10, 2), 0, new Date(0).getFullYear().toString()],
	['today', local(2026, 10, 2), local(2026, 10, 2, 0), 'Today'],
	['exact seven days', local(2026, 10, 2), local(2026, 9, 25), 'Previous 7 days'],
	['exact thirty days', local(2026, 10, 2), local(2026, 9, 2), 'Previous 30 days'],
	['older month', local(2026, 10, 2), local(2026, 8, 1), 'August'],
	['older year', local(2026, 10, 2), local(2025, 8, 1), '2025'],
	['future same year', local(2026, 10, 2), local(2026, 11, 2), 'November'],
	['future next year', local(2026, 10, 2), local(2027, 1, 2), '2027']
])('%s', (_name, now, timestamp, expected) => {
	vi.useFakeTimers();
	vi.setSystemTime(now * 1000);
	const classify = runInNewContext(javascript, { Date, Number }) as (
		timestamp: number | null | undefined
	) => string;
	expect(classify(timestamp)).toBe(expected);
});
