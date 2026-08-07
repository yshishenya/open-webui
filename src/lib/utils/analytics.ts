export type AnalyticsPayload = Record<string, string | number | boolean>;

export type AnalyticsPurchase = {
	id: string;
	revenue: number;
	currency: string;
};

type StoredAttribution = {
	values: Record<string, string>;
	capturedAt: number;
};

import { getAnalyticsConsent } from '$lib/utils/airis/analyticsConsent';
import { PUBLIC_GA_MEASUREMENT_ID, PUBLIC_YANDEX_METRICA_ID } from '$env/static/public';

const YANDEX_METRICA_ID = PUBLIC_YANDEX_METRICA_ID?.trim();
const GA_MEASUREMENT_ID = PUBLIC_GA_MEASUREMENT_ID?.trim();
const ATTRIBUTION_STORAGE_KEY = 'airis.analytics.attribution.v1';
const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const ATTRIBUTION_KEYS = [
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_content',
	'utm_term',
	'gclid',
	'yclid',
	'ymclid'
] as const;
const SENSITIVE_KEY = /(email|name|prompt|content|message|token|secret|password|url|query)/i;
const MAX_STRING_LENGTH = 80;
const LANDING_CTA_EVENTS = new Set([
	'welcome_header_cta_click',
	'welcome_how_cta_click',
	'welcome_usecases_cta_click',
	'welcome_pricing_cta_click',
	'welcome_faq_cta_click',
	'welcome_features_try_click',
	'welcome_examples_try_click',
	'features_hero_primary_click',
	'features_final_cta_click',
	'features_sticky_cta_click',
	'features_how_cta_click',
	'features_preset_try_click',
	'pricing_hero_primary_click',
	'pricing_final_cta_click',
	'pricing_estimator_primary_click',
	'pricing_free_start_click',
	'about_hero_cta_click',
	'support_contact_click',
	'landing_cta_open',
	'public_header_cta_click',
	'features_hero_primary',
	'features_final_cta',
	'features_sticky_cta',
	'features_how_cta'
]);
const FUNNEL_GOAL_EVENTS: Record<string, string> = {
	signup_form_viewed: 'lead_signup_form_viewed',
	signup_started: 'lead_signup_started',
	signup_completed: 'lead_signup_completed',
	first_prompt_submitted: 'activation_first_prompt',
	first_response_received: 'activation_first_response',
	billing_topup_completed: 'revenue_topup_completed'
};

type AnalyticsWindow = Window & {
	dataLayer?: Array<Record<string, unknown>>;
	gtag?: (...args: unknown[]) => void;
	ym?: (counterId: string, method: string, ...args: unknown[]) => void;
	posthog?: { capture?: (...args: unknown[]) => void };
	__airisAnalyticsInitialized?: boolean;
	__airisAnalyticsScripts?: { yandex?: boolean; google?: boolean };
};

const sanitizePayload = (payload: AnalyticsPayload): AnalyticsPayload => {
	const sanitized: AnalyticsPayload = {};
	for (const [key, value] of Object.entries(payload)) {
		if (SENSITIVE_KEY.test(key)) continue;
		if (typeof value === 'string') {
			const normalized = value
				.replace(/[\r\n]/g, ' ')
				.trim()
				.slice(0, MAX_STRING_LENGTH);
			if (normalized) sanitized[key] = normalized;
			continue;
		}
		if (typeof value === 'number' && !Number.isFinite(value)) continue;
		sanitized[key] = value;
	}
	return sanitized;
};

const normalizeAttributionValue = (value: string | null): string | null => {
	const normalized = value?.replace(/[\r\n]/g, ' ').trim().slice(0, MAX_STRING_LENGTH);
	return normalized || null;
};

export const captureAttribution = (): void => {
	if (typeof window === 'undefined') return;

	const values: Record<string, string> = {};
	const params = new URLSearchParams(window.location.search);
	for (const key of ATTRIBUTION_KEYS) {
		const value = normalizeAttributionValue(params.get(key));
		if (value) values[key] = value;
	}
	if (!Object.keys(values).length) return;

	try {
		window.localStorage.setItem(
			ATTRIBUTION_STORAGE_KEY,
			JSON.stringify({ values, capturedAt: Date.now() } satisfies StoredAttribution)
		);
	} catch {
		// Analytics must never block navigation when storage is unavailable.
	}
};

const readAttribution = (): AnalyticsPayload => {
	if (typeof window === 'undefined') return {};

	try {
		const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
		if (!raw) return {};
		const stored = JSON.parse(raw) as Partial<StoredAttribution>;
		if (
			typeof stored.capturedAt !== 'number' ||
			Date.now() - stored.capturedAt > ATTRIBUTION_TTL_MS ||
			typeof stored.values !== 'object' ||
			stored.values === null
		) {
			window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
			return {};
		}
		return Object.fromEntries(
			ATTRIBUTION_KEYS.flatMap((key) => {
				const value = normalizeAttributionValue(stored.values?.[key] ?? null);
				return value ? [[key, value]] : [];
			})
		);
	} catch {
		return {};
	}
};

const loadScript = (src: string, id: string): void => {
	if (document.getElementById(id)) return;
	const script = document.createElement('script');
	script.id = id;
	script.async = true;
	script.src = src;
	document.head.appendChild(script);
};

const initializeYandex = (analyticsWindow: AnalyticsWindow): void => {
	if (!YANDEX_METRICA_ID || analyticsWindow.__airisAnalyticsScripts?.yandex) return;

	analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
	analyticsWindow.ym =
		analyticsWindow.ym ||
		((...args: unknown[]) => {
			(analyticsWindow.ym as unknown as { a?: unknown[] }).a ??= [];
			(analyticsWindow.ym as unknown as { a: unknown[] }).a.push(args);
		});
	loadScript(
		`https://mc.yandex.ru/metrika/tag.js?id=${encodeURIComponent(YANDEX_METRICA_ID)}`,
		'airis-yandex-metrica'
	);
	analyticsWindow.ym(YANDEX_METRICA_ID, 'init', {
		webvisor: true,
		clickmap: true,
		trackLinks: true,
		accurateTrackBounce: true,
		ecommerce: 'dataLayer',
		trackHash: true,
		sendTitle: false
	});
	analyticsWindow.__airisAnalyticsScripts = {
		...analyticsWindow.__airisAnalyticsScripts,
		yandex: true
	};
};

const initializeGoogle = (analyticsWindow: AnalyticsWindow): void => {
	if (!GA_MEASUREMENT_ID || analyticsWindow.__airisAnalyticsScripts?.google) return;

	analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
	analyticsWindow.gtag =
		analyticsWindow.gtag ||
		((...args: unknown[]) => {
			analyticsWindow.dataLayer?.push({ event: 'gtag', args });
		});
	analyticsWindow.gtag('js', new Date());
	analyticsWindow.gtag('consent', 'update', {
		analytics_storage: 'granted',
		ad_storage: 'denied',
		ad_user_data: 'denied',
		ad_personalization: 'denied'
	});
	analyticsWindow.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false, anonymize_ip: true });
	loadScript(
		`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`,
		'airis-google-analytics'
	);
	analyticsWindow.__airisAnalyticsScripts = {
		...analyticsWindow.__airisAnalyticsScripts,
		google: true
	};
};

export const initializeAnalytics = (): void => {
	if (typeof window === 'undefined' || getAnalyticsConsent() !== 'granted') return;

	const analyticsWindow = window as AnalyticsWindow;
	if (analyticsWindow.__airisAnalyticsInitialized) return;
	initializeYandex(analyticsWindow);
	initializeGoogle(analyticsWindow);
	analyticsWindow.__airisAnalyticsInitialized = true;
};

export const trackPageView = (): void => {
	if (typeof window === 'undefined' || getAnalyticsConsent() !== 'granted') return;

	captureAttribution();
	initializeAnalytics();
	const analyticsWindow = window as AnalyticsWindow;
	const pagePath = `${window.location.pathname}${window.location.hash}`;
	if (YANDEX_METRICA_ID) analyticsWindow.ym?.(YANDEX_METRICA_ID, 'hit', pagePath);
	if (GA_MEASUREMENT_ID) {
		analyticsWindow.gtag?.('event', 'page_view', {
			page_path: pagePath
		});
	}
};

export const trackEcommercePurchase = (purchase: AnalyticsPurchase): void => {
	if (
		typeof window === 'undefined' ||
		getAnalyticsConsent() !== 'granted' ||
		!YANDEX_METRICA_ID ||
		!Number.isFinite(purchase.revenue) ||
		purchase.revenue <= 0 ||
		!purchase.id
	) {
		return;
	}

	initializeAnalytics();
	const analyticsWindow = window as AnalyticsWindow;
	const purchaseKey = `airis.analytics.purchase.${purchase.id}`;
	try {
		if (window.sessionStorage.getItem(purchaseKey)) return;
		window.sessionStorage.setItem(purchaseKey, '1');
	} catch {
		// Continue when storage is unavailable; the payment flow remains functional.
	}
	analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
	analyticsWindow.dataLayer.push({
		ecommerce: {
			currencyCode: purchase.currency,
			purchase: {
				actionField: { id: purchase.id, revenue: purchase.revenue },
				products: [
					{
						id: 'airis_wallet_topup',
						name: 'Airis wallet top-up',
						price: purchase.revenue,
						quantity: 1
					}
				]
			}
		}
	});
};

export const trackEvent = (event: string, payload: AnalyticsPayload = {}): void => {
	if (typeof window === 'undefined') {
		return;
	}

	const safePayload = sanitizePayload({ ...readAttribution(), ...payload });
	const detail = { event, ...safePayload };
	const analyticsWindow = window as AnalyticsWindow;
	const consentGranted = getAnalyticsConsent() === 'granted';

	if (consentGranted) {
		initializeAnalytics();
		analyticsWindow.dataLayer?.push(detail);
		analyticsWindow.gtag?.('event', event, safePayload);
		const goalEvents = new Set([event]);
		if (LANDING_CTA_EVENTS.has(event)) goalEvents.add('landing_cta_click');
		const funnelGoal = FUNNEL_GOAL_EVENTS[event];
		if (funnelGoal) goalEvents.add(funnelGoal);
		for (const goalEvent of goalEvents) {
			if (goalEvent !== event) {
				analyticsWindow.dataLayer?.push({ event: goalEvent, ...safePayload });
				analyticsWindow.gtag?.('event', goalEvent, safePayload);
			}
			if (YANDEX_METRICA_ID) {
				analyticsWindow.ym?.(YANDEX_METRICA_ID, 'reachGoal', goalEvent, safePayload);
			}
		}
		analyticsWindow.posthog?.capture?.(event, safePayload);
	}
	window.dispatchEvent(new CustomEvent('analytics', { detail }));
};
