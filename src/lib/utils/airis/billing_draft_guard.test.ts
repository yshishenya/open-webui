import { beforeEach, expect, it, vi } from 'vitest';
import type { BeforeNavigate } from '@sveltejs/kit';
import { registerBillingDraftGuard } from './billing_draft_guard';

const mocks = vi.hoisted(() => ({ beforeNavigate: vi.fn(), updated: { current: false } }));
vi.mock('$app/navigation', () => ({ beforeNavigate: mocks.beforeNavigate }));
vi.mock('$app/state', () => ({ updated: mocks.updated }));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.updated.current = false;
});

it('guards dirty departures and unloads, but retains harmless same-page transitions', () => {
	let dirty = false;
	const confirm = vi.fn(() => false);
	registerBillingDraftGuard(() => dirty, confirm);
	const navigate = mocks.beforeNavigate.mock.calls[0][0] as (value: BeforeNavigate) => void;
	const cancel = vi.fn();
	const departure = {
		from: { url: new URL('http://localhost/billing/balance?focus=limits') },
		to: { url: new URL('http://localhost/billing/history') },
		willUnload: false,
		cancel
	} as unknown as BeforeNavigate;
	navigate(departure);
	expect(cancel).not.toHaveBeenCalled();
	dirty = true;
	navigate(departure);
	expect(cancel).toHaveBeenCalledTimes(1);
	expect(confirm).toHaveBeenCalledTimes(1);
	confirm.mockReturnValue(true);
	navigate(departure);
	expect(cancel).toHaveBeenCalledTimes(1);
	const retained = { ...departure, to: departure.from };
	confirm.mockReturnValue(false);
	navigate(retained);
	expect(confirm).toHaveBeenCalledTimes(2);
	navigate({ ...retained, willUnload: true });
	expect(cancel).toHaveBeenCalledTimes(2);
	expect(confirm).toHaveBeenCalledTimes(2); // SvelteKit requests native unload confirmation.
	mocks.updated.current = true;
	navigate(retained);
	expect(cancel).toHaveBeenCalledTimes(3); // Even a query transition will now reload the document.
});

it('allows an editor to identify same-route changes that discard its draft', () => {
	const cancel = vi.fn();
	registerBillingDraftGuard(
		() => true,
		() => false,
		() => true
	);
	const navigate = mocks.beforeNavigate.mock.calls[0][0] as (value: BeforeNavigate) => void;
	navigate({ willUnload: false, cancel } as unknown as BeforeNavigate);
	expect(cancel).toHaveBeenCalledOnce();
});
