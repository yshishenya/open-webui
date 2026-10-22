import { getBalance, type Balance } from '$lib/apis/billing';

export const WALLET_BALANCE_EVENT = 'airis:wallet-balance';

let pending: { token: string; request: Promise<Balance | null> } | null = null;
let readRevision = 0;

/** A successful write makes every earlier wallet snapshot obsolete. */
export const invalidateWalletBalanceReads = (token: string): void => {
	if (localStorage.token !== token) return;
	readRevision += 1;
	if (pending?.token === token) pending = null;
};

/** The header and wallet join the same read instead of racing independent snapshots. */
export const loadWalletBalance = (token: string, fresh = false): Promise<Balance | null> => {
	if (!token || localStorage.token !== token) return Promise.resolve(null);
	if (pending?.token === token) {
		if (!fresh) return pending.request;
		return pending.request.catch(() => null).then(() => loadWalletBalance(token));
	}
	const revision = readRevision;
	const request: Promise<Balance | null> = getBalance(token)
		.then(
			(balance) => {
				if (localStorage.token !== token) return null;
				if (revision !== readRevision) return loadWalletBalance(token);
				publishWalletBalance(balance);
				return balance;
			},
			(error: unknown) => {
				if (localStorage.token !== token) return null;
				if (revision !== readRevision) return loadWalletBalance(token);
				publishWalletBalance(null);
				throw error;
			}
		)
		.finally(() => {
			if (pending?.request === request) pending = null;
		});
	pending = { token, request };
	return request;
};

/** Publish only an authenticated read, never an optimistic payment amount. */
export const publishWalletBalance = (balance: Balance | null): void => {
	window.dispatchEvent(new CustomEvent<Balance | null>(WALLET_BALANCE_EVENT, { detail: balance }));
};

export const focusWalletSection = (id: string): void => {
	const section = document.getElementById(id);
	if (!section) return;
	const target =
		section.querySelector<HTMLElement>(
			'input:not(:disabled), select:not(:disabled), button:not(:disabled), [role="switch"]'
		) ?? section;
	if (target === section) section.tabIndex = -1;
	target.focus({ preventScroll: true });
	section.scrollIntoView?.({
		behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
		block: 'start'
	});
};
