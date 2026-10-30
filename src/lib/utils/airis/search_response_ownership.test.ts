// @vitest-environment node
import { expect, it, vi } from 'vitest';
import {
	searchRig,
	response,
	result,
	deferred
} from '../../../../tests/fixtures/workspace-search-actual';
it.each(['resolve', 'reject'] as const)(
	'late search %s cannot overwrite a newer query',
	async (mode) => {
		const s = searchRig();
		const old = deferred<ReturnType<typeof response>>();
		s.searchWorkspace.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(['current']));
		const pending = s.api.fetch(1);
		s.api.change({ query: 'current' });
		await s.api.fetch(1);
		if (mode === 'resolve') old.resolve(response(['stale']));
		else old.reject(new Error('late'));
		await pending;
		expect(s.api.state().results.map((r) => r.id)).toEqual(['current']);
		expect(s.api.state()).toMatchObject({ loading: false, error: '' });
		expect(s.searchWorkspace.mock.calls[0][2].aborted).toBe(true);
	}
);
it.each(['close', 'destroy', 'session'] as const)('discards responses after %s', async (mode) => {
	const s = searchRig();
	const waiting = deferred<ReturnType<typeof response>>();
	s.searchWorkspace.mockReturnValueOnce(waiting.promise);
	const pending = s.api.fetch(1);
	if (mode === 'close') s.api.close();
	if (mode === 'destroy') s.destroy();
	if (mode === 'session') s.storage.token = 'new-session';
	waiting.resolve(response(['private']));
	await pending;
	expect(s.api.state().results).toEqual([]);
	if (mode !== 'session') expect(s.searchWorkspace.mock.calls[0][2].aborted).toBe(true);
});
it.each(['close', 'destroy', 'session'] as const)(
	'suppresses late errors after %s',
	async (mode) => {
		const s = searchRig();
		const waiting = deferred<ReturnType<typeof response>>();
		s.searchWorkspace.mockReturnValueOnce(waiting.promise);
		const pending = s.api.fetch(1);
		if (mode === 'close') s.api.close();
		if (mode === 'destroy') s.destroy();
		if (mode === 'session') s.storage.token = 'new-session';
		waiting.reject(new Error('late failure'));
		await pending;
		expect(s.api.state().error).toBe('');
	}
);
it('new filter search clears the previous selection and rows', async () => {
	vi.useFakeTimers();
	try {
		const s = searchRig();
		s.searchWorkspace
			.mockResolvedValueOnce(response(['a', 'b']))
			.mockResolvedValueOnce(response(['note']));
		await s.api.fetch(1);
		await s.api.select(1);
		s.api.change({ kind: 'note' });
		s.api.schedule();
		expect(s.api.state()).toMatchObject({ results: [], selectedIndex: 0, page: 1 });
		await vi.runAllTimersAsync();
		expect(s.api.state().results[0].id).toBe('note');
	} finally {
		vi.useRealTimers();
	}
});
it('selection clamps indices and scrolls only the selected row', async () => {
	const s = searchRig();
	s.searchWorkspace.mockResolvedValueOnce(response(['a', 'b']));
	await s.api.fetch(1);
	const scrollIntoView = vi.fn(),
		querySelector = vi.fn(() => ({ scrollIntoView }));
	s.api.scroll({ querySelector });
	await s.api.select(99);
	expect(s.api.state().selectedIndex).toBe(1);
	expect(querySelector).toHaveBeenCalledWith('[data-index="1"]');
	await s.api.select(-1);
	expect(s.api.state().selectedIndex).toBe(0);
});
it('opens the exact selected URL then closes its request ownership', async () => {
	const s = searchRig();
	await s.api.open(result('chat'));
	expect(s.goto).toHaveBeenCalledWith('/c/chat');
	expect(s.onClose).toHaveBeenCalledOnce();
	expect(s.api.state().show).toBe(false);
});
