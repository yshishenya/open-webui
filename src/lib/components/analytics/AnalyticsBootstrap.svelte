<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ANALYTICS_CONSENT_EVENT, getAnalyticsConsent } from '$lib/utils/airis/analyticsConsent';
	import { initializeAnalytics, trackEvent, trackPageView } from '$lib/utils/analytics';

	const SCROLL_THRESHOLDS = [25, 50, 75, 90];
	let trackedScrollDepths = new Set<number>();
	let lastTrackedPagePath = '';

	const resetScrollDepth = (): void => {
		trackedScrollDepths = new Set<number>();
	};

	const trackScrollDepth = (): void => {
		if (getAnalyticsConsent() !== 'granted') return;

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
		if (getAnalyticsConsent() !== 'granted') return;
		const pagePath = `${window.location.pathname}${window.location.hash}`;
		if (pagePath === lastTrackedPagePath) return;
		lastTrackedPagePath = pagePath;
		initializeAnalytics();
		trackPageView();
	};

	onMount(() => {
		syncAnalytics();
		window.addEventListener('scroll', trackScrollDepth, { passive: true });
		window.addEventListener(ANALYTICS_CONSENT_EVENT, syncAnalytics);
		return () => {
			window.removeEventListener('scroll', trackScrollDepth);
			window.removeEventListener(ANALYTICS_CONSENT_EVENT, syncAnalytics);
		};
	});

	afterNavigate(() => {
		resetScrollDepth();
		syncAnalytics();
	});
</script>
