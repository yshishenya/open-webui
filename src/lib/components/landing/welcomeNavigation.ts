import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { user } from '$lib/stores';
import { trackEvent } from '$lib/utils/analytics';

export const buildChatUrl = (source: string, params: Record<string, string> = {}): string => {
	const searchParams = new URLSearchParams({ src: source, ...params });
	return `/?${searchParams.toString()}`;
};

export const buildSignupUrl = (source: string, params: Record<string, string> = {}): string => {
	const redirectTarget = buildChatUrl(source, params);
	const searchParams = new URLSearchParams({ redirect: redirectTarget, src: source });

	Object.entries(params).forEach(([key, value]) => {
		searchParams.set(key, value);
	});

	if (params.preset) {
		searchParams.set('preset', params.preset);
	}

	return `/signup?${searchParams.toString()}`;
};

const hasActiveSession = (): boolean => {
	if (get(user)) return true;
	try {
		return Boolean(browser && localStorage.token);
	} catch {
		return false;
	}
};

export const openPreset = (
	source: string,
	preset: string,
	prompt: string,
	model?: string
): void => {
	trackEvent('landing_preset_open', { source, preset });
	const params = { preset, q: prompt, submit: 'false', ...(model ? { model } : {}) };
	const target = buildChatUrl(source, params);

	if (hasActiveSession()) {
		goto(target);
		return;
	}

	if (browser) {
		try {
			sessionStorage.setItem(
				'welcome_preset_prompt',
				JSON.stringify({ preset, prompt, source, createdAt: Date.now() })
			);
		} catch {
			// The redirect URL carries the draft when storage is unavailable.
		}
	}

	goto(buildSignupUrl(source, params));
};

export const openCta = (source: string): void => {
	trackEvent('landing_cta_open', { source });
	const target = buildChatUrl(source);

	if (hasActiveSession()) {
		goto(target);
		return;
	}

	goto(buildSignupUrl(source));
};
