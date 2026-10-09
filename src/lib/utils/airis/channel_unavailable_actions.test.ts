// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// Execute the real handlers, including Svelte's inline action callbacks.
type Input = { content: string; data: { files: [] } };
function handler(
	file: string,
	action: string,
	setup: string
): {
	send: Mock<unknown[], Promise<null>>;
	run: (value: Input) => Promise<void>;
} {
	const source = readFileSync(`src/lib/components/channel/${file}.svelte`, 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing script');
	const script = source.slice(instance.content.start, instance.content.end);
	const ast = ts.createSourceFile('component.ts', script, ts.ScriptTarget.Latest, true);
	const code = ast.statements
		.filter((s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s))
		.map((s) => s.getText(ast).replace(/^export\s+/, ''))
		.join('\n');
	const send = vi.fn<unknown[], Promise<null>>(async () => null);
	const user = { id: 'self', name: 'Self', role: 'user' };
	return {
		send,
		run: runInNewContext(
			ts.transpileModule(`${code}\n${setup}\n${action}`, {
				compilerOptions: { target: ts.ScriptTarget.ES2022 }
			}).outputText,
			{
				getContext: () => ({}),
				onMount: vi.fn(),
				onDestroy: vi.fn(),
				sendMessage: send,
				$user: user,
				$i18n: { t: (text: string) => text },
				$socket: { emit: send },
				$channels: [],
				channels: { set: vi.fn() },
				localStorage: { token: 'fixture' },
				tick: async () => {},
				document: { getElementById: () => ({}) },
				uuidv4: () => 'pending',
				toast: { error: vi.fn() }
			}
		) as (value: { content: string; data: { files: [] } }) => Promise<void>
	};
}

it.each(['Channel', 'Thread'])(
	'%s avoids submission while its selection is unavailable',
	async (file) => {
		const { run, send } = handler(file, 'submitHandler;', '');
		await run({ content: 'Hello', data: { files: [] } });
		expect(send).not.toHaveBeenCalled();
	}
);

it.each(['Channel', 'Thread'])('%s still submits text to the selected channel', async (file) => {
	const setup =
		"channel = { id: 'a' }; messages = []; " +
		(file === 'Thread' ? "threadId = 'parent';" : "id = 'a';");
	const { run, send } = handler(file, 'submitHandler;', setup);
	await run({ content: 'Hello', data: { files: [] } });
	expect(send).toHaveBeenCalledOnce();
	expect(send).toHaveBeenCalledWith(
		'fixture',
		'a',
		expect.objectContaining({ content: 'Hello', data: { files: [] } })
	);
});

it('Thread avoids typing events after selection is cleared', async () => {
	const { run, send } = handler('Thread', 'onChange;', '');
	await run({ content: '', data: { files: [] } });
	expect(send).not.toHaveBeenCalled();
});

it('MessageInput tolerates an editor destroyed before variable replacement', () => {
	const { run } = handler('MessageInput', 'replaceVariables;', '');
	expect(() => run({ content: '', data: { files: [] } })).not.toThrow();
});

function inlineAction(
	file: string,
	name: string,
	available: boolean
): {
	send: Mock<unknown[], Promise<null>>;
	run: (value: unknown) => void | Promise<void>;
} {
	const source = readFileSync(`src/lib/components/channel/${file}.svelte`, 'utf8');
	const marker = `${name}={`;
	const start = source.indexOf(marker);
	if (start < 0) throw new Error(`Missing ${name}`);
	const ast = ts.createSourceFile(
		'action.ts',
		`const action = ${source.slice(start + marker.length)}`,
		ts.ScriptTarget.Latest,
		true
	);
	const declaration = ast.statements.filter(ts.isVariableStatement)[0]?.declarationList
		.declarations[0];
	if (!declaration?.initializer || !ts.isArrowFunction(declaration.initializer))
		throw new Error('Missing action callback');
	const send = vi.fn<unknown[], Promise<null>>(async () => null);
	const message = { id: 'm', channel_id: available ? 'a' : null, reactions: [], is_pinned: true };
	const run = runInNewContext(
		ts.transpileModule(`(${declaration.initializer.getText(ast)})`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		{
			message,
			messages: [message],
			pinnedMessages: available ? [message] : null,
			$user: available ? { id: 'self', name: 'Self' } : null,
			localStorage: { token: 'fixture' },
			toast: { error: vi.fn() },
			deleteMessage: send,
			updateMessage: send,
			pinMessage: send,
			addReaction: send,
			removeReaction: send,
			onPin: vi.fn(),
			init: vi.fn()
		}
	) as (value: unknown) => void | Promise<void>;
	return { run: (value) => run(name === 'onPin' ? message : value), send };
}

it.each(['onDelete', 'onEdit', 'onPin', 'onReaction'])(
	'%s avoids a request from an unavailable message',
	async (name) => {
		const { run, send } = inlineAction('Messages', name, false);
		await run('Hello');
		expect(send).not.toHaveBeenCalled();
	}
);

it.each(['onDelete', 'onEdit', 'onPin', 'onReaction'])(
	'%s still sends a request for a confirmed message',
	async (name) => {
		const { run, send } = inlineAction('Messages', name, true);
		await run('Hello');
		expect(send).toHaveBeenCalledOnce();
		expect(send.mock.calls[0].slice(0, 3)).toEqual(['fixture', 'a', 'm']);
	}
);

it.each([false, true])('PinnedMessagesModal respects availability=%s', async (available) => {
	const { run, send } = inlineAction('PinnedMessagesModal', 'onPin', available);
	await run(null);
	expect(send).toHaveBeenCalledTimes(available ? 1 : 0);
});
