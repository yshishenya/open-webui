export type AnalyticsPayload = Record<string, string | number | boolean>;

export const trackEvent = (event: string, payload: AnalyticsPayload = {}): void => {
	if (typeof window === 'undefined') {
		return;
	}

	const detail = { event, ...payload };
	const analyticsWindow = window as typeof window & {
		dataLayer?: Array<Record<string, unknown>>;
		gtag?: (...args: unknown[]) => void;
		posthog?: { capture?: (...args: unknown[]) => void };
	};

	analyticsWindow.dataLayer?.push(detail);
	if (typeof analyticsWindow.gtag === 'function') {
		analyticsWindow.gtag('event', event, payload);
	}
	analyticsWindow.posthog?.capture?.(event, payload);
	window.dispatchEvent(new CustomEvent('analytics', { detail }));
};
