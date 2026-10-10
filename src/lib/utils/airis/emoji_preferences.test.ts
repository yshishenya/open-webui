// @vitest-environment node
import { setImmediate } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it } from 'vitest';

const rig = () => {
	const source = readFileSync(
		process.env.EMOJI_SOURCE ?? 'src/lib/components/common/EmojiPicker.svelte',
		'utf8'
	);
	const script = parse(source).instance;
	if (!script) throw new Error('Missing script');
	const parsed = ts.createSourceFile(
		'emoji.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const code = parsed.statements
		.filter((s) => !ts.isImportDeclaration(s))
		.map((s) => s.getText(parsed).replace(/^export /, ''))
		.join('\n');
	const jobs = new Map<number, () => Promise<unknown> | void>();
	const cleanup: (() => void)[] = [];
	const requests: { token: string; payload: { ui: { recentEmojis: string[] } } }[] = [];
	const errors: string[] = [];
	let sequence = 0;
	let request: (token: string, payload: object) => Promise<object> = async () => ({});
	type Preferences = { recentEmojis: string[]; theme: string };
	const context = {
		getContext: () => ({}),
		$i18n: { t: (s: string) => s },
		emojiShortCodes: { A: 'smile', B: ['heart', 'love'], C: 'cat' },
		emojiGroups: { First: ['A', 'B'], Second: ['C'] },
		$settings: { recentEmojis: [] as string[], theme: 'dark' },
		settings: {
			set: (v: Preferences) => {
				context.$settings = v;
			},
			update: (fn: (v: Preferences) => Preferences) => {
				context.$settings = fn(context.$settings);
			}
		},
		localStorage: { token: 'current' },
		setTimeout: (fn: () => Promise<unknown> | void) => {
			jobs.set(++sequence, fn);
			return sequence;
		},
		clearTimeout: (id: number) => jobs.delete(id),
		updateUserSettings: async (token: string, payload: { ui: { recentEmojis: string[] } }) => {
			requests.push({ token, payload });
			return request(token, payload);
		},
		toast: { error: (message: string) => errors.push(message) },
		getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
		console: { warn: (message: string) => errors.push(message) },
		onDestroy: (fn: () => void) => cleanup.push(fn)
	};
	const api = runInNewContext(
		ts.transpileModule(
			code +
				`\n({pick:saveRecentEmoji,select:selectEmoji,recompute:()=>{${parsed.statements
					.filter(ts.isLabeledStatement)
					.map((s) => s.getText(parsed))
					.join(
						'\n'
					)}},rows:()=>emojiRows,setSearch:(s)=>search=s,search:()=>search,setSelected:(s)=>selected=s,setSubmit:(fn)=>onSubmit=fn})`,
			{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
		).outputText,
		context
	) as {
		pick: (s: string) => void;
		select: (e: { name: string; shortCodes: string[] }) => void;
		recompute: () => void;
		rows: () => { type: string; name?: string; label?: string; shortCodes?: string[] }[][];
		setSearch: (s: string) => void;
		search: () => string;
		setSelected: (s: string | null) => void;
		setSubmit: (fn: (s: string | null) => void) => void;
	};
	return {
		api,
		context,
		jobs,
		cleanup,
		requests,
		errors,
		source,
		setRequest: (fn: typeof request) => (request = fn),
		flush: async () => {
			const queued = [...jobs.values()];
			jobs.clear();
			for (const fn of queued) await fn();
			await Promise.resolve();
			await Promise.resolve();
		},
		destroy: () => cleanup.forEach((fn) => fn())
	};
};
const deferred = () => {
	let resolve!: (v: object) => void;
	let reject!: (e: Error) => void;
	const promise = new Promise<object>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	void promise.catch(() => undefined);
	return { promise, resolve, reject };
};
it('contains a refused delayed save and preserves selected recents', async () => {
	const r = rig();
	r.setRequest(async () => {
		throw Error('refused');
	});
	r.api.pick('A');
	await expect(r.flush()).resolves.toBeUndefined();
	expect(r.context.$settings.recentEmojis).toEqual(['A']);
	expect(r.errors).toHaveLength(1);
});
it('flushes the latest pending choice at destruction and removes its timer', async () => {
	const r = rig();
	r.api.pick('A');
	r.destroy();
	expect(r.jobs.size).toBe(0);
	await Promise.resolve();
	expect(r.requests).toHaveLength(1);
	expect(r.requests[0].payload.ui.recentEmojis).toEqual(['A']);
});
it('does not notify a destroyed component on a late refusal', async () => {
	const r = rig(),
		d = deferred();
	r.setRequest(() => d.promise);
	r.api.pick('A');
	r.destroy();
	d.reject(Error('refused'));
	await setImmediate();
	expect(r.errors).toEqual(['Recent emoji preferences could not be saved.']);
});
it('serializes choices made while the previous request is pending', async () => {
	const r = rig(),
		d = deferred();
	r.setRequest(() => d.promise);
	r.api.pick('A');
	const first = r.flush();
	r.api.recompute();
	r.api.pick('B');
	const second = r.flush();
	await setImmediate();
	expect(r.requests).toHaveLength(1);
	r.setRequest(async () => ({}));
	d.resolve({});
	await first;
	await second;
	await setImmediate();
	expect(r.requests.map((v) => v.payload.ui.recentEmojis)).toEqual([['A'], ['B', 'A']]);
});
it('saves the latest choice after a failed previous request', async () => {
	const r = rig(),
		d = deferred();
	r.setRequest(() => d.promise);
	r.api.pick('A');
	const first = r.flush();
	r.api.recompute();
	r.api.pick('B');
	r.setRequest(async () => ({}));
	d.reject(Error('refused'));
	await expect(first).resolves.toBeUndefined();
	await r.flush();
	expect(r.requests.at(-1)?.payload.ui.recentEmojis).toEqual(['B', 'A']);
});
it('does not write the old choice after a changed login', async () => {
	const r = rig();
	r.api.pick('A');
	r.context.localStorage.token = 'another';
	await r.flush();
	expect(r.requests).toHaveLength(0);
});
it('deduplicates valid recent choices and ignores unknown emoji names', () => {
	const r = rig();
	r.context.$settings.recentEmojis = ['B', 'invalid', 'A', 'B'];
	r.api.recompute();
	r.api.pick('B');
	expect(r.context.$settings.recentEmojis).toEqual(['B', 'A']);
	r.api.pick('unknown');
	expect(r.context.$settings.recentEmojis).toEqual(['B', 'A']);
});
it('debounces rapid picks and preserves unrelated settings', async () => {
	const r = rig();
	r.api.pick('A');
	r.api.recompute();
	r.api.pick('B');
	expect(r.jobs.size).toBe(1);
	await r.flush();
	expect(r.requests[0].payload.ui).toMatchObject({ theme: 'dark', recentEmojis: ['B', 'A'] });
});
it('selects and deselects immediately without waiting for save', () => {
	const r = rig();
	let selected: string | null = '';
	r.api.setSubmit((s) => (selected = s));
	r.api.setSearch('smile');
	r.api.select({ name: 'A', shortCodes: ['smile'] });
	expect(selected).toBe('smile');
	expect(r.api.search()).toBe('');
	r.api.setSelected('smile');
	r.api.select({ name: 'A', shortCodes: ['smile'] });
	expect(selected).toBeNull();
	expect(r.requests).toHaveLength(0);
});
it('searches codepoint names and aliases while keeping separate group rows', () => {
	const r = rig();
	r.api.setSearch('LOVE');
	r.api.recompute();
	expect(r.api.rows()).toEqual([
		[{ type: 'group', label: 'First' }],
		[{ type: 'emoji', name: 'B', shortCodes: ['heart', 'love'] }]
	]);
	r.api.setSearch('missing');
	r.api.recompute();
	expect(r.api.rows()).toEqual([]);
});
it('renders recents only outside search and keeps the group heading separate', () => {
	const r = rig();
	r.context.$settings.recentEmojis = ['B'];
	r.api.recompute();
	expect(r.api.rows()[0]).toEqual([{ type: 'group', label: 'Recently Used' }]);
	expect(r.api.rows()[1][0].name).toBe('B');
	r.api.setSearch('cat');
	r.api.recompute();
	expect(r.api.rows()[0]).toEqual([{ type: 'group', label: 'Second' }]);
});
it('passes a CSS height and keeps native measured row heights', () => {
	const r = rig();
	expect(r.source).toContain('height="384px"');
	expect(r.source).not.toContain('rowHeight=');
	expect(r.source).not.toContain('itemHeight=');
});

it('limits recent choices to thirty valid names', () => {
	const r = rig();
	const names = Array.from({ length: 40 }, (_, i) => 'X' + i);
	Object.assign(r.context.emojiShortCodes, Object.fromEntries(names.map((name) => [name, name])));
	r.context.$settings.recentEmojis = names;
	r.api.recompute();
	r.api.pick('A');
	expect(r.context.$settings.recentEmojis).toEqual(['A', ...names.slice(0, 29)]);
});
