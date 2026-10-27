import { beforeNavigate } from '$app/navigation';
import { updated } from '$app/state';
import type { BeforeNavigate } from '@sveltejs/kit';

// Register during component initialization, just like beforeNavigate itself.
export const registerBillingDraftGuard = (
	isDirty: () => boolean,
	confirmDiscard: () => boolean,
	discardsDraft: (navigation: BeforeNavigate) => boolean = (navigation) =>
		updated.current || navigation.from?.url.pathname !== navigation.to?.url.pathname
): void => {
	beforeNavigate((navigation) => {
		if (!isDirty()) return;
		if (navigation.willUnload || (discardsDraft(navigation) && !confirmDiscard())) {
			navigation.cancel();
		}
	});
};
