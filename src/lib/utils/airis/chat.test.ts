// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	clearWelcomePresetPrompt,
	consumeWelcomePresetPrompt,
	setTextWithRetries,
	shouldIncludeUsage
} from './chat';

describe('airis/chat', () => {
	beforeEach(() => {
		sessionStorage.clear();
		vi.restoreAllMocks();
	});

	describe('consumeWelcomePresetPrompt', () => {
		it('returns null when missing', () => {
			expect(consumeWelcomePresetPrompt()).toBeNull();
		});

		it('returns prompt when payload is valid and fresh', () => {
			const payload = {
				prompt: 'Hello',
				source: 'welcome_examples',
				createdAt: 1_000
			};
			sessionStorage.setItem('welcome_preset_prompt', JSON.stringify(payload));

			expect(consumeWelcomePresetPrompt(1_000)).toBe('Hello');
			expect(sessionStorage.getItem('welcome_preset_prompt')).toBeNull();
		});

		it('returns null when source is not welcome_*', () => {
			sessionStorage.setItem(
				'welcome_preset_prompt',
				JSON.stringify({ prompt: 'Hello', source: 'pricing', createdAt: 1_000 })
			);

			expect(consumeWelcomePresetPrompt(1_000)).toBeNull();
		});

		it('returns null when payload is expired', () => {
			sessionStorage.setItem(
				'welcome_preset_prompt',
				JSON.stringify({ prompt: 'Hello', source: 'welcome_examples', createdAt: 0 })
			);

			expect(consumeWelcomePresetPrompt(10 * 60 * 1000 + 1)).toBeNull();
		});

		it('returns null on invalid JSON and clears storage key', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			sessionStorage.setItem('welcome_preset_prompt', '{invalid json');

			expect(consumeWelcomePresetPrompt()).toBeNull();
			expect(sessionStorage.getItem('welcome_preset_prompt')).toBeNull();
			expect(warn).toHaveBeenCalledTimes(1);
		});
	});

	describe('clearWelcomePresetPrompt', () => {
		it('removes storage key', () => {
			sessionStorage.setItem('welcome_preset_prompt', 'value');
			clearWelcomePresetPrompt();
			expect(sessionStorage.getItem('welcome_preset_prompt')).toBeNull();
		});
	});

	describe('setTextWithRetries', () => {
		it('sets text when input exists immediately', async () => {
			const setText = vi.fn();
			const wait = vi.fn(async () => {});

			const ok = await setTextWithRetries(() => ({ setText }), wait, 'Hello');

			expect(ok).toBe(true);
			expect(setText).toHaveBeenCalledWith('Hello');
			expect(wait).not.toHaveBeenCalled();
		});

		it('retries until input becomes available', async () => {
			const setText = vi.fn();
			const wait = vi.fn(async () => {});

			let attempts = 0;
			const ok = await setTextWithRetries(
				() => {
					attempts += 1;
					return attempts >= 3 ? { setText } : null;
				},
				wait,
				'Hello'
			);

			expect(ok).toBe(true);
			expect(setText).toHaveBeenCalledWith('Hello');
			expect(wait).toHaveBeenCalledTimes(2);
		});

		it('returns false when input never appears', async () => {
			const setText = vi.fn();
			const wait = vi.fn(async () => {});

			const ok = await setTextWithRetries(() => null, wait, 'Hello', { maxAttempts: 3 });

			expect(ok).toBe(false);
			expect(setText).not.toHaveBeenCalled();
			expect(wait).toHaveBeenCalledTimes(3);
		});
	});

	describe('shouldIncludeUsage', () => {
		it('returns explicit capability value when boolean', () => {
			expect(
				shouldIncludeUsage({
					owned_by: 'openai',
					info: { meta: { capabilities: { usage: false } } }
				})
			).toBe(false);
			expect(
				shouldIncludeUsage({
					owned_by: 'someone',
					info: { meta: { capabilities: { usage: true } } }
				})
			).toBe(true);
		});

		it('falls back to owned_by=openai when capability is missing', () => {
			expect(shouldIncludeUsage({ owned_by: 'openai' })).toBe(true);
			expect(shouldIncludeUsage({ owned_by: 'ollama' })).toBe(false);
		});
	});
});

