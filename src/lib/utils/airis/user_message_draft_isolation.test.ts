// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import type { ChatHistory, ChatHistoryMessage } from './chat_history';

const path = 'src/lib/components/chat/Messages/UserMessage.svelte';
function expression<T>(source: string, context: object): T {
	const code = ts.transpileModule(`(${source})`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 }
	}).outputText;
	return runInNewContext(code, context) as T;
}
function setup() {
	const source = readFileSync(path, 'utf8'),
		ast = parse(source),
		instance = ast.instance;
	if (!instance) throw new Error('Missing script');
	const script = ts.createSourceFile(
		path,
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const declarations = script.statements
		.filter(ts.isVariableStatement)
		.flatMap((s) => [...s.declarationList.declarations]);
	const initializer = (name: string): string => {
		const d = declarations.find((d) => d.name.getText(script) === name);
		if (!d?.initializer) throw new Error(`Missing ${name}`);
		return d.initializer.getText(script);
	};
	const original: ChatHistoryMessage = {
		id: 'm1',
		parentId: null,
		childrenIds: [],
		role: 'user',
		content: 'original',
		files: [
			{
				id: 'image',
				type: 'image',
				url: 'data:image/png;base64,fixture',
				extra: { preserved: true }
			},
			{ id: 'file', type: 'file', url: 'file', name: 'document.pdf' }
		]
	};
	const history: ChatHistory = { messages: { m1: original }, currentId: 'm1' };
	const area = { style: { height: '' }, scrollHeight: 120, focus: vi.fn() };
	const outer = { scrollTop: 42 };
	const context = {
		history,
		messageId: 'm1',
		message: original,
		edit: false,
		editedContent: '',
		editedFiles: [] as ChatHistoryMessage['files'],
		fileIdx: 0,
		messageEditTextAreaElement: area,
		editScrollContainer: { scrollTop: 11 },
		tick: vi.fn().mockResolvedValue(undefined),
		document: { getElementById: vi.fn().mockReturnValue(outer) },
		toast: { error: vi.fn(), success: vi.fn() },
		$i18n: { t: (s: string): string => s },
		editMessage: vi.fn(),
		deleteMessage: vi.fn(),
		structuredClone,
		_copyToClipboard: vi.fn().mockResolvedValue(true),
		gotoMessage: vi.fn(),
		messageIndexEdit: true
	};
	context.message = expression<ChatHistoryMessage>(initializer('message'), context);
	const handlers = {
		begin: expression<() => Promise<void>>(initializer('editMessageHandler'), context),
		cancel: expression<() => void>(initializer('cancelEditMessage'), context),
		confirm: expression<(submit?: boolean) => Promise<void>>(
			initializer('editMessageConfirmHandler'),
			context
		),
		copy: expression<(text: string) => Promise<void>>(initializer('copyToClipboard'), context)
	};
	function nodes(value: unknown): object[] {
		if (!value || typeof value !== 'object') return [];
		if (Array.isArray(value)) return value.flatMap(nodes);
		return [value, ...Object.values(value).flatMap(nodes)];
	}
	const events = nodes(ast.html)
		.filter((n) => 'type' in n && n.type === 'EventHandler' && 'expression' in n)
		.map((n) => {
			const event = n as { name: string; expression: { start: number; end: number } };
			return { name: event.name, raw: source.slice(event.expression.start, event.expression.end) };
		});
	const removals = events.filter((e) => e.raw.includes('splice(fileIdx'));
	expect(removals).toHaveLength(2);
	return {
		...handlers,
		context,
		original,
		area,
		outer,
		events,
		remove: (index: number): Promise<void> =>
			Promise.resolve(expression<() => void>(removals[index].raw, context)())
	};
}

it.each([0, 1])(
	'removal %i changes only the draft, then cancel preserves attachments',
	async (index) => {
		const s = setup(),
			before = structuredClone(s.original);
		await s.begin();
		await s.remove(index);
		expect(s.context.editedFiles?.map((f) => f.id)).toEqual(['file']);
		s.cancel();
		expect(s.context.message).toEqual(before);
		expect(s.original).toEqual(before);
		expect(s.context.edit).toBe(false);
		expect(s.context.editMessage).not.toHaveBeenCalled();
	}
);

it.each([true, false])(
	'confirmation submit=%s sends the edited files and preserves the displayed source',
	async (submit) => {
		const s = setup();
		await s.begin();
		await s.remove(1);
		s.context.editedContent = 'edited';
		await s.confirm(submit);
		expect(s.context.editMessage).toHaveBeenCalledWith(
			'm1',
			{ content: 'edited', files: [s.original.files?.[1]] },
			submit
		);
		expect(s.context.edit).toBe(false);
		expect(s.context.editedFiles).toEqual([]);
		expect(s.context.message.files).toEqual(s.original.files);
	}
);

it('preserves no-file payload and default submit', async () => {
	const s = setup();
	s.context.message.files = undefined;
	await s.begin();
	await s.confirm();
	expect(s.context.editMessage).toHaveBeenCalledWith(
		'm1',
		{ content: 'original', files: undefined },
		true
	);
});

it('allows a file without text and rejects an empty draft', async () => {
	const s = setup();
	await s.begin();
	s.context.editedContent = '';
	await s.confirm(false);
	expect(s.context.editMessage).toHaveBeenCalledTimes(1);
	await s.begin();
	s.context.editedContent = '';
	s.context.editedFiles = [];
	await s.confirm();
	expect(s.context.editMessage).toHaveBeenCalledTimes(1);
	expect(s.context.edit).toBe(true);
	expect(s.context.toast.error).toHaveBeenCalledTimes(1);
});

it('opening the editor preserves scroll and focuses without scrolling', async () => {
	const s = setup();
	await s.begin();
	expect(s.area.style.height).toBe('120px');
	expect(s.outer.scrollTop).toBe(42);
	expect(s.area.focus).toHaveBeenCalledWith({ preventScroll: true });
});

it('copy keeps the original text and success notice', async () => {
	const s = setup();
	await s.copy('text');
	expect(s.context._copyToClipboard).toHaveBeenCalledWith('text');
	expect(s.context.toast.success).toHaveBeenCalledTimes(1);
});

it('textarea input preserves both scroll positions', async () => {
	const s = setup();
	const input = s.events.find((e) => e.name === 'input' && e.raw.includes('savedInnerScroll'));
	if (!input) throw new Error('Missing textarea resize');
	expression<(event: object) => void>(
		input.raw,
		s.context
	)({ target: s.area, currentTarget: s.area });
	expect(s.area.style.height).toBe('120px');
	expect(s.outer.scrollTop).toBe(42);
	expect(s.context.editScrollContainer.scrollTop).toBe(11);
});

it.each(['blur', 'keydown'])(
	'%s in both index inputs keeps one-based to zero-based navigation',
	(kind) => {
		const s = setup();
		const events = s.events.filter((e) => e.name === kind && e.raw.includes('gotoMessage'));
		expect(events).toHaveLength(2);
		for (const event of events) {
			expression<(e: object) => void>(
				event.raw,
				s.context
			)({ key: 'Enter', target: { value: '3' }, currentTarget: { value: '3' } });
		}
		expect(s.context.gotoMessage).toHaveBeenCalledTimes(2);
		expect(s.context.gotoMessage).toHaveBeenCalledWith(s.context.message, 2);
	}
);

it('copy button preserves the clipboard if its source has disappeared', async () => {
	const s = setup();
	const event = s.events.find((e) => e.raw.includes('copyToClipboard(message.content'));
	if (!event) throw new Error('Missing copy button');
	s.context.message.content = undefined;
	const context = { ...s.context, copyToClipboard: s.copy };
	expression<() => void>(event.raw, context)();
	expect(s.context._copyToClipboard).not.toHaveBeenCalled();
});
