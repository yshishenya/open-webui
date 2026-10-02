// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ANALYTICS_ATTRIBUTION_KEY,
	ANALYTICS_CONSENT_KEY,
	getAnalyticsConsent,
	getAnalyticsConsentChoice,
	FUNNEL_REVOKE_KEY,
	setAnalyticsConsent
} from './analyticsConsent';

describe('analytics consent', () => {
	beforeEach(() => {
		localStorage.clear();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('allows analytics by default without recording an explicit choice', () => {
		expect(getAnalyticsConsent()).toBe('granted');
		expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBeNull();
		expect(getAnalyticsConsentChoice()).toBeNull();
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
	it('respects a saved denial until explicitly allowed again', () => {
		localStorage.setItem(ANALYTICS_CONSENT_KEY, 'denied');
		expect(getAnalyticsConsent()).toBe('denied');
		setAnalyticsConsent('granted');
		expect(getAnalyticsConsent()).toBe('granted');
	});

	it.each([null, 'granted'])(
		'blocks all analytics with an unfinished revoke and choice %s',
		(choice) => {
			if (choice) localStorage.setItem(ANALYTICS_CONSENT_KEY, choice);
			localStorage.setItem(FUNNEL_REVOKE_KEY, 'pending-visitor');
			expect(getAnalyticsConsent()).toBe('denied');
		}
	);

	it('does not override a corrupt or unreadable saved choice', () => {
		localStorage.setItem(ANALYTICS_CONSENT_KEY, 'invalid');
		expect(getAnalyticsConsent()).toBe('denied');
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(getAnalyticsConsent()).toBe('denied');
	});
});
