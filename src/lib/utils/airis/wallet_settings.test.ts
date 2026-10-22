// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Balance } from '$lib/apis/billing';
import {
	focusWalletSection,
	invalidateWalletBalanceReads,
	loadWalletBalance,
	WALLET_BALANCE_EVENT
} from './wallet_settings';

const { getBalance } = vi.hoisted(() => ({ getBalance: vi.fn() }));
vi.mock('$lib/apis/billing', () => ({ getBalance }));

afterEach(() => {
	document.body.replaceChildren();
	vi.unstubAllGlobals();
	getBalance.mockReset();
});

describe('shared wallet reads', () => {
	it.each(['resolve', 'reject'])('discards a pre-write GET that later %s', async (outcome) => {
		localStorage.token = 'wallet-token';
		const stale: Balance = {
			balance_topup_kopeks: 1000,
			balance_included_kopeks: 0,
			daily_spent_kopeks: 0,
			currency: 'RUB'
		};
		const confirmed: Balance = { ...stale, max_reply_cost_kopeks: 2500 };
		let finish: () => void = () => {};
		getBalance
			.mockImplementationOnce(
				() =>
					new Promise<Balance>((resolve, reject) => {
						finish = () =>
							outcome === 'resolve' ? resolve(stale) : reject(new Error('old network error'));
					})
			)
			.mockResolvedValue(confirmed);
		const receive = vi.fn();
		window.addEventListener(WALLET_BALANCE_EVENT, receive);
		try {
			const earlier = loadWalletBalance('wallet-token');
			invalidateWalletBalanceReads('wallet-token');
			const afterWrite = loadWalletBalance('wallet-token');
			expect(getBalance).toHaveBeenCalledTimes(2);
			expect(await afterWrite).toBe(confirmed);
			finish();
			expect(await earlier).toBe(confirmed);
			expect(
				receive.mock.calls.every(([event]) => (event as CustomEvent<Balance>).detail === confirmed)
			).toBe(true);
		} finally {
			window.removeEventListener(WALLET_BALANCE_EVENT, receive);
		}
	});
	it('joins concurrent authenticated reads and publishes only the server snapshot', async () => {
		localStorage.token = 'wallet-token';
		const snapshot: Balance = {
			balance_topup_kopeks: 50000,
			balance_included_kopeks: 0,
			daily_spent_kopeks: 0,
			currency: 'RUB'
		};
		let resolve: (value: Balance) => void = () => {};
		getBalance.mockReturnValue(
			new Promise<Balance>((done) => {
				resolve = done;
			})
		);
		const receive = vi.fn();
		window.addEventListener(WALLET_BALANCE_EVENT, receive);
		try {
			const first = loadWalletBalance('wallet-token');
			const second = loadWalletBalance('wallet-token');
			expect(first).toBe(second);
			expect(getBalance).toHaveBeenCalledTimes(1);
			expect(receive).not.toHaveBeenCalled();
			resolve(snapshot);
			expect(await first).toBe(snapshot);
			expect((receive.mock.calls[0][0] as CustomEvent<Balance>).detail).toBe(snapshot);
		} finally {
			window.removeEventListener(WALLET_BALANCE_EVENT, receive);
		}
	});
	it('does not publish an earlier account snapshot after authentication changes', async () => {
		localStorage.token = 'old-token';
		let resolve: (value: Balance | null) => void = () => {};
		getBalance.mockReturnValue(
			new Promise<Balance | null>((done) => {
				resolve = done;
			})
		);
		const receive = vi.fn();
		window.addEventListener(WALLET_BALANCE_EVENT, receive);
		try {
			const first = loadWalletBalance('old-token');
			localStorage.token = 'new-token';
			resolve(null);
			await first;
			expect(receive).not.toHaveBeenCalled();
		} finally {
			window.removeEventListener(WALLET_BALANCE_EVENT, receive);
		}
	});
});

describe('wallet section focus', () => {
	it.each([true, false])(
		'moves focus to the first enabled control; reduced motion %s',
		(reduced) => {
			vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
			const section = document.createElement('section');
			section.id = 'section';
			const disabled = document.createElement('input');
			disabled.disabled = true;
			const control = document.createElement('button');
			section.append(disabled, control);
			document.body.append(section);
			const scroll = vi.fn();
			section.scrollIntoView = scroll;
			focusWalletSection('section');
			expect(document.activeElement).toBe(control);
			expect(scroll).toHaveBeenCalledWith({
				behavior: reduced ? 'auto' : 'smooth',
				block: 'start'
			});
		}
	);
});
