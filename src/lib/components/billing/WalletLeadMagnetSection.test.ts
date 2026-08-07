// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';

import WalletLeadMagnetSection from './WalletLeadMagnetSection.svelte';
import type { LeadMagnetInfo } from '$lib/apis/billing';

const i18nStore = {
	locale: 'en-US',
	t: (key: string) => key,
	subscribe: (run: (value: typeof i18nStore) => void) => {
		run(i18nStore);
		return () => undefined;
	}
};

const leadMagnetInfo: LeadMagnetInfo = {
	enabled: true,
	cycle_start: 1_757_000_000,
	cycle_end: 1_757_086_400,
	usage: { tokens_input: 22, tokens_output: 512, images: 0, tts_seconds: 0, stt_seconds: 0 },
	quotas: {
		tokens_input: 1_000_000,
		tokens_output: 1_000_000,
		images: 100,
		tts_seconds: 0,
		stt_seconds: 0
	},
	remaining: {
		tokens_input: 999_978,
		tokens_output: 999_488,
		images: 100,
		tts_seconds: 0,
		stt_seconds: 0
	},
	config_version: 1
};

describe('WalletLeadMagnetSection', () => {
	let mounted: Record<string, unknown> | null = null;
	let target: HTMLDivElement | null = null;

	afterEach(async () => {
		if (mounted) await unmount(mounted);
		mounted = null;
		target?.remove();
		target = null;
	});

	it('keeps secondary limits collapsed until the user asks for them', async () => {
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(WalletLeadMagnetSection, {
			target,
			context: new Map([['i18n', i18nStore]]),
			props: {
				leadMagnetInfo,
				models: [{ id: 'free-model', name: 'Free model' }],
				modelsReady: true
			}
		});

		const limitsButton = target.querySelector('button[aria-controls="free-limit-details"]');
		expect(limitsButton?.getAttribute('aria-expanded')).toBe('false');
		expect(target.querySelector('#free-limit-details')).toBeNull();
		expect(target.textContent).not.toContain('Input');

		limitsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await Promise.resolve();

		expect(limitsButton?.getAttribute('aria-expanded')).toBe('true');
		expect(target.querySelector('#free-limit-details')).toBeTruthy();
		expect(target.textContent).toContain('Input');
		expect(target.textContent).toContain('Models included (1)');
	});
});
