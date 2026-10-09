// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { compile, parse } from 'svelte/compiler';
import 'svelte/internal/flags/legacy';
import * as runtime from 'svelte';
import { createClassComponent } from 'svelte/legacy';
import { readable } from 'svelte/store';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import type { Component } from 'svelte';
import type { ChannelMessageData } from './channel-types';

// The compiler runtime ships no public TypeScript declarations; only generated JS consumes it.
const clientPath = 'svelte/internal/client';
const client: unknown = await import(clientPath);

type Message = { id: string; data: ChannelMessageData | boolean | null };
const data = (value: string): ChannelMessageData => ({ marker: value });
const deferred = () => {
	let resolve!: (value: ChannelMessageData | null) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<ChannelMessageData | null>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};
const instances: ReturnType<typeof createClassComponent>[] = [];
afterEach(() => {
	instances.splice(0).forEach((c) => c.$destroy());
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

// Compile the real instance script with a data probe in place of unrelated child markup.
// Unlike manually invoking a handler, this exercises Svelte's actual reactive scheduling.
function renderer(
	message: Message | null,
	channel: { id: string } | null = { id: 'a' },
	fetchData: () => Promise<ChannelMessageData | null> = async () => data('loaded')
) {
	const source = readFileSync(
		process.env.AIRIS_MESSAGE_RELOAD_SOURCE ?? 'src/lib/components/channel/Messages/Message.svelte',
		'utf8'
	);
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing message script');
	const script = source.slice(instance.content.start, instance.content.end);
	const ast = ts.createSourceFile('component.ts', script, ts.ScriptTarget.Latest, true);
	const code = ast.statements
		.filter((s) => !ts.isImportDeclaration(s))
		.map((s) => s.getText(ast))
		.join('\n');
	const hooks = 'const {getContext,onMount,onDestroy} = runtime;';
	const api = vi.fn<[string, string, string], Promise<ChannelMessageData | null>>(fetchData);
	const loadingMarkup = source
		.slice(
			source.indexOf('<!-- loading indicator -->'),
			source.indexOf('{:else if (message?.data?.files')
		)
		.replaceAll('<Skeleton />', '<span>loading</span>');
	const compiled = compile(
		`<script>${ts.transpileModule(`${hooks}\n${code}\nexport const failed = () => typeof dataLoadError !== 'undefined' && dataLoadError; export const retry = () => loadMessageData(message, channel.id);`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText}</script><pre>{JSON.stringify(message?.data)}</pre>{#if message?.data === true}${loadingMarkup}{/if}`,
		{ generate: 'client', accessors: true }
	).js.code;
	const common = ts.transpileModule(compiled, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
	}).outputText;
	const mod = { exports: {} };
	const component = new Function(
		'require',
		'module',
		'exports',
		'runtime',
		'getMessageData',
		'dayjs',
		'buildOutputDisplayItems',
		'relativeTime',
		'isToday',
		'isYesterday',
		'localizedFormat',
		common + '\nreturn module.exports.default;'
	)(
		(name: string) => (name === 'svelte/internal/client' ? client : {}),
		mod,
		mod.exports,
		runtime,
		api,
		{ extend: () => {} },
		() => [],
		null,
		null,
		null,
		null
	) as Component<{ message: Message | null; channel: { id: string } | null }>;
	const c = createClassComponent({
		component,
		target: document.body,
		context: new Map([['i18n', readable({ t: (value: string) => value })]]),
		props: { message, channel }
	});
	instances.push(c);
	const exports = c as unknown as { failed: () => boolean; retry: () => Promise<void> };
	return {
		c,
		api,
		failed: () => exports.failed(),
		retry: () => exports.retry(),
		text: () => document.querySelector('pre')?.textContent
	};
}
const flush = async (): Promise<void> => {
	await runtime.tick();
	await Promise.resolve();
	await runtime.tick();
};

it('reloads data:true after a pin update of the already mounted message', async () => {
	const r = renderer({ id: 'm', data: data('initial') });
	await flush();
	expect(r.api).not.toHaveBeenCalled();
	r.c.$set({ message: { id: 'm', data: true } });
	await flush();
	expect(r.api).toHaveBeenCalledOnce();
	expect(r.api).toHaveBeenCalledWith(localStorage.token, 'a', 'm');
	expect(r.text()).toContain('loaded');
});

it.each([false, null, data('full')])('does not fetch data=%j', async (value) => {
	const r = renderer({ id: 'm', data: value });
	await flush();
	expect(r.api).not.toHaveBeenCalled();
});

it('loads initial slim data once', async () => {
	const r = renderer({ id: 'm', data: true });
	await flush();
	expect(r.api).toHaveBeenCalledOnce();
	expect(r.text()).toContain('loaded');
});

it.each(['message', 'channel', 'newer-data', 'destroy'])(
	'ignores stale data after %s changes during a request',
	async (change) => {
		const initial: Message = { id: 'm', data: true };
		const waiting = deferred();
		const r = renderer(initial, { id: 'a' }, () => waiting.promise);
		await runtime.tick();
		const next = { id: 'm2', data: data('newer') };
		if (change === 'message') r.c.$set({ message: next });
		if (change === 'channel') r.c.$set({ channel: { id: 'b' }, message: next });
		if (change === 'newer-data') {
			initial.data = data('newer');
			r.c.$set({ message: initial });
		}
		if (change === 'destroy') {
			r.c.$destroy();
			instances.splice(instances.indexOf(r.c), 1);
		}
		await runtime.tick();
		waiting.resolve(data('stale'));
		await flush();
		if (change === 'destroy') expect(initial.data).toBe(true);
		else expect(r.text()).toContain('newer');
	}
);

it('waits for a channel before fetching', async () => {
	const r = renderer({ id: 'm', data: true }, null);
	await flush();
	expect(r.api).not.toHaveBeenCalled();
	r.c.$set({ channel: { id: 'a' } });
	await flush();
	expect(r.api).toHaveBeenCalledOnce();
	expect(r.text()).toContain('loaded');
});

it('reports failure without a fetch loop and allows explicit retry', async () => {
	const r = renderer({ id: 'm', data: true }, { id: 'a' }, async () => {
		throw new Error('fixture failed');
	});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	await flush();
	expect(r.api).toHaveBeenCalledOnce();
	expect(r.failed()).toBe(true);
	r.api.mockResolvedValue(data('loaded'));
	const retry = document.querySelector('button');
	expect(retry?.textContent).toBe('Retry');
	retry?.click();
	await flush();
	expect(r.api).toHaveBeenCalledTimes(2);
	expect(r.failed()).toBe(false);
	expect(r.text()).toContain('loaded');
});

it('does not duplicate a request while the same slim object rerenders', async () => {
	const waiting = deferred();
	const initial: Message = { id: 'm', data: true };
	const r = renderer(initial, { id: 'a' }, () => waiting.promise);
	await runtime.tick();
	r.c.$set({ message: initial });
	await runtime.tick();
	expect(r.api).toHaveBeenCalledOnce();
	waiting.resolve(null);
	await flush();
	expect(r.text()).toBe('null');
	expect(document.body.textContent).not.toContain('loading');
});

it('keeps the latest pin response when data loads overlap', async () => {
	const first = deferred();
	const second = deferred();
	const r = renderer({ id: 'm', data: true }, { id: 'a' }, () => first.promise);
	await runtime.tick();
	r.api.mockImplementation(() => second.promise);
	r.c.$set({ message: { id: 'm', data: true } });
	await runtime.tick();
	expect(r.api).toHaveBeenCalledTimes(2);
	first.resolve(data('stale'));
	await flush();
	expect(r.text()).toBe('true');
	second.resolve(data('latest'));
	await flush();
	expect(r.text()).toContain('latest');
});

it('does not fetch for an unavailable message', async () => {
	const r = renderer(null);
	await flush();
	expect(r.api).not.toHaveBeenCalled();
});
