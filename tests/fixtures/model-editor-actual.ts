import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { serialize, deserialize } from 'node:v8';

const script = readFileSync('src/lib/components/workspace/Models/ModelEditor.svelte', 'utf8')
	.split('<script lang="ts">')[1]
	.split('</script>')[0];
const source = ts.createSourceFile('model-editor.ts', script, ts.ScriptTarget.Latest, true);
const javascript = (code: string): string =>
	ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

/** Evaluate the actual reactive model projection instead of reproducing its metadata rules. */
export function installModelEditorProjection(context: object): void {
	const reactive = source.statements.find(
		(node) =>
			ts.isLabeledStatement(node) && node.statement.getText(source).startsWith('modelInfo =')
	);
	const reference = source.statements.find(
		(node) =>
			ts.isVariableStatement(node) &&
			node.declarationList.declarations.some(
				(entry) => entry.name.getText(source) === 'toModelKnowledgeReference'
			)
	);
	if (
		!reactive ||
		!ts.isLabeledStatement(reactive) ||
		!ts.isExpressionStatement(reactive.statement) ||
		!ts.isBinaryExpression(reactive.statement.expression) ||
		!reference
	)
		throw new Error('Actual model projection missing');
	Object.assign(context, {
		readOnly: false,
		historical: false,
		edit: false,
		configurationChanged: true,
		backgroundFile: null,
		avatarFile: null,
		animationFiles: {},
		commitMessage: '',
		allowNavigation: false,
		defaultMeta: {},
		voiceAvatar: null,
		voice: { voice: '' },
		structuredClone: (value: unknown) => deserialize(serialize(value)),
		clearBackgroundPreview: () => {},
		tick: async () => {},
		savedDraft: '',
		getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
		pruneEmptyLocaleEntries: (value: object) => value
	});
	const project = runInNewContext(
		javascript(
			`${reference.getText(source)}\n(() => (${reactive.statement.expression.right.getText(source)}))`
		),
		context
	) as () => unknown;
	Object.defineProperty(context, 'modelInfo', {
		configurable: true,
		enumerable: true,
		get: project
	});
}
