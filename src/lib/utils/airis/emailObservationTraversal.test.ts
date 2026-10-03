import { describe, expect, it, vi } from 'vitest';
import {
	DiagnosticRequestError,
	type DiagnosticScope,
	type ObservationApi
} from '$lib/apis/airis/emailObservations';
import { DiagnosticTraversal } from './emailObservationTraversal';

vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));

const initial = (): DiagnosticScope => ({
	id: 'scope',
	purpose: 'diagnostic',
	administrative: true,
	declared_at: 100,
	observed_from: null,
	closed_at: null,
	registrations_from: 0,
	registrations_until: 100,
	payments_from: 0,
	payments_until: 200,
	member_count: 50,
	last_run: null
});
const state = (
	cursor = 0,
	status: 'running' | 'completed' | 'failed' = 'running'
): DiagnosticScope => ({
	...initial(),
	observed_from: 101,
	last_run: {
		id: 'run',
		started_at: 101,
		finished_at: status === 'running' ? null : 103,
		status,
		cursor,
		upper_ordinal: 50,
		scanned_members: cursor,
		scanned_scenarios: cursor * 6,
		missing_source_members: 0,
		failure_reason: status === 'failed' ? 'observer_error' : null,
		lease_until: status === 'running' ? Math.floor(Date.now() / 1000) + 180 : null
	}
});
const start = (): ReturnType<ObservationApi['start']> =>
	Promise.resolve({ scope: state(), run_id: 'run', claim_id: 'claim' });

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
	let resolve!: (value: T) => void;
	return {
		promise: new Promise<T>((done) => {
			resolve = done;
		}),
		resolve: (value) => resolve(value)
	};
}

describe('DiagnosticTraversal', () => {
	it('processes only sequential pages and ignores a duplicate run click', async () => {
		const first = deferred<DiagnosticScope>();
		const api: ObservationApi = {
			start: vi.fn(start),
			read: vi.fn(),
			page: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(state(50, 'completed'))
		};
		const traversal = new DiagnosticTraversal(api, vi.fn(), () => 'key');
		const running = traversal.run(initial());
		await vi.waitFor(() => expect(api.page).toHaveBeenCalledTimes(1));
		await traversal.run(initial());
		expect(api.start).toHaveBeenCalledTimes(1);
		expect(traversal.busy).toBe(true);
		first.resolve(state(25));
		await running;
		expect(api.page).toHaveBeenNthCalledWith(1, 'scope', {
			run_id: 'run',
			claim_id: 'claim',
			expected_cursor: 0
		});
		expect(api.page).toHaveBeenNthCalledWith(2, 'scope', {
			run_id: 'run',
			claim_id: 'claim',
			expected_cursor: 25
		});
		expect(traversal.scope?.last_run?.status).toBe('completed');
		expect(traversal.busy).toBe(false);
	});

	it('reads a lost page response and continues from the persisted cursor', async () => {
		const api: ObservationApi = {
			start: vi.fn(start),
			read: vi.fn().mockResolvedValue(state(25)),
			page: vi
				.fn()
				.mockRejectedValueOnce(new Error('network'))
				.mockResolvedValueOnce(state(50, 'completed'))
		};
		const traversal = new DiagnosticTraversal(api, vi.fn());
		await traversal.run(initial());
		expect(api.read).toHaveBeenCalledTimes(1);
		expect(api.page).toHaveBeenLastCalledWith('scope', {
			run_id: 'run',
			claim_id: 'claim',
			expected_cursor: 25
		});
		expect(traversal.error).toBeNull();
	});

	it('pause lets the current request settle without claiming a rollback', async () => {
		const page = deferred<DiagnosticScope>();
		const api: ObservationApi = {
			start: vi.fn(start),
			read: vi.fn(),
			page: vi.fn().mockReturnValue(page.promise)
		};
		const traversal = new DiagnosticTraversal(api, vi.fn());
		const running = traversal.run(initial());
		await vi.waitFor(() => expect(api.page).toHaveBeenCalledTimes(1));
		traversal.stop();
		expect(traversal.busy).toBe(true);
		page.resolve(state(25));
		await running;
		expect(api.page).toHaveBeenCalledTimes(1);
		expect(traversal.scope?.last_run?.cursor).toBe(25);
		expect(traversal.stopping).toBe(true);
	});

	it('uncertain start retains the exact key for replay after a refresh', async () => {
		const api: ObservationApi = {
			start: vi.fn().mockRejectedValueOnce(new Error('lost')).mockImplementationOnce(start),
			read: vi.fn().mockResolvedValue(state()),
			page: vi.fn().mockResolvedValue(state(50, 'completed'))
		};
		const key = vi.fn(() => 'durable-key');
		const traversal = new DiagnosticTraversal(api, vi.fn(), key);
		await traversal.run(initial());
		expect(traversal.error).toBe('unavailable');
		await traversal.run(state());
		expect(key).toHaveBeenCalledTimes(1);
		expect(api.start).toHaveBeenNthCalledWith(1, 'scope', {
			request_key: 'durable-key',
			expected_run_id: null
		});
		expect(api.start).toHaveBeenNthCalledWith(2, 'scope', {
			request_key: 'durable-key',
			expected_run_id: null
		});
	});

	it('busy state shows the saved partial traversal and sends no page', async () => {
		const api: ObservationApi = {
			start: vi.fn().mockRejectedValue(new DiagnosticRequestError(409, 'busy')),
			read: vi.fn().mockResolvedValue(state(25)),
			page: vi.fn()
		};
		const traversal = new DiagnosticTraversal(api, vi.fn());
		await traversal.run(state(25));
		expect(traversal.error).toBe('busy');
		expect(traversal.scope?.last_run?.cursor).toBe(25);
		expect(api.page).not.toHaveBeenCalled();
	});

	it('lost lease drops credentials and acquires a fresh command on the next attempt', async () => {
		const api: ObservationApi = {
			start: vi.fn(start),
			read: vi.fn().mockResolvedValue(state()),
			page: vi
				.fn()
				.mockRejectedValueOnce(new DiagnosticRequestError(409, 'lease_lost'))
				.mockResolvedValueOnce(state(50, 'completed'))
		};
		const traversal = new DiagnosticTraversal(api, vi.fn());
		await traversal.run(initial());
		expect(traversal.error).toBe('conflict');
		await traversal.run(state());
		expect(api.start).toHaveBeenCalledTimes(2);
		expect(traversal.scope?.last_run?.status).toBe('completed');
	});

	it('a failed page followed by an unavailable read preserves explicit uncertainty', async () => {
		const api: ObservationApi = {
			start: vi.fn(start),
			read: vi.fn().mockRejectedValue(new Error('offline')),
			page: vi.fn().mockRejectedValue(new Error('offline'))
		};
		const traversal = new DiagnosticTraversal(api, vi.fn());
		await traversal.run(initial());
		expect(traversal.error).toBe('unavailable');
		expect(traversal.scope?.last_run?.status).toBe('running');
		expect(traversal.busy).toBe(false);
	});

	it('stops on a response with no progress instead of looping', async () => {
		const api: ObservationApi = {
			start: vi.fn(start),
			read: vi.fn(),
			page: vi.fn().mockResolvedValue(state())
		};
		const traversal = new DiagnosticTraversal(api, vi.fn());
		await traversal.run(initial());
		expect(traversal.error).toBe('conflict');
		expect(api.page).toHaveBeenCalledTimes(1);
	});

	it('closed groups are never started', async () => {
		const api: ObservationApi = { start: vi.fn(), read: vi.fn(), page: vi.fn() };
		const traversal = new DiagnosticTraversal(api, vi.fn());
		await traversal.run({ ...initial(), closed_at: 102 });
		expect(api.start).not.toHaveBeenCalled();
	});

	it('closure after a lost response is adopted and never retried as another page', async () => {
		const api: ObservationApi = {
			start: vi.fn(start),
			read: vi.fn().mockResolvedValue({ ...state(0, 'failed'), closed_at: 102 }),
			page: vi.fn().mockRejectedValue(new DiagnosticRequestError(409, 'scope_unavailable'))
		};
		const traversal = new DiagnosticTraversal(api, vi.fn());
		await traversal.run(initial());
		expect(traversal.scope?.closed_at).toBe(102);
		expect(api.page).toHaveBeenCalledTimes(1);
	});
});
