// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Fragment, Slice, Schema, DOMParser, DOMSerializer } from 'prosemirror-model';
import { EditorState, TextSelection, Selection, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { equalEditorJSON } from '../src/lib/utils/editorJson';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';

const path = 'src/lib/components/common/RichTextInput.svelte';
const source = ts.createSourceFile(
	path,
	readFileSync(path, 'utf8').split('<script lang="ts">')[1].split('</script>')[0],
	ts.ScriptTarget.Latest
);
const messageInputPath = 'src/lib/components/chat/MessageInput.svelte';
const messageInputSource = ts.createSourceFile(
	messageInputPath,
	readFileSync(messageInputPath, 'utf8').split('<script lang="ts">')[1].split('</script>')[0],
	ts.ScriptTarget.Latest
);
const definition = (name: string, inputSource = source, includeProperties = true): string => {
	let result = '';
	const visit = (node: ts.Node): void => {
		if (ts.isFunctionDeclaration(node) && node.name?.text === name)
			result = node.getText(inputSource);
		if (
			ts.isVariableDeclaration(node) &&
			node.name.getText(inputSource) === name &&
			node.initializer
		)
			result = `const ${name} = ${node.initializer.getText(inputSource)};`;
		if (
			includeProperties &&
			ts.isPropertyAssignment(node) &&
			node.name.getText(inputSource) === name
		)
			result = `const ${name} = ${node.initializer.getText(inputSource)};`;
		ts.forEachChild(node, visit);
	};
	visit(inputSource);
	if (!result) throw new Error(`Missing ${name}`);
	return result;
};
const schema = new Schema({
	nodes: {
		doc: { content: 'block+' },
		paragraph: {
			content: 'inline*',
			group: 'block',
			parseDOM: [{ tag: 'p' }],
			toDOM: () => ['p', 0]
		},
		text: { group: 'inline' },
		hardBreak: {
			inline: true,
			group: 'inline',
			selectable: false,
			parseDOM: [{ tag: 'br' }],
			toDOM: () => ['br']
		}
	},
	marks: { bold: { parseDOM: [{ tag: 'strong' }], toDOM: () => ['strong', 0] } }
});

const setup = (text: string, from: number, to = from, rich = false) => {
	let state = EditorState.create({
		schema,
		doc: schema.node('doc', null, [schema.node('paragraph', null, text ? schema.text(text) : [])])
	});
	state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
	const dispatch = vi.fn((tr: Transaction): void => {
		state = state.apply(tr);
	});
	const view = {
		focus: vi.fn(),
		get state() {
			return state;
		},
		dispatch
	};
	const editor = {
		view,
		get state() {
			return state;
		},
		isDestroyed: false,
		commands: { focus: vi.fn(), setContent: vi.fn() }
	};
	const context = {
		editor: editor as typeof editor | null,
		value: text,
		richText: rich,
		autoFormat: true,
		suppressAutoFocus: false,
		insertPromptAsRichText: rich,
		$settings: { insertPromptAsRichText: rich },
		textVariableHandler: async (text: string): Promise<string> => text,
		inputVariableHandler: vi.fn().mockResolvedValue(undefined),
		focus: vi.fn(),
		largeTextAsFile: false,
		PASTED_TEXT_CHARACTER_LIMIT: 10000,
		navigator: { userAgent: 'desktop' },
		window: {},
		document,
		Fragment,
		Slice,
		DOMParser,
		DOMSerializer,
		TextSelection,
		Selection,
		DOMPurify,
		marked,
		tick: vi.fn().mockResolvedValue(undefined),
		setTimeout,
		selectNextTemplate: vi.fn().mockReturnValue(false),
		eventDispatch: vi.fn()
	};
	const evaluate = <T>(name: string): T =>
		runInNewContext(
			ts.transpileModule(
				`(() => { ${definition('getWordBoundsAtPos')} ${definition('textToNodes')} ${definition('plainMentionPaste')} ${definition(name, name === 'replaceSlashRangeWithPrompt' ? messageInputSource : source)}; return ${name === 'handlePaste' ? '(view, event, slice = Slice.empty) => handlePaste(view, event, slice)' : name}; })()`,
				{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
			).outputText,
			context
		) as T;
	return {
		context,
		editor,
		view,
		evaluate,
		text: (): string => state.doc.textBetween(0, state.doc.content.size, '\n', '\n')
	};
};
const clipboard = (text: string) => ({
	preventDefault: vi.fn(),
	clipboardData: {
		getData: (type: string): string => (type === 'text/plain' ? text : '<b>HTML</b>'),
		files: [],
		items: []
	}
});
afterEach(() => {
	vi.useRealTimers();
});

it.each(['one', 'one\ntwo', '\none', 'one\n', '\n\n', 'one\n\ntwo', '🌍 привет', 'one\r\ntwo', ''])(
	'plain paste preserves selection surroundings and exact text: %j',
	(text) => {
		const fixture = setup('left SELECT right', 6, 12);
		const event = clipboard(text);
		const paste =
			fixture.evaluate<(view: typeof fixture.view, event: ReturnType<typeof clipboard>) => boolean>(
				'handlePaste'
			);
		expect(paste(fixture.view, event)).toBe(true);
		expect(fixture.text()).toBe(`left ${text.replace(/\r\n/g, '\n')} right`);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(fixture.view.state.selection.from).toBe(6 + text.replace(/\r\n/g, '\n').length);
	}
);

it.each(['one', 'one\ntwo', '\none', 'one\n', '\n\n', 'one\n\ntwo', '🌍 привет', ''])(
	'command replacement preserves text and cursor: %j',
	async (text) => {
		const fixture = setup('left /cmd right', 10);
		await fixture.evaluate<(text: string) => Promise<void>>('replaceCommandWithText')(text);
		expect(fixture.text()).toBe(`left ${text} right`);
		expect(fixture.view.state.selection.from).toBe(6 + text.length);
		expect(fixture.view.focus).toHaveBeenCalledOnce();
	}
);

it.each(['one', '\none\n', ''])('command at document end accepts %j', async (text) => {
	const fixture = setup('/cmd', 5);
	await fixture.evaluate<(text: string) => Promise<void>>('replaceCommandWithText')(text);
	expect(fixture.text()).toBe(text);
	expect(fixture.view.state.selection.from).toBe(1 + text.length);
});

it.each(['destroyed', 'replaced', 'null', 'live'])(
	'deferred selection respects %s editor',
	(mode) => {
		vi.useFakeTimers();
		const fixture = setup('template', 1);
		fixture.evaluate<() => void>('selectTemplate')();
		if (mode === 'destroyed') fixture.editor.isDestroyed = true;
		if (mode === 'replaced') fixture.context.editor = { ...fixture.editor };
		if (mode === 'null') fixture.context.editor = null;
		vi.runAllTimers();
		expect(fixture.context.selectNextTemplate).toHaveBeenCalledTimes(mode === 'live' ? 1 : 0);
		expect(fixture.editor.commands.focus).toHaveBeenCalledTimes(mode === 'live' ? 1 : 0);
	}
);

it.each(['destroyed', 'null'])('public insertion safely ignores %s editor', async (mode) => {
	const fixture = setup('/cmd', 5);
	if (mode === 'destroyed') fixture.editor.isDestroyed = true;
	else fixture.context.editor = null;
	await fixture.evaluate<(text: string) => Promise<void>>('replaceCommandWithText')('new');
	fixture.evaluate<(content: string) => void>('setContent')('new');
	expect(fixture.text()).toBe('/cmd');
	expect(fixture.view.dispatch).not.toHaveBeenCalled();
	expect(fixture.editor.commands.setContent).not.toHaveBeenCalled();
});

it('rich mode retains Markdown marks and delegates standard paste', async () => {
	const fixture = setup('/cmd suffix', 5, 5, true);
	await fixture.evaluate<(text: string) => Promise<void>>('replaceCommandWithText')('**bold**');
	expect(fixture.text()).toBe('bold suffix');
	expect(fixture.view.state.doc.firstChild?.firstChild?.marks[0].type.name).toBe('bold');
	expect(fixture.view.state.selection.from).toBe(5);
	const event = clipboard('new');
	expect(
		fixture.evaluate<(view: typeof fixture.view, event: ReturnType<typeof clipboard>) => boolean>(
			'handlePaste'
		)(fixture.view, event)
	).toBe(false);
	expect(event.preventDefault).not.toHaveBeenCalled();
});

it.each(['beforeinput', 'paste'])('mobile %s preserves newlines and selected range', (name) => {
	const fixture = setup('left SELECT right', 6, 12);
	fixture.context.navigator.userAgent = 'Android wv';
	const text = '\none\n\ntwo\n';
	const event = { ...clipboard(text), inputType: 'insertText', data: text };
	expect(
		fixture.evaluate<(view: typeof fixture.view, input: typeof event) => boolean>(name)(
			fixture.view,
			event
		)
	).toBe(true);
	expect(fixture.text()).toBe(`left ${text} right`);
	expect(event.preventDefault).toHaveBeenCalledOnce();
});

it('variable replacement uses native line nodes without losing surrounding text', () => {
	const fixture = setup('left {{name}} right', 1);
	fixture.evaluate<(variables: Record<string, unknown>) => void>('replaceVariables')({
		name: '\n🌍\n\n'
	});
	expect(fixture.text()).toBe('left \n🌍\n\n right');
});

it('finds and replaces a command after an inline line break', async () => {
	const fixture = setup('first /cmd', 11);
	fixture.view.dispatch(
		fixture.view.state.tr.replaceWith(1, 11, [
			schema.text('first'),
			schema.nodes.hardBreak.create(),
			schema.text('/cmd')
		])
	);
	fixture.view.dispatch(
		fixture.view.state.tr.setSelection(TextSelection.create(fixture.view.state.doc, 11))
	);
	expect(fixture.evaluate<() => string>('getWordAtDocPos')()).toBe('/cmd');
	await fixture.evaluate<(text: string) => Promise<void>>('replaceCommandWithText')('second');
	expect(fixture.text()).toBe('first\nsecond');
	expect(fixture.view.state.selection.from).toBe(13);
});

it('plain copy contains only the selected range and preserves inline breaks', () => {
	const fixture = setup('left SELECT right', 6, 12);
	const { state } = fixture.view;
	const nodes = [
		state.schema.text('One'),
		state.schema.nodes.hardBreak.create(),
		state.schema.text('Two')
	];
	let tr = state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0));
	tr = tr.setSelection(TextSelection.create(tr.doc, 6, 13));
	fixture.view.dispatch(tr);
	const data: Record<string, string> = {};
	const event = {
		clipboardData: {
			setData: (type: string, value: string): void => {
				data[type] = value;
			}
		},
		preventDefault: vi.fn()
	};
	const copy =
		fixture.evaluate<(view: typeof fixture.view, clipboardEvent: typeof event) => boolean>('copy');
	expect(copy(fixture.view, event)).toBe(true);
	expect(data['text/plain']).toBe('One\nTwo');
	expect(data['text/html']).toBe('One<br>Two');
	expect(event.preventDefault).toHaveBeenCalledOnce();
	fixture.view.dispatch(
		fixture.view.state.tr.setSelection(TextSelection.create(fixture.view.state.doc, 6))
	);
	event.preventDefault.mockClear();
	expect(copy(fixture.view, event)).toBe(false);
	expect(event.preventDefault).not.toHaveBeenCalled();
});

it.each(['one', '\nOne\n\nTwo\n', ''])(
	'the actual slash suggestion inserts exact plain text and leaves the cursor before the suffix: %j',
	async (text) => {
		const fixture = setup('left /cmd right', 10);
		const insert = fixture.evaluate<
			(
				editor: typeof fixture.editor,
				range: { from: number; to: number },
				text: string
			) => Promise<void>
		>('replaceSlashRangeWithPrompt');
		await insert(fixture.editor, { from: 6, to: 10 }, text);
		expect(fixture.text()).toBe(`left ${text} right`);
		expect(fixture.view.state.doc.childCount).toBe(1);
		expect(fixture.view.state.selection.from).toBe(6 + text.length);
		fixture.view.dispatch(fixture.view.state.tr.insertText('X'));
		expect(fixture.text()).toBe(`left ${text}X right`);
	}
);

it.each(['one', '\nOne\n\nTwo\n', ''])(
	'slash prompt keeps its native cursor through blur, async variables and editor updates: %j',
	async (text) => {
		const fixture = setup('left /cmd right', 10);
		const mount = document.createElement('div');
		document.body.append(mount);
		const turndownService = new TurndownService();
		turndownService.escape = (value: string): string => value;
		turndownService.addRule('singleNewlineParagraphs', {
			filter: 'p',
			replacement: (value: string): string => `\n${value}\n`
		});
		let updated: (event: { transaction: Transaction }) => void = () => {};
		const view = new EditorView(mount, {
			state: fixture.view.state,
			dispatchTransaction(this: EditorView, tr: Transaction) {
				this.updateState(this.state.apply(tr));
				updated({ transaction: tr });
			}
		});
		const setContent = vi.fn();
		const editor = {
			view,
			get state() {
				return view.state;
			},
			isDestroyed: false,
			getJSON: () => view.state.doc.toJSON(),
			getHTML: (): string => {
				const element = document.createElement('div');
				element.append(DOMSerializer.fromSchema(schema).serializeFragment(view.state.doc.content));
				return element.innerHTML;
			},
			commands: { setContent }
		};
		const inputVariablesModalCancelCallback = vi.fn();
		const lifecycleContext = {
			editor,
			HTMLElement,
			console,
			turndownService,
			equalEditorJSON,
			richText: false,
			json: true,
			preserveBreaks: false,
			raw: false,
			jsonValue: '',
			htmlValue: '',
			mdValue: '',
			value: '',
			pendingUpdate: null,
			requestAnimationFrame: vi.fn().mockReturnValue(1),
			onChange: vi.fn(),
			eventDispatch: vi.fn(),
			selectTemplate: vi.fn(),
			inputVariablesModalCancelCallback,
			extractInputVariables: (): Record<string, never> => ({}),
			inputVariables: {}
		};
		const lifecycle = runInNewContext(
			ts.transpileModule(
				`(() => { ${definition('focus', source, false)} ${definition('serializeContent')} ${definition('onValueChange')} ${definition('onTransaction')} ${definition('inputVariableHandler', messageInputSource)}; return { focus, onValueChange, onTransaction, inputVariableHandler }; })()`,
				{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
			).outputText,
			lifecycleContext
		) as {
			focus: (options: { preventScroll: boolean }) => void;
			onValueChange: () => void;
			onTransaction: typeof updated;
			inputVariableHandler: (value: string) => Promise<string | null>;
		};
		updated = lifecycle.onTransaction;
		Object.assign(fixture.context, {
			focus: lifecycle.focus,
			inputVariableHandler: lifecycle.inputVariableHandler,
			tick: vi.fn(async (): Promise<void> => {
				lifecycle.onValueChange();
			})
		});
		const suggestion = document.createElement('button');
		document.body.append(suggestion);
		try {
			view.focus();
			suggestion.focus();
			const insert = fixture.evaluate<
				(input: typeof editor, range: { from: number; to: number }, value: string) => Promise<void>
			>('replaceSlashRangeWithPrompt');
			await insert(editor, { from: 6, to: 10 }, text);
			const selection = document.getSelection();
			if (!selection?.anchorNode) throw new Error('Missing native cursor');
			const nativePosition = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
			expect(view.state.doc.textBetween(0, view.state.doc.content.size, '\n', '\n')).toBe(
				`left ${text} right`
			);
			expect(view.state.selection.from).toBe(6 + text.length);
			expect(nativePosition).toBe(6 + text.length);
			expect(inputVariablesModalCancelCallback).toHaveBeenCalledOnce();
			expect(lifecycleContext.onChange).toHaveBeenCalled();
			expect(setContent).not.toHaveBeenCalled();
			view.dispatch(view.state.tr.insertText('X', nativePosition));
			expect(view.state.doc.textBetween(0, view.state.doc.content.size, '\n', '\n')).toBe(
				`left ${text}X right`
			);
		} finally {
			view.destroy();
			mount.remove();
			suggestion.remove();
		}
	}
);
