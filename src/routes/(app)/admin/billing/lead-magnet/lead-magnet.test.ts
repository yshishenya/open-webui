// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import FreeAccess from './+page.svelte';
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		user: writable({ role: 'admin' }),
		WEBUI_NAME: writable('Airis'),
		settings: writable({})
	};
});
vi.mock('$lib/apis', () => ({ getModels: vi.fn().mockResolvedValue([]) }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('$lib/apis/admin/billing', () => ({
	getLeadMagnetConfig: vi
		.fn()
		.mockResolvedValue({
			enabled: true,
			cycle_days: 30,
			quotas: {
				tokens_input: 100,
				tokens_output: 100,
				images: 2,
				tts_seconds: 60,
				stt_seconds: 60
			},
			config_version: 1
		}),
	updateLeadMagnetConfig: vi
		.fn()
		.mockResolvedValue({
			enabled: true,
			cycle_days: 30,
			quotas: {
				tokens_input: 100,
				tokens_output: 100,
				images: 2,
				tts_seconds: 90,
				stt_seconds: 60
			},
			config_version: 2
		})
}));
it('saves edited numeric allowances and exact audio minutes without changing their meaning', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(FreeAccess, {
		target,
		context: new Map([['i18n', writable({ language: 'ru-RU', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('Save changes'));
		const inputFor = (label: string): HTMLInputElement =>
			Array.from(target.querySelectorAll('label'))
				.find((element) => element.textContent?.includes(label))!
				.querySelector('input')!;
		const audio = inputFor('Speech synthesis minutes');
		audio.value = '1.5';
		audio.dispatchEvent(new Event('input', { bubbles: true }));
		const tokens = inputFor('Input tokens');
		tokens.value = '100';
		tokens.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		Array.from(target.querySelectorAll('button'))
			.find((button) => button.textContent?.trim() === 'Save changes')!
			.click();
		const api = await import('$lib/apis/admin/billing');
		await vi.waitFor(() =>
			expect(api.updateLeadMagnetConfig).toHaveBeenCalledWith(undefined, {
				enabled: true,
				cycle_days: 30,
				quotas: {
					tokens_input: 100,
					tokens_output: 100,
					images: 2,
					tts_seconds: 90,
					stt_seconds: 60
				}
			})
		);
	} finally {
		await unmount(component);
		target.remove();
	}
});
