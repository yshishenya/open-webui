/** Presentation only: the stored status is not an access decision. */
export const subscriptionStatusLabel = (status: string): string =>
	(
		({
			active: 'Active',
			trialing: 'Trial',
			canceled: 'Canceled',
			past_due: 'Past Due',
			incomplete: 'Incomplete',
			incomplete_expired: 'Expired',
			expired: 'Expired',
			pending: 'Pending',
			paused: 'Paused'
		}) as Record<string, string>
	)[status] || 'Status unavailable';

export const subscriptionPeriodEnded = (
	periodEnd: number | null | undefined,
	now = Date.now() / 1000
): boolean =>
	typeof periodEnd === 'number' && Number.isFinite(periodEnd) && periodEnd > 0 && periodEnd <= now;
