// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';

const component = readFileSync('src/lib/components/chat/MessageInput.svelte', 'utf8');
const script = component.split('<script lang="ts">')[1].split('</script>')[0];
const source = ts.createSourceFile('MessageInput.ts', script, ts.ScriptTarget.Latest);
const statement = source.statements.find(
	(node) =>
		ts.isLabeledStatement(node) && node.statement.getText(source).startsWith('toggleFilters =')
);
if (
	!statement ||
	!ts.isLabeledStatement(statement) ||
	!ts.isExpressionStatement(statement.statement)
) {
	throw new Error('Missing actual reactive filter selection');
}
const assignment = statement.statement.expression;
if (!ts.isBinaryExpression(assignment)) throw new Error('Expected filter assignment');
const expression = assignment.right.getText(source);
const filters = [{ id: 'first' }, { id: 'shared' }];
const models = [
	{ id: 'a', filters },
	{ id: 'b', filters: [{ id: 'shared' }, { id: 'last' }] },
	{ id: 'empty' }
];

const select = (ids: string[], atId?: string): unknown =>
	runInNewContext(expression, {
		selectedModels: ids,
		atSelectedModel: atId === undefined ? undefined : { id: atId },
		$models: models
	});

it('handles no selected models and preserves filter intersection and mention priority', () => {
	for (const ids of [[], [''], ['unknown'], ['empty'], ['a', 'empty'], ['a', 'unknown']]) {
		expect(select(ids)).toEqual([]);
	}
	expect(select([], '')).toEqual([]);
	expect(select(['a'])).toEqual(filters);
	expect(select(['a', 'b'])).toEqual([{ id: 'shared' }]);
	expect(select(['b', 'a'])).toEqual([{ id: 'shared' }]);
	expect(select([], 'a')).toEqual(filters);
	expect(select(['b'], 'a')).toEqual(filters);
	expect(select(['a'], '')).toEqual(filters);
	expect(select(['a'], 'unknown')).toEqual([]);
	expect(models[0].filters).toEqual(filters);
});
