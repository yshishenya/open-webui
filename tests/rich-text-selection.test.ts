// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { Extension, Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('actual selection plugin highlights a range only while the editor is blurred', () => {
	const source = readFileSync('src/lib/components/common/RichTextInput.svelte', 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing component script');
	const script = ts.createSourceFile(
		'editor.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest
	);
	const declaration = script.statements
		.filter(ts.isVariableStatement)
		.flatMap((statement) => [...statement.declarationList.declarations])
		.find((item) => item.name.getText(script) === 'SelectionDecoration');
	if (!declaration?.initializer) throw new Error('Missing selection plugin');
	const compiled = ts.transpileModule(
		`(${declaration.initializer.getText(script)})`,
		{}
	).outputText;
	const extension: Extension = new Function(
		'Extension',
		'Plugin',
		'PluginKey',
		'Decoration',
		'DecorationSet',
		`return ${compiled}`
	)(Extension, Plugin, PluginKey, Decoration, DecorationSet);
	const editor = new Editor({ extensions: [StarterKit, extension], content: '<p>plan</p>' });
	try {
		const plugin = editor.state.plugins.find((item) =>
			item.spec.props?.decorations?.toString().includes('editor-selection')
		);
		if (!plugin?.props.decorations) throw new Error('Missing installed selection plugin');
		expect(plugin.props.decorations.call(plugin, editor.state)).toBeNull();
		editor.commands.setTextSelection({ from: 1, to: 3 });
		editor.isFocused = true;
		expect(plugin.props.decorations.call(plugin, editor.state)).toBeNull();
		editor.isFocused = false;
		const decorations = plugin.props.decorations.call(plugin, editor.state) as DecorationSet;
		expect(decorations.find().map(({ from, to }) => ({ from, to }))).toEqual([{ from: 1, to: 3 }]);
	} finally {
		editor.destroy();
	}
});
