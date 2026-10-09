// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

type Message = { id: string; content: string; parent_id: string | null; temp_id?: string };
type Event = {
	channel_id: string;
	message_id: string | null;
	user: { id: string; name: string };
	data: { type: string; data: Message };
};
const message = (id = 'm', content = 'new', parent_id: string | null = null): Message => ({
	id,
	content,
	parent_id
});
const event = (type: string, data: Message, channel_id = 'a'): Event => ({
	channel_id,
	message_id: data.id,
	user: { id: 'other', name: 'Other' },
	data: { type, data }
});
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};

function component(kind: string) {
	const source = readFileSync(`src/lib/components/channel/${kind}.svelte`, 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing instance');
	const script = source.slice(instance.content.start, instance.content.end);
	const ast = ts.createSourceFile('component.ts', script, ts.ScriptTarget.Latest, true);
	const code = ast.statements
		.filter((s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s))
		.map((s) => s.getText(ast).replace(/^export\s+/, ''))
		.join('\n');
	const loads = [deferred<Message[]>(), deferred<Message[]>(), deferred<Message[]>()];
	let request = 0;
	const destroy: (() => void)[] = [];
	const errors = vi.fn();
	const context = {
		getContext: () => ({}),
		onMount: vi.fn(),
		onDestroy: (fn: () => void) => destroy.push(fn),
		getChannelById: async (_token: string, id: string) => ({ id }),
		getChannelMessages: () => loads[request++].promise,
		requestCount: () => request,
		getChannelThreadMessages: () => loads[request++].promise,
		localStorage: { token: 'fixture' },
		goto: vi.fn(),
		tick: async () => {},
		$socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
		$channels: [],
		channels: { set: vi.fn() },
		_channelId: { set: vi.fn() },
		$user: { id: 'self' },
		toast: { error: errors },
		console: { debug: vi.fn() },
		setTimeout,
		clearTimeout
	};
	const api = runInNewContext(
		ts.transpileModule(
			`
		${code}
		channel = { id: 'a' }; id = 'a';
		${kind === 'Thread' ? "threadId = 'ta';" : ''}
		let testLoad;
		({ start: () => { testLoad = initHandler(); if (typeof loading !== 'undefined') loading = testLoad; return testLoad; },
			handle: channelEventHandler, requests: requestCount,
			switch: (value) => { ${kind === 'Thread' ? 'threadId' : 'id'} = value; },
			state: () => ({ messages, channel, top }) });
	`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		start: () => Promise<void>;
		requests: () => number;
		handle: (value: Event) => Promise<void>;
		switch: (id: string) => void;
		state: () => { messages: Message[] | null; channel: { id: string } | null; top: boolean };
	};
	return { api, loads, destroy: () => destroy.forEach((fn) => fn()), errors };
}

it.each(
	['Channel', 'Thread'].flatMap((kind) =>
		[
			'message',
			'message:update',
			'message:delete',
			'message:reply',
			'message:reaction:add',
			'message:reaction:remove'
		].map((type) => [kind, type])
	)
)('%s retains %s during initial loading', async (kind, type) => {
	const { api, loads } = component(kind);
	const parent = kind === 'Thread' ? 'ta' : null;
	const loading = api.start();
	const pending = api.handle(event(type, message('m', 'new', parent)));
	// A rejection must be observed immediately on the broken implementation.
	const outcome = pending.then(
		() => null,
		(error: unknown) => error
	);
	await Promise.resolve();
	loads[0].resolve(type === 'message' ? [] : [message('m', 'old', parent)]);
	await loading;
	expect(await outcome).toBeNull();
	expect(api.state().messages?.map((m) => m.content)).toEqual(
		type === 'message:delete' ? [] : ['new']
	);
});

it.each(['Channel', 'Thread'])(
	'%s deduplicates HTTP snapshot and repeated socket delivery',
	async (kind) => {
		const { api, loads } = component(kind);
		const data = message('m', 'new', kind === 'Thread' ? 'ta' : null);
		const loading = api.start();
		const pending = api.handle(event('message', data)).catch(() => {});
		loads[0].resolve([data]);
		await loading;
		await pending;
		await api.handle(event('message', data));
		expect(api.state().messages?.map((m) => m.id)).toEqual(['m']);
	}
);

it.each(['Channel', 'Thread'])('%s ignores stale responses in A→B→A', async (kind) => {
	const { api, loads } = component(kind);
	const a = api.start();
	await vi.waitFor(() => expect(api.requests()).toBe(1));
	api.switch(kind === 'Thread' ? 'tb' : 'b');
	const b = api.start();
	await vi.waitFor(() => expect(api.requests()).toBe(2));
	api.switch(kind === 'Thread' ? 'ta' : 'a');
	const newA = api.start();
	await vi.waitFor(() => expect(api.requests()).toBe(3));
	loads[2].resolve([message('new-a')]);
	await newA;
	loads[1].resolve([message('b')]);
	await b;
	loads[0].resolve([message('old-a')]);
	await a;
	expect(api.state().messages?.map((m) => m.id)).toEqual(['new-a']);
});

it.each(['Channel', 'Thread'])(
	'%s ignores a waiting event after selection changes',
	async (kind) => {
		const { api, loads } = component(kind);
		const a = api.start();
		await vi.waitFor(() => expect(api.requests()).toBe(1));
		const pending = api
			.handle(event('message', message('stale', 'new', kind === 'Thread' ? 'ta' : null)))
			.catch(() => {});
		api.switch(kind === 'Thread' ? 'tb' : 'b');
		const b = api.start();
		await vi.waitFor(() => expect(api.requests()).toBe(2));
		loads[1].resolve([message('b')]);
		await b;
		loads[0].resolve([]);
		await a;
		await pending;
		expect(api.state().messages?.map((m) => m.id)).toEqual(['b']);
	}
);

it.each(['Channel', 'Thread'])('%s invalidates loading on destruction', async (kind) => {
	const { api, loads, destroy } = component(kind);
	const loading = api.start();
	await Promise.resolve();
	destroy();
	loads[0].resolve([message()]);
	await loading;
	expect(api.state().messages).toBeNull();
});

it.each(['Channel', 'Thread'])(
	'%s handles a failed message load without rejecting live events',
	async (kind) => {
		const { api, loads, errors } = component(kind);
		const outcome = api.start().then(
			() => null,
			(error: unknown) => error
		);
		const pending = api.handle(event('message', message())).then(
			() => null,
			(error: unknown) => error
		);
		loads[0].reject(new Error('fixture load failed'));
		expect(await outcome).toBeNull();
		expect(await pending).toBeNull();
		expect(api.state().messages).toBeNull();
		expect(errors).toHaveBeenCalledTimes(1);
	}
);
