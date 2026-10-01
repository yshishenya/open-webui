<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		ANALYTICS_CONSENT_EVENT,
		ANALYTICS_CONSENT_KEY,
		getAnalyticsConsent
	} from '$lib/utils/airis/analyticsConsent';
	import {
		captureAttribution,
		initializeAnalytics,
		trackEvent,
		trackPageView
	} from '$lib/utils/analytics';

	import { user } from '$lib/stores';
	import {
		revokeFunnelConsent,
		syncFunnelIdentity,
		trackFunnelEvent
	} from '$lib/utils/airis/funnelAnalytics';

	const SCROLL_THRESHOLDS = [25, 50, 75, 90];
	let trackedScrollDepths = new Set<number>();
	let lastTrackedPagePath = '';

	const resetScrollDepth = (): void => {
		trackedScrollDepths = new Set<number>();
	};

	const trackScrollDepth = (): void => {
		if (window.location.pathname === '/unsubscribe' || getAnalyticsConsent() !== 'granted') return;

		const documentHeight = Math.max(
			document.body.scrollHeight,
			document.documentElement.scrollHeight
		);
		const scrollableHeight = Math.max(documentHeight - window.innerHeight, 0);
		const depth = scrollableHeight === 0 ? 100 : (window.scrollY / scrollableHeight) * 100;

		for (const threshold of SCROLL_THRESHOLDS) {
			if (depth >= threshold && !trackedScrollDepths.has(threshold)) {
				trackedScrollDepths.add(threshold);
				trackEvent('page_scroll_depth', { depth_percent: threshold });
			}
		}
	};

	const syncAnalytics = (): void => {
		if (window.location.pathname === '/unsubscribe') return;
		captureAttribution();
		if (getAnalyticsConsent() !== 'granted') return;
		const pagePath = window.location.pathname;
		if (pagePath === lastTrackedPagePath) return;
		lastTrackedPagePath = pagePath;
		initializeAnalytics();
		trackPageView();
		syncFunnelIdentity($user?.id ?? null);
		trackFunnelEvent('product_first_visit');
	};

	const syncOtherTabConsent = (event: StorageEvent): void => {
		if (event.key !== ANALYTICS_CONSENT_KEY) return;
		if (event.newValue === 'denied') {
			void revokeFunnelConsent()
				.catch(() => undefined)
				.finally(() => window.location.reload());
		} else syncAnalytics();
	};

	onMount(() => {
		syncAnalytics();
		const unsubscribeUser = user.subscribe((sessionUser) =>
			syncFunnelIdentity(sessionUser?.id ?? null)
		);
		window.addEventListener('storage', syncOtherTabConsent);
		window.addEventListener('scroll', trackScrollDepth, { passive: true });
		window.addEventListener(ANALYTICS_CONSENT_EVENT, syncAnalytics);
		return () => {
			unsubscribeUser();
			window.removeEventListener('storage', syncOtherTabConsent);
			window.removeEventListener('scroll', trackScrollDepth);
			window.removeEventListener(ANALYTICS_CONSENT_EVENT, syncAnalytics);
		};
	});

	afterNavigate(() => {
		resetScrollDepth();
		syncAnalytics();
	});
</script>
