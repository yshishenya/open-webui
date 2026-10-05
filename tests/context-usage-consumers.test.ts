// @vitest-environment node
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';
import type { ContextUsage } from '../src/lib/utils/airis/frontend-contracts';

const chat = readFileSync('src/lib/components/chat/Chat.svelte', 'utf8');
const input = readFileSync('src/lib/components/chat/MessageInput.svelte', 'utf8');
function declaration(component: string, name: string): string {
	const script = component.split('<script lang="ts">')[1].split('</script>')[0];
	const source = ts.createSourceFile('consumer.ts', script, ts.ScriptTarget.Latest);
	const node = source.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => Array.from(statement.declarationList.declarations))
		.find((item) => item.name.getText(source) === name);
	if (!node) throw new Error(`Missing ${name}`);
	return `const ${node.getText(source)};`;
}
function javascript(source: string): string {
	return ts.transpileModule(source, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
}

it('preserves unknown limits, local estimates and known server usage without NaN', () => {
	const run = new Function(
		'threshold',
		'enabled',
		'serverContextUsage',
		javascript(`
		const history = { currentId: 'message' };
		const contextCompactionEnabled = enabled;
		const getContextThreshold = () => threshold;
		const $settings = { system: '' };
		const estimateTokens = () => 0;
		const estimateMessagesTokens = () => 12;
		const createMessagesList = () => [{usage: {input_tokens: 450, output_tokens: 50}}];
		${declaration(chat, 'getContextUsage')}
		${declaration(input, 'getLocalContextUsage')}
		return [getContextUsage(), getLocalContextUsage()];
		`)
	) as (
		threshold: number | null,
		enabled: boolean,
		server: ContextUsage | null
	) => [ContextUsage, ContextUsage];
	for (const threshold of [null, 0, -1, 1000]) {
		const [main, local] = run(threshold, true, null);
		expect(main.tokens).toBe(512);
		expect(main.percent).toBe(threshold === 1000 ? 51 : null);
		expect(local).toEqual({
			tokens: 512,
			estimated_tokens: 512,
			threshold: null,
			percent: null,
			source: 'estimated'
		});
	}
	const server: ContextUsage = {
		tokens: 500,
		estimated_tokens: 500,
		threshold: 1000,
		percent: 50,
		source: 'estimated'
	};
	expect(run(null, true, server)[0].percent).toBe(51);
	expect(run(1000, false, server)[0].percent).toBeNull();
});

it('renders token counts for unknown limits and clamps the status bar for known limits', () => {
	const source = ts.createSourceFile(
		'status.ts',
		input.split('<script lang="ts">')[1].split('</script>')[0],
		ts.ScriptTarget.Latest
	);
	const status = source.statements
		.filter(ts.isLabeledStatement)
		.filter((node) => /context|statusContextUsage/.test(node.statement.getText(source)))
		.map((node) => node.statement.getText(source));
	// Use only the actual seven dependent status expressions, not unrelated reactive blocks.
	const names = [
		'statusContextUsage',
		'contextHasThreshold',
		'contextPercent',
		'contextTokens',
		'contextValue',
		'contextBarPercent'
	];
	const expressions = status.filter((code) => names.some((name) => code.startsWith(`${name} =`)));
	expect(expressions).toHaveLength(6);
	const run = new Function(
		'contextUsage',
		`let ${names.join(',')};
		const getLocalContextUsage = () => null;
		const formatTokenCount = (value) => String(value);
		const $i18n = {t: (key) => key};
		${expressions.join('\n')}
		return {label: contextValue, bar: contextBarPercent};`
	) as (usage: ContextUsage | null) => { label: string; bar: number };
	const usage = (threshold: number | null, percent: number | null): ContextUsage => ({
		tokens: 500,
		estimated_tokens: 500,
		threshold,
		percent,
		source: 'estimated'
	});
	expect(run(null)).toEqual({ label: 'unknown', bar: 0 });
	for (const limit of [null, 0, -1]) {
		expect(run(usage(limit, null))).toEqual({ label: '500 tokens', bar: 0 });
	}
	expect(run(usage(1000, 50))).toEqual({ label: '50% 500/1000', bar: 50 });
	expect(run(usage(1000, 150))).toEqual({ label: '150% 500/1000', bar: 100 });
	expect(run(usage(1000, null))).toEqual({ label: '0% 500/1000', bar: 0 });
});
