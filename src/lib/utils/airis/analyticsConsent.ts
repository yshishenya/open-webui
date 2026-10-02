export type AnalyticsConsent = 'granted' | 'denied' | null;

export const ANALYTICS_CONSENT_KEY = 'airis.analytics.consent.v1';
export const ANALYTICS_NOTICE_KEY = 'airis.analytics.notice.v1';
export const FUNNEL_REVOKE_KEY = 'airis.analytics.revoke.v1';
export const ANALYTICS_ATTRIBUTION_KEY = 'airis.analytics.attribution.v1';
export const ANALYTICS_CONSENT_EVENT = 'airis:analytics-consent-changed';
export const ANALYTICS_SETTINGS_EVENT = 'airis:analytics-settings-open';

const isBrowser = (): boolean => typeof window !== 'undefined';
let unsavedDenial = false;

export const getAnalyticsConsentChoice = (): AnalyticsConsent => {
	if (!isBrowser()) return null;
	if (unsavedDenial) return 'denied';

	try {
		const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
		if (value === null) return null;
		return value === 'granted' ? 'granted' : 'denied';
	} catch {
		return 'denied';
	}
};

// An absent choice permits analytics; an unreadable choice or unfinished opt-out does not.
export const getAnalyticsConsent = (): AnalyticsConsent => {
	if (!isBrowser()) return null;
	try {
		if (window.localStorage.getItem(FUNNEL_REVOKE_KEY)) return 'denied';
		return getAnalyticsConsentChoice() ?? 'granted';
	} catch {
		return 'denied';
	}
};

export const setAnalyticsConsent = (consent: Exclude<AnalyticsConsent, null>): void => {
	if (!isBrowser()) return;

	unsavedDenial = true;
	try {
		if (consent === 'denied') window.localStorage.removeItem(ANALYTICS_ATTRIBUTION_KEY);
		window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
		unsavedDenial = false;
	} finally {
		// Stop this page even when persistence fails; callers must not reload an unsaved denial.
		window.dispatchEvent(
			new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: getAnalyticsConsent() })
		);
	}
};
