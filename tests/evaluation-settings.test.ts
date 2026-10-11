// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import { getConfig, updateConfig, getLeaderboard, getModelHistory } from '$lib/apis/evaluations';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api' }));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function handlers(
	file: string,
	names: string[],
	context: object
): Record<string, (...args: unknown[]) => Promise<unknown>> {
	const source = readFileSync('src/lib/components/admin/' + file, 'utf8');
	const script = parse(source).instance!;
	const tree = ts.createSourceFile(
		'actual.ts',
		source.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest
	);
	const code = tree.statements
		.flatMap((s) =>
			ts.isVariableStatement(s)
				? s.declarationList.declarations
						.filter((d) => names.includes(d.name.getText(tree)))
						.map((d) => 'const ' + d.getText(tree) + ';')
				: []
		)
		.join('\n');
	return runInNewContext(
		ts.transpileModule(code + '\n({' + names.join(',') + '});', {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	);
}
const arena = {
	id: 'custom',
	name: 'Custom',
	meta: { description: 'Keep this', access_grants: [] }
};
const draft = () => ({ ENABLE_EVALUATION_ARENA_MODELS: true, EVALUATION_ARENA_MODELS: [arena] });
function settings() {
	const c = {
		evaluationConfig: draft(),
		saving: false,
		localStorage: { token: 'fixture' },
		updateConfig: vi.fn(),
		getModels: vi.fn(async () => []),
		models: { set: vi.fn() },
		$config: { features: {} },
		$settings: {},
		$i18n: { t: (s: string) => s },
		toast: { error: vi.fn(), success: vi.fn() },
		dispatch: vi.fn()
	};
	return { c, run: handlers('Settings/Evaluations.svelte', ['submitHandler'], c).submitHandler };
}
it('keeps the settings draft on a refused save without a save event or success', async () => {
	const { c, run } = settings();
	const before = JSON.stringify(c.evaluationConfig);
	c.updateConfig.mockRejectedValue(Error('Refused'));
	expect(await run()).toBe(false);
	expect(JSON.stringify(c.evaluationConfig)).toBe(before);
	expect(c.toast.error).toHaveBeenCalledOnce();
	expect(c.toast.success).not.toHaveBeenCalled();
	expect(c.dispatch).not.toHaveBeenCalled();
	expect(c.getModels).not.toHaveBeenCalled();
	expect(c.saving).toBe(false);
});
it('awaits saving, blocks duplicate POST, then refreshes models and emits save once', async () => {
	const { c, run } = settings();
	let resolve!: (r: ReturnType<typeof draft>) => void;
	c.updateConfig.mockImplementation(
		() =>
			new Promise((r) => {
				resolve = r;
			})
	);
	const pending = run();
	expect(c.toast.success).not.toHaveBeenCalled();
	expect(c.dispatch).not.toHaveBeenCalled();
	expect(await run()).toBe(false);
	expect(c.updateConfig).toHaveBeenCalledOnce();
	resolve(draft());
	expect(await pending).toBe(true);
	expect(c.toast.success).toHaveBeenCalledOnce();
	expect(c.dispatch).toHaveBeenCalledOnce();
	expect(c.dispatch).toHaveBeenCalledWith('save');
	expect(c.getModels).toHaveBeenCalledOnce();
	expect(c.saving).toBe(false);
});
function modal() {
	const c = {
		loading: false,
		show: true,
		edit: false,
		name: 'Custom',
		id: 'custom',
		profileImageUrl: '/avatar',
		description: 'Keep this',
		modelIds: ['base'],
		filterMode: 'include',
		accessGrants: [{ principal_type: 'group', principal_id: 'team', permission: 'read' }],
		selectedModelId: '',
		$models: [],
		onSubmit: vi.fn(),
		dispatch: vi.fn(),
		toast: { error: vi.fn() },
		$i18n: { t: (s: string) => s },
		WEBUI_BASE_URL: ''
	};
	return {
		c,
		run: handlers('Settings/Evaluations/ArenaModelModal.svelte', ['submitHandler'], c).submitHandler
	};
}
it.each(['false', 'throw'])(
	'arena editor keeps fields and remains open after %s refusal',
	async (mode) => {
		const { c, run } = modal();
		if (mode === 'throw') c.onSubmit.mockRejectedValue(Error('Refused'));
		else c.onSubmit.mockResolvedValue(false);
		await run();
		expect(c.onSubmit).toHaveBeenCalledOnce();
		expect(c.show).toBe(true);
		expect(c.name).toBe('Custom');
		expect(c.description).toBe('Keep this');
		expect(c.modelIds).toEqual(['base']);
		expect(c.accessGrants[0].principal_id).toBe('team');
		expect(c.loading).toBe(false);
	}
);
it('arena editor awaits confirmation and prevents a second submit before clearing fields', async () => {
	const { c, run } = modal();
	let resolve!: (r: boolean) => void;
	c.onSubmit.mockImplementation(
		() =>
			new Promise((r) => {
				resolve = r;
			})
	);
	const pending = run();
	expect(c.loading).toBe(true);
	expect(c.show).toBe(true);
	expect(c.name).toBe('Custom');
	await run();
	expect(c.onSubmit).toHaveBeenCalledOnce();
	resolve(true);
	await pending;
	expect(c.show).toBe(false);
	expect(c.name).toBe('');
	expect(c.loading).toBe(false);
	expect(c.onSubmit.mock.calls[0][0].meta.access_grants).toEqual([
		{ principal_type: 'group', principal_id: 'team', permission: 'read' }
	]);
});
const entry = (model_id: string, rating = 1200) => ({
	model_id,
	rating,
	won: 1,
	lost: 0,
	count: 1,
	top_tags: []
});
it('a late leaderboard response cannot replace the newer query', async () => {
	const c = {
		loading: false,
		leaderboardVersion: 0,
		query: 'old',
		rankedModels: [{ id: 'cached' }],
		$models: [],
		localStorage: { token: 'fixture' },
		getLeaderboard: vi.fn(),
		adminLeaderboardCount: { set: vi.fn() },
		console: { error: vi.fn() }
	};
	let finish!: (r: { entries: ReturnType<typeof entry>[] }) => void;
	c.getLeaderboard
		.mockImplementationOnce(
			() =>
				new Promise((r) => {
					finish = r;
				})
		)
		.mockResolvedValueOnce({ entries: [entry('new')] });
	const run = handlers('Evaluations/Leaderboard.svelte', ['loadLeaderboard'], c).loadLeaderboard;
	const old = run('old');
	c.query = 'new';
	await run('new');
	finish({ entries: [entry('old')] });
	await old;
	expect(c.rankedModels.map((m) => m.id)).toEqual(['new']);
	expect(c.adminLeaderboardCount.set).toHaveBeenCalledOnce();
});
it('a leaderboard refusal keeps the previously loaded ranking', async () => {
	const c = {
		loading: false,
		leaderboardVersion: 0,
		query: '',
		rankedModels: [{ id: 'cached' }],
		$models: [],
		localStorage: { token: 'fixture' },
		getLeaderboard: vi.fn().mockRejectedValue(Error('Offline')),
		adminLeaderboardCount: { set: vi.fn() },
		console: { error: vi.fn() }
	};
	await handlers('Evaluations/Leaderboard.svelte', ['loadLeaderboard'], c).loadLeaderboard();
	expect(c.rankedModels).toEqual([{ id: 'cached' }]);
	expect(c.loading).toBe(false);
});
it('an older history range cannot replace the newest one', async () => {
	const c = {
		show: true,
		model: { id: 'model' },
		historyVersion: 0,
		loadingHistory: false,
		history: [],
		localStorage: { token: 'fixture' },
		getModelHistory: vi.fn(),
		console: { error: vi.fn() }
	};
	let finish!: (r: object) => void;
	c.getModelHistory
		.mockImplementationOnce(
			() =>
				new Promise((r) => {
					finish = r;
				})
		)
		.mockResolvedValueOnce({ history: [{ date: '2026-10-11', won: 2, lost: 0 }] });
	const run = handlers('Evaluations/LeaderboardModal.svelte', ['loadHistory'], c).loadHistory;
	const old = run(30);
	await run(365);
	finish({ history: [{ date: '2026-10-10', won: 1, lost: 0 }] });
	await old;
	expect(c.history).toEqual([{ date: '2026-10-11', won: 2, lost: 0 }]);
	expect(c.loadingHistory).toBe(false);
});
it('history returned after closing the modal is ignored', async () => {
	const c = {
		show: true,
		model: { id: 'model' },
		historyVersion: 0,
		loadingHistory: false,
		history: [{ date: 'cached', won: 1, lost: 0 }],
		localStorage: { token: 'fixture' },
		getModelHistory: vi.fn(),
		console: { error: vi.fn() }
	};
	let finish!: (r: object) => void;
	c.getModelHistory.mockImplementation(
		() =>
			new Promise((r) => {
				finish = r;
			})
	);
	const run = handlers('Evaluations/LeaderboardModal.svelte', ['loadHistory'], c).loadHistory;
	const pending = run(30);
	c.show = false;
	finish({ history: [] });
	await pending;
	expect(c.history).toEqual([{ date: 'cached', won: 1, lost: 0 }]);
});
it.each(['config', 'save', 'leaderboard', 'history'])(
	'%s API rejects network failure instead of treating it as empty data',
	async (mode) => {
		const fetch = vi.fn().mockRejectedValue(Error('Offline'));
		vi.stubGlobal('fetch', fetch);
		const request =
			mode === 'config'
				? getConfig('fixture')
				: mode === 'save'
					? updateConfig('fixture', draft())
					: mode === 'leaderboard'
						? getLeaderboard('fixture', 'topic')
						: getModelHistory('fixture', 'model', 30);
		await expect(request).rejects.toThrow();
		expect(fetch).toHaveBeenCalledOnce();
	}
);
it.each(['config', 'leaderboard', 'history'])(
	'%s API rejects malformed successful JSON',
	async (mode) => {
		const fetch = vi.fn(async () => new Response('{}'));
		vi.stubGlobal('fetch', fetch);
		const request =
			mode === 'config'
				? getConfig('fixture')
				: mode === 'leaderboard'
					? getLeaderboard('fixture')
					: getModelHistory('fixture', 'model', 30);
		await expect(request).rejects.toThrow();
		expect(fetch).toHaveBeenCalledOnce();
	}
);
it('accepts actual configuration, leaderboard and history response shapes', async () => {
	const fetch = vi
		.fn()
		.mockResolvedValueOnce(new Response(JSON.stringify(draft())))
		.mockResolvedValueOnce(new Response(JSON.stringify(draft())))
		.mockResolvedValueOnce(new Response(JSON.stringify({ entries: [entry('m')] })))
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ model_id: 'm', history: [{ date: '2026-10-11', won: 1, lost: 0 }] })
			)
		);
	vi.stubGlobal('fetch', fetch);
	expect(await getConfig('fixture')).toEqual(draft());
	expect(await updateConfig('fixture', draft())).toEqual(draft());
	expect(await getLeaderboard('fixture', 'tag')).toEqual({ entries: [entry('m')] });
	expect((await getModelHistory('fixture', 'm', 30)).history).toHaveLength(1);
	expect(fetch).toHaveBeenCalledTimes(4);
	expect(fetch.mock.calls[1][1].body).toBe(JSON.stringify(draft()));
	expect(fetch.mock.calls[2][0]).toContain('query=tag');
});

it('saved configuration stays accepted when catalog refresh fails without repeating the POST', async () => {
	const { c, run } = settings();
	c.updateConfig.mockResolvedValue(draft());
	c.getModels.mockRejectedValue(Error('Catalog offline'));
	expect(await run()).toBe(true);
	expect(c.updateConfig).toHaveBeenCalledOnce();
	expect(c.dispatch).toHaveBeenCalledOnce();
	expect(c.toast.error).toHaveBeenCalledOnce();
	expect(c.saving).toBe(false);
});
it.each(['http', 'read'])('evaluation save rejects %s failure without retry', async (mode) => {
	const fetch = vi.fn(async () =>
		mode === 'http'
			? new Response('{"detail":"Refused"}', { status: 403 })
			: new Response(
					new ReadableStream({
						start(c) {
							c.error(Error('Read failed'));
						}
					})
				)
	);
	vi.stubGlobal('fetch', fetch);
	await expect(updateConfig('fixture', draft())).rejects.toThrow();
	expect(fetch).toHaveBeenCalledOnce();
});
