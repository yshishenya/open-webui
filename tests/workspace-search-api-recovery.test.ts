// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { searchWorkspace } from '../src/lib/apis/search';
import { searchRig, response } from './fixtures/workspace-search-actual';

vi.mock('$app/environment', () => ({ browser: false, dev: false }));

afterEach((): void => {
	vi.restoreAllMocks();
});
it('the current search API and actual modal handlers retain and deduplicate rows across 503 retries', async () => {
	const pages: number[] = [];
	const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
		const url = new URL(String(input), 'http://local-fixture.invalid');
		expect(url.pathname).toBe('/api/v1/search');
		expect(url.searchParams.get('q')).toBe('');
		expect(url.searchParams.get('kind')).toBe('all');
		expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture');
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		const page = Number(url.searchParams.get('page'));
		pages.push(page);
		const failed = (page === 1 || page === 2) && pages.filter((n) => n === page).length === 1;
		return new Response(
			JSON.stringify(
				failed
					? { detail: 'Local search failure' }
					: response(page === 1 ? ['retained'] : page === 2 ? ['retained', 'next'] : [], page < 3)
			),
			{ status: failed ? 503 : 200, headers: { 'Content-Type': 'application/json' } }
		);
	});
	const modal = searchRig();
	modal.searchWorkspace.mockImplementation(searchWorkspace);
	await modal.api.fetch(1);
	expect(modal.api.state()).toMatchObject({
		results: [],
		loading: false,
		error: 'Search is unavailable. Please try again.',
		page: 1
	});
	await modal.api.fetch(1);
	await modal.api.fetch(2);
	expect(modal.api.state()).toMatchObject({ loading: false, page: 1 });
	expect(modal.api.state().error).toBeTruthy();
	expect(modal.api.state().results.map((item) => item.id)).toEqual(['retained']);
	await modal.api.fetch(2);
	expect(modal.api.state().error).toBe('');
	expect(modal.api.state().results.map((item) => item.id)).toEqual(['retained', 'next']);
	await modal.api.fetch(3);
	expect(modal.api.state()).toMatchObject({ loading: false, page: 3, hasMore: false });
	expect(pages).toEqual([1, 1, 2, 2, 3]);
	expect(fetch).toHaveBeenCalledTimes(5);
});
