// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import {
	exportAllFeedbacks,
	getFeedbackById,
	getFeedbackItems,
	getFeedbackModelIds
} from '$lib/apis/evaluations';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

const reads = [
	() => getFeedbackModelIds('token'),
	() => getFeedbackItems('token', 'username', 'asc', 2, 'model'),
	() => exportAllFeedbacks('token', 'model'),
	() => getFeedbackById('token', 'feedback')
];
it.each(reads)(
	'rejects network refusal and malformed JSON rather than losing loaded data',
	async (read) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw Error('private-network-detail');
			})
		);
		await expect(read()).rejects.toThrow();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('{'))
		);
		await expect(read()).rejects.toThrow();
	}
);
it.each(reads)('rejects a wrong response shape', async (read) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('null'))
	);
	await expect(read()).rejects.toThrow();
});
it('keeps GET/auth, model filtering, complete JSON and server username sort', async () => {
	const record = {
		id: 'feedback',
		user_id: 'user',
		data: { rating: 0 },
		meta: { chat_id: 'chat' },
		snapshot: { chat: { extra: 'saved' } },
		extra: 'keep'
	};
	const fetch = vi.fn(
		async (url: string) =>
			new Response(
				JSON.stringify(
					url.includes('/list?')
						? { items: [], total: 0 }
						: url.includes('/models')
							? []
							: url.includes('/export?')
								? [record]
								: record
				)
			)
	);
	vi.stubGlobal('fetch', fetch);
	await expect(reads[0]()).resolves.toEqual([]);
	await expect(reads[1]()).resolves.toEqual({ items: [], total: 0 });
	await expect(reads[2]()).resolves.toEqual([record]);
	await expect(reads[3]()).resolves.toEqual(record);
	const call = (fetch.mock.calls as unknown as [string, RequestInit][])[1];
	expect(call[0]).toBe(
		'/api/v1/evaluations/feedbacks/list?order_by=username&direction=asc&page=2&model_id=model'
	);
	expect(call[1].method).toBe('GET');
	expect(new Headers(call[1].headers).get('Authorization')).toBe('Bearer token');
	expect(call[1].body).toBeUndefined();
	expect(fetch.mock.calls[2][0]).toContain('model_id=model');
});
it('supports cancellation and a deadline during JSON body reading', async () => {
	vi.useFakeTimers();
	const fetch = vi.fn(async (_url: string, init: RequestInit) => ({
		ok: true,
		json: () =>
			new Promise((_resolve, reject) =>
				init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })
			)
	}));
	vi.stubGlobal('fetch', fetch);
	const pending = expect(getFeedbackItems('token', 'updated_at', 'desc', 1)).rejects.toThrow(
		'timed out'
	);
	await vi.advanceTimersByTimeAsync(60_000);
	await pending;
	const controller = new AbortController();
	controller.abort(Error('cancelled'));
	await expect(getFeedbackById('token', 'feedback', controller.signal)).rejects.toThrow(
		'cancelled'
	);
	expect(fetch).toHaveBeenCalledOnce();
	expect(vi.getTimerCount()).toBe(0);
});

function handlers(
	file: string,
	names: string[],
	context: object
): Record<string, (...args: never[]) => unknown> {
	const source = readFileSync(file, 'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
	const ast = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
	const declarations = names.map((name) => {
		const node = ast.statements.find(
			(n) =>
				ts.isVariableStatement(n) &&
				n.declarationList.declarations.some((d) => d.name.getText(ast) === name)
		);
		if (!node) throw Error('Missing handler ' + name);
		return node.getText(ast).replace(/^export /, '');
	});
	return runInNewContext(
		ts.transpileModule(declarations.join('\n') + '\n({' + names.join(',') + '})', {
			compilerOptions: { target: ts.ScriptTarget.ES2022 }
		}).outputText,
		context
	);
}
const listFile = 'src/lib/components/admin/Evaluations/Feedbacks.svelte';
it('exports metadata chat id, legacy id, numeric zero and CSV escaping', () => {
	const h = handlers(listFile, ['feedbacksToCsv'], {});
	const csv = (h.feedbacksToCsv as (rows: object[]) => string)([
		{
			id: 'f',
			user_id: 'u',
			data: { chat_id: 'legacy', rating: 0, comment: 'a,"b"\rnext' },
			meta: { chat_id: 'current' },
			created_at: 1,
			updated_at: 2
		},
		{
			id: 'g',
			user_id: 'v',
			data: { chat_id: 'legacy', comment: 'one\rtwo' },
			created_at: 3,
			updated_at: 4
		}
	]);
	expect(csv).toContain('f,u,current,,,0');
	expect(csv).toContain('g,v,legacy');
	expect(csv).toContain('"a,""b""\rnext"');
	expect(csv).toContain('"one\rtwo"');
	expect((h.feedbacksToCsv as (rows: object[]) => string)([])).toBe('');
});
it('saves the complete filtered JSON through the actual export handler', async () => {
	const records = [{ id: 'f', snapshot: { chat: { private: 'saved' } }, future: 7 }];
	const saveAs = vi.fn();
	const exportAllFeedbacks = vi.fn(async () => records);
	const h = handlers(listFile, ['exportHandler'], {
		localStorage: { token: 'token' },
		selectedModelId: 'selected',
		exportAllFeedbacks,
		saveAs,
		Blob,
		Date,
		toast: { error: vi.fn() }
	});
	await h.exportHandler();
	expect(exportAllFeedbacks).toHaveBeenCalledWith('token', 'selected');
	expect(JSON.parse(await (saveAs.mock.calls[0][0] as Blob).text())).toEqual(records);
	expect(saveAs.mock.calls[0][1]).toMatch(/^feedback-history-export-\d+\.json$/);
});
it('keeps latest list and cached state on failures without private error disclosure', async () => {
	const queue: ((value: object) => void)[] = [];
	const c = {
		items: [{ id: 'cached' }],
		total: 1,
		orderBy: 'updated_at',
		direction: 'desc',
		page: 1,
		selectedModelId: '',
		listAbort: null as AbortController | null,
		AbortController,
		localStorage: { token: 'token' },
		adminFeedbackCount: { set: vi.fn() },
		toast: { error: vi.fn() },
		$i18n: { t: (s: string) => s },
		console: { error: vi.fn() },
		getFeedbackItems: vi.fn(() => new Promise((resolve) => queue.push(resolve)))
	};
	const h = handlers(listFile, ['getFeedbacks'], c);
	const first = h.getFeedbacks();
	const second = h.getFeedbacks();
	queue[1]({ items: [{ id: 'new' }], total: 2 });
	await second;
	queue[0]({ items: [{ id: 'old' }], total: 3 });
	await first;
	expect(c.items).toEqual([{ id: 'new' }]);
	expect(c.adminFeedbackCount.set).toHaveBeenCalledTimes(1);
	c.getFeedbackItems.mockImplementationOnce(async () => {
		throw Error('private-detail');
	});
	await h.getFeedbacks();
	expect(c.items).toEqual([{ id: 'new' }]);
	expect(c.toast.error).toHaveBeenCalledOnce();
	expect(JSON.stringify(c.toast.error.mock.calls)).not.toContain('private');
});
it('ignores old details and closed selection responses', async () => {
	const queue: ((value: object) => void)[] = [];
	const c = {
		loaded: false,
		feedbackData: null,
		selectedFeedback: { id: 'one' },
		show: true,
		detailsAbort: null as AbortController | null,
		AbortController,
		localStorage: { token: 'token' },
		toast: { error: vi.fn() },
		$i18n: { t: (s: string) => s },
		console: { log: vi.fn() },
		getFeedbackById: vi.fn(() => new Promise((resolve) => queue.push(resolve)))
	};
	const h = handlers('src/lib/components/admin/Evaluations/FeedbackModal.svelte', ['init'], c);
	const first = h.init();
	c.selectedFeedback = { id: 'two' };
	const second = h.init();
	queue[1]({ id: 'two', snapshot: null });
	await second;
	queue[0]({ id: 'one', snapshot: null });
	await first;
	expect(c.feedbackData).toEqual({ id: 'two', snapshot: null });
	const third = h.init();
	c.show = false;
	c.detailsAbort?.abort();
	queue[2]({ id: 'late' });
	await third;
	expect(c.feedbackData).toBeNull();
	expect(c.toast.error).not.toHaveBeenCalled();
});
