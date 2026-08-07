export type AnalyticsConsent = 'granted' | 'denied' | null;

export const ANALYTICS_CONSENT_KEY = 'airis.analytics.consent.v1';
export const ANALYTICS_CONSENT_EVENT = 'airis:analytics-consent-changed';

const isBrowser = (): boolean => typeof window !== 'undefined';

export const getAnalyticsConsent = (): AnalyticsConsent => {
	if (!isBrowser()) return null;

	const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
	return value === 'granted' || value === 'denied' ? value : null;
};

export const setAnalyticsConsent = (consent: Exclude<AnalyticsConsent, null>): void => {
	if (!isBrowser()) return;

	window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
	window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: consent }));
};
