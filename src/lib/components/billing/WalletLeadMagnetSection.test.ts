// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';

import WalletLeadMagnetSection from './WalletLeadMagnetSection.svelte';
import type { LeadMagnetInfo } from '$lib/apis/billing';

type I18nStore = {
	locale: string;
	t: (key: string) => string;
	subscribe: (run: (value: I18nStore) => void) => () => void;
};
const i18nStore: I18nStore = {
	locale: 'en-US',
	t: (key: string) => key,
	subscribe: (run: (value: I18nStore) => void) => {
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
		expect(target.querySelector('[data-testid="free-quota-summary"]')?.textContent).toContain(
			'999,978'
		);
		expect(target.textContent).not.toContain('Tokens are counted automatically');

		limitsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await Promise.resolve();

		expect(limitsButton?.getAttribute('aria-expanded')).toBe('true');
		expect(target.querySelector('#free-limit-details')).toBeTruthy();
		expect(target.textContent).toContain('Input');
		expect(target.textContent).toContain('Models included (1)');
	});

	it('shows distinct model IDs and remaining minutes before expanding exact seconds', async () => {
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(WalletLeadMagnetSection, {
			target,
			context: new Map([['i18n', i18nStore]]),
			props: {
				leadMagnetInfo: {
					...leadMagnetInfo,
					quotas: { ...leadMagnetInfo.quotas, tts_seconds: 3600, stt_seconds: 3600 },
					usage: { ...leadMagnetInfo.usage, tts_seconds: 3599 },
					remaining: { ...leadMagnetInfo.remaining, tts_seconds: 1, stt_seconds: 3600 }
				},
				models: [
					{ id: 'gpt-6-luna', name: 'GPT 6 Luna' },
					{ id: 'gpt-5.6-luna', name: 'GPT 6 Luna' }
				],
				modelsReady: true
			}
		});
		expect(target.textContent).toContain('GPT 6 Luna (gpt-6-luna)');
		expect(target.textContent).toContain('GPT 6 Luna (gpt-5.6-luna)');
		const summary = target
			.querySelector('[data-testid="free-quota-summary"]')
			?.textContent?.replace(/\s+/g, ' ');
		expect(summary).toContain('Speech synthesis minutes: 0.02');
		expect(summary).toContain('Speech recognition minutes: 60');
		expect(target.querySelector('#free-limit-details')).toBeNull();
		target.querySelector<HTMLButtonElement>('button[aria-controls="free-limit-details"]')?.click();
		await Promise.resolve();
		expect(target.textContent?.replace(/\s+/g, ' ')).toContain('Remaining: 1 seconds');
		expect(target.textContent).not.toContain('3.6K');
	});

	it('explains exhausted text quota even when another kind of quota remains', () => {
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(WalletLeadMagnetSection, {
			target,
			context: new Map([['i18n', i18nStore]]),
			props: {
				leadMagnetInfo: {
					...leadMagnetInfo,
					remaining: { ...leadMagnetInfo.remaining, tokens_input: 0 }
				},
				modelsReady: true
			}
		});
		expect(target.querySelector('[role="status"]')?.textContent).toContain(
			'Free text allowance is exhausted'
		);
	});
});
