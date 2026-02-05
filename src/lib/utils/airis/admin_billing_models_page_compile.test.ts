// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

type Store<T> = { subscribe: (run: (value: T) => void) => () => void };

const createStore = function <T>(value: T): Store<T> {
	return {
		subscribe(run) {
			run(value);
			return () => {};
		}
	};
};

vi.mock('$app/navigation', () => ({ goto: vi.fn() }), { virtual: true });

vi.mock(
	'$lib/stores',
	() => ({
		WEBUI_NAME: createStore('Airis'),
		user: createStore({ role: 'admin' })
	}),
	{ virtual: true }
);

vi.mock('$lib/apis', () => ({ getModels: vi.fn().mockResolvedValue([]) }), { virtual: true });

vi.mock(
	'$lib/apis/models',
	() => ({
		createNewModel: vi.fn().mockResolvedValue({ id: 'mock' }),
		getBaseModels: vi.fn().mockResolvedValue([]),
		updateModelById: vi.fn().mockResolvedValue({ id: 'mock' })
	}),
	{ virtual: true }
);

vi.mock(
	'$lib/apis/admin/billing',
	() => ({
		applyRateCardsXlsxImport: vi.fn(),
		createRateCard: vi.fn(),
		deleteRateCardsByModel: vi.fn(),
		deactivateRateCardsByModel: vi.fn(),
		exportRateCardsXlsx: vi.fn(),
		listRateCards: vi.fn().mockResolvedValue({ items: [], total_pages: 1 }),
		previewRateCardsXlsxImport: vi.fn(),
		updateRateCard: vi.fn()
	}),
	{ virtual: true }
);

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }), {
	virtual: true
});

describe('admin billing models page', () => {
	it(
		'imports without compile errors',
		async () => {
			const mod = await import('../../../routes/(app)/admin/billing/models/+page.svelte');
			expect(mod.default).toBeTruthy();
		},
		30_000
	);
});
