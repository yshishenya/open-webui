import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { user } from '$lib/stores';

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

export const openPreset = (source: string, preset: string, prompt: string): void => {
	const target = buildChatUrl(source, { preset, q: prompt, submit: 'false' });

	if (get(user)) {
		goto(target);
		return;
	}

	if (browser) {
		sessionStorage.setItem(
			'welcome_preset_prompt',
			JSON.stringify({
				preset,
				prompt,
				source,
				createdAt: Date.now()
			})
		);
	}

	goto(
		buildSignupUrl(source, {
			preset,
			q: prompt,
			submit: 'false'
		})
	);
};

export const openCta = (source: string): void => {
	const target = buildChatUrl(source);

	if (get(user)) {
		goto(target);
		return;
	}

	goto(buildSignupUrl(source));
};
