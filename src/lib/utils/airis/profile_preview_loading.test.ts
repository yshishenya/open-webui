// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { compile, parse } from 'svelte/compiler';
import 'svelte/internal/flags/legacy';
import * as runtime from 'svelte';
import { createClassComponent } from 'svelte/legacy';
import { readable } from 'svelte/store';
import { LinkPreview } from 'bits-ui';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Component } from 'svelte';

const clientPath = 'svelte/internal/client';
const client: unknown = await import(clientPath);
type Profile = { id: string; name: string };
const profile = (id: string, name = id): Profile => ({ id, name });
const deferred = () => {
	let resolve!: (value: Profile | null) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<Profile | null>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};
const instances: ReturnType<typeof createClassComponent>[] = [];
beforeEach(() => {
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe(): void {}
			unobserve(): void {}
			disconnect(): void {}
		}
	);
});
afterEach(async () => {
	instances.splice(0).forEach((c) => c.$destroy());
	await runtime.tick();
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
const flush = async (): Promise<void> => {
	await runtime.tick();
	await Promise.resolve();
	await runtime.tick();
};

// Compile actual scripts and markup, including native LinkPreview. Only the API and
// unrelated profile display are replaced; opening, bindings and lifecycle are real.
function fixture(
	kind: 'mention' | 'profile' | 'shared',
	fetchUser: (token: string, id: string) => Promise<Profile | null> = async (_, id) => profile(id)
) {
	const api = vi.fn<[string, string], Promise<Profile | null>>(fetchUser);
	const compileComponent = (
		source: string,
		dependencies: Record<string, unknown> = {},
		extra = ''
	): Component<Record<string, unknown>> => {
		const instance = parse(source).instance;
		if (!instance) throw new Error('Missing component instance');
		const ast = ts.createSourceFile(
			'component.ts',
			source.slice(instance.content.start, instance.content.end),
			ts.ScriptTarget.Latest,
			true
		);
		const code = ast.statements
			.filter((s) => !ts.isImportDeclaration(s))
			.map((s) => s.getText(ast))
			.join('\n');
		const script = ts.transpileModule(
			'const channels = testStores.channels; const models = testStores.models;\n' + code + extra,
			{ compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
		).outputText;
		const rewritten =
			source.slice(0, instance.content.start) + script + source.slice(instance.content.end);
		const compiled = compile(rewritten, { generate: 'client', accessors: true }).js.code;
		const common = ts.transpileModule(compiled, {
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
		}).outputText;
		const mod = { exports: {} };
		const globals = {
			LinkPreview,
			getContext: runtime.getContext,
			onDestroy: runtime.onDestroy,
			getUserInfoById: api,
			goto: vi.fn(),
			testStores: { channels: readable([]), models: readable([]) },
			...dependencies
		};
		return new Function(
			'require',
			'module',
			'exports',
			...Object.keys(globals),
			common + '\nreturn module.exports.default;'
		)(
			(name: string) => (name === 'svelte/internal/client' ? client : {}),
			mod,
			mod.exports,
			...Object.values(globals)
		) as Component<Record<string, unknown>>;
	};
	const source = (name: string, path: string): string =>
		readFileSync(
			process.env.AIRIS_PROFILE_PREVIEW_SOURCE_DIR
				? `${process.env.AIRIS_PROFILE_PREVIEW_SOURCE_DIR}/before-${name}.svelte`
				: path,
			'utf8'
		);
	const display = compileComponent(
		'<script>export let user;</script><p data-profile>{user.name}</p>'
	);
	const preview = compileComponent(
		source(
			'UserStatusLinkPreview',
			'src/lib/components/channel/Messages/Message/UserStatusLinkPreview.svelte'
		),
		{ UserStatus: display },
		'\nexport const readUser = () => user;'
	);
	let component: Component<Record<string, unknown>>;
	let props: Record<string, unknown>;
	if (kind === 'shared') {
		component = compileComponent(
			'<script>export let id; export let openPreview=true; let child; export const reader=()=>child.readUser;</script><LinkPreview.Root open={openPreview}><UserStatusLinkPreview {id} {openPreview} bind:this={child}/></LinkPreview.Root>',
			{ UserStatusLinkPreview: preview }
		);
		props = { id: 'a', openPreview: true };
	} else if (kind === 'profile') {
		component = compileComponent(
			source('ProfilePreview', 'src/lib/components/channel/Messages/Message/ProfilePreview.svelte'),
			{ UserStatusLinkPreview: preview }
		);
		props = { user: { id: 'a' } };
	} else {
		component = compileComponent(
			source(
				'MentionToken',
				'src/lib/components/chat/Messages/Markdown/MarkdownInlineTokens/MentionToken.svelte'
			),
			{ UserStatusLinkPreview: preview }
		);
		props = {
			token: { type: 'mention', raw: '<@U:a|Person>', id: 'U:a', label: 'Person', triggerChar: '@' }
		};
	}
	const c = createClassComponent({
		component,
		target: document.body,
		context: new Map([['i18n', readable({ t: (value: string) => value })]]),
		props
	});
	instances.push(c);
	const reader = (): (() => Profile | null) =>
		(c as unknown as { reader: () => () => Profile | null }).reader();
	const destroy = (): void => {
		instances.splice(instances.indexOf(c), 1);
		c.$destroy();
	};
	return {
		c,
		api,
		reader,
		destroy,
		text: () => document.querySelector('[data-profile]')?.textContent
	};
}

it.each(['mention', 'profile'] as const)(
	'opens the actual native %s preview and requests the current user',
	async (kind) => {
		const r = fixture(kind);
		await flush();
		expect(r.api).not.toHaveBeenCalled();
		if (kind === 'mention') {
			const trigger = document.querySelector('[data-link-preview-trigger]');
			expect(trigger).not.toBeNull();
			trigger?.dispatchEvent(new MouseEvent('pointerenter'));
		} else document.querySelector('button')?.click();
		await vi.waitFor(() => expect(r.api).toHaveBeenCalledOnce(), { timeout: 1000 });
		expect(r.api).toHaveBeenCalledWith(localStorage.token, 'a');
		await vi.waitFor(() => expect(r.text()).toBe('a'), { timeout: 1000 });
	}
);

it('clears the old visible profile while the next id is loading', async () => {
	const next = deferred();
	const r = fixture('shared', async (_, id) => (id === 'a' ? profile('a') : next.promise));
	await flush();
	expect(r.reader()()).toEqual(profile('a'));
	r.c.$set({ id: 'b' });
	await flush();
	expect(r.reader()()).toBeNull();
	expect(r.text()).toBeUndefined();
	next.resolve(profile('b'));
	await flush();
	expect(r.reader()()).toEqual(profile('b'));
});

it('rejects stale ABA results for an earlier request of the same id', async () => {
	const first = deferred(),
		second = deferred(),
		third = deferred();
	const requests = [first, second, third];
	let call = 0;
	const r = fixture('shared', () => requests[call++].promise);
	await flush();
	r.c.$set({ id: 'b' });
	await flush();
	r.c.$set({ id: 'a' });
	await flush();
	third.resolve(profile('a', 'latest'));
	await flush();
	second.resolve(profile('b'));
	await flush();
	first.resolve(profile('a', 'stale'));
	await flush();
	expect(r.api).toHaveBeenCalledTimes(3);
	expect(r.reader()()).toEqual(profile('a', 'latest'));
});

it.each(['closed', 'null id', 'destroyed'])(
	'does not apply a pending result after %s',
	async (mode) => {
		const pending = deferred();
		const r = fixture('shared', () => pending.promise);
		await flush();
		const read = r.reader();
		if (mode === 'destroyed') r.destroy();
		else r.c.$set(mode === 'closed' ? { openPreview: false } : { id: null });
		await flush();
		pending.resolve(profile('a'));
		await flush();
		expect(read()).toBeNull();
	}
);

it.each(['rejection', 'null'])(
	'retries %s after closing and reopening, without a request loop',
	async (mode) => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const r = fixture('shared', async () => {
			if (mode === 'rejection') throw new Error('profile unavailable');
			return null;
		});
		await flush();
		expect(r.api).toHaveBeenCalledOnce();
		expect(error).toHaveBeenCalledTimes(mode === 'rejection' ? 1 : 0);
		r.api.mockResolvedValue(profile('a'));
		r.c.$set({ openPreview: false });
		await flush();
		r.c.$set({ openPreview: true });
		await flush();
		expect(r.api).toHaveBeenCalledTimes(2);
		expect(r.reader()()).toEqual(profile('a'));
	}
);

it.each(['M:a', 'C:a', ''])(
	'does not load profiles for a non-user or malformed mention: %s',
	async (id) => {
		const r = fixture('mention');
		r.c.$set({
			token: { type: 'mention', raw: '', id, triggerChar: id.startsWith('C:') ? '#' : '@' }
		});
		await flush();
		document
			.querySelector('[data-link-preview-trigger]')
			?.dispatchEvent(new MouseEvent('pointerenter'));
		await new Promise((resolve) => setTimeout(resolve, 20));
		await flush();
		expect(r.api).not.toHaveBeenCalled();
	}
);

it('restarts an abandoned same-id request and ignores its late response', async () => {
	const first = deferred(),
		second = deferred();
	let call = 0;
	const r = fixture('shared', () => (call++ === 0 ? first : second).promise);
	await flush();
	r.c.$set({ openPreview: false });
	await flush();
	r.c.$set({ openPreview: true });
	await flush();
	expect(r.api).toHaveBeenCalledTimes(2);
	second.resolve(profile('a', 'newest'));
	await flush();
	first.resolve(profile('a', 'abandoned'));
	await flush();
	expect(r.reader()()).toEqual(profile('a', 'newest'));
});

it('caches a successful same-id profile across close and reopen', async () => {
	const r = fixture('shared');
	await flush();
	r.c.$set({ openPreview: false });
	await flush();
	r.c.$set({ openPreview: true });
	await flush();
	expect(r.api).toHaveBeenCalledOnce();
	expect(r.reader()()).toEqual(profile('a'));
});
