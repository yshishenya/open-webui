import { expect, it } from 'vitest';
import {
	subscriptionPeriodEnded,
	subscriptionStatusLabel
} from './admin_billing_subscription_display';

it.each([
	['active', 'Active'],
	['trialing', 'Trial'],
	['canceled', 'Canceled'],
	['past_due', 'Past Due'],
	['incomplete', 'Incomplete'],
	['incomplete_expired', 'Expired'],
	['expired', 'Expired'],
	['pending', 'Pending'],
	['paused', 'Paused'],
	['unknown_future_status', 'Status unavailable']
])('maps stored status %s to the existing translation key %s', (status, label) => {
	expect(subscriptionStatusLabel(status)).toBe(label);
});

it.each<[number | null | undefined, boolean]>([
	[99, true],
	[100, true],
	[101, false],
	[null, false],
	[undefined, false],
	[0, false],
	[-1, false],
	[NaN, false],
	[Infinity, false]
])('classifies the period end %s without inventing an access decision', (end, ended) => {
	expect(subscriptionPeriodEnded(end, 100)).toBe(ended);
});
