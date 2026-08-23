// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
	ANALYTICS_ATTRIBUTION_KEY,
	ANALYTICS_CONSENT_KEY,
	getAnalyticsConsent,
	setAnalyticsConsent
} from './analyticsConsent';

describe('analytics consent', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('starts unset and persists a single choice', () => {
		expect(getAnalyticsConsent()).toBeNull();
		setAnalyticsConsent('granted');
		expect(getAnalyticsConsent()).toBe('granted');
		expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('granted');
	});

	it('allows a later denial without changing the storage contract', () => {
		setAnalyticsConsent('granted');
		localStorage.setItem(ANALYTICS_ATTRIBUTION_KEY, '{"utm_source":"test"}');
		setAnalyticsConsent('denied');
		expect(getAnalyticsConsent()).toBe('denied');
		expect(localStorage.getItem(ANALYTICS_ATTRIBUTION_KEY)).toBeNull();
	});
});
