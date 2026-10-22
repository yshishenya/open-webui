// @vitest-environment jsdom
import { it, expect, vi, beforeEach } from 'vitest';
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
	getLeadMagnetConfig: vi.fn().mockResolvedValue({
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
	updateLeadMagnetConfig: vi.fn().mockResolvedValue({
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
beforeEach(() => {
	vi.clearAllMocks();
});

it.each(['success', 'failure'] as const)(
	'locks the complete draft during a pending save and unlocks after %s',
	async (outcome) => {
		const api = await import('$lib/apis/admin/billing');
		const saved = await api.getLeadMagnetConfig('test-token');
		if (!saved) throw new Error('Missing test configuration');
		let finish!: (value: typeof saved) => void;
		let fail!: (reason: Error) => void;
		vi.mocked(api.updateLeadMagnetConfig).mockImplementationOnce(
			() =>
				new Promise((resolve, reject) => {
					finish = resolve;
					fail = reject;
				})
		);
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(FreeAccess, {
			target,
			context: new Map([['i18n', writable({ language: 'en-US', t: (key: string): string => key })]])
		});
		try {
			await vi.waitFor(() => expect(target.textContent).toContain('Save changes'));
			const inputs = Array.from(target.querySelectorAll<HTMLInputElement>('input[type="number"]'));
			expect(inputs).toHaveLength(6);
			const tokens = inputs[1];
			tokens.value = '123';
			tokens.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			const toggle = target.querySelector<HTMLButtonElement>('[role="switch"]')!;
			const save = Array.from(target.querySelectorAll('button')).find(
				(button) => button.textContent?.trim() === 'Save changes'
			)!;
			save.click();
			await vi.waitFor(() => expect(api.updateLeadMagnetConfig).toHaveBeenCalledTimes(1));
			for (const input of inputs) expect(input.disabled).toBe(true);
			expect(toggle.disabled).toBe(true);
			expect(save.disabled).toBe(true);
			toggle.click();
			save.click();
			await tick();
			expect(toggle.getAttribute('aria-checked')).toBe('true');
			expect(api.updateLeadMagnetConfig).toHaveBeenCalledTimes(1);
			if (outcome === 'success') {
				finish({ ...saved, config_version: 2, quotas: { ...saved.quotas, tokens_input: 123 } });
			} else {
				fail(new Error('Save unavailable'));
			}
			await vi.waitFor(() => expect(save.disabled).toBe(false));
			for (const input of inputs) expect(input.disabled).toBe(false);
			expect(toggle.disabled).toBe(false);
			expect(tokens.value).toBe('123');
			tokens.value = '456';
			tokens.dispatchEvent(new Event('input', { bubbles: true }));
			await tick();
			save.click();
			await vi.waitFor(() =>
				expect(api.updateLeadMagnetConfig).toHaveBeenLastCalledWith(
					undefined,
					expect.objectContaining({
						expected_config_version: outcome === 'success' ? 2 : 1,
						quotas: expect.objectContaining({ tokens_input: 456 })
					})
				)
			);
		} finally {
			await unmount(component);
			target.remove();
		}
	}
);

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
				expected_config_version: 1,
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

it('names the free-access switch and preserves the draft after a version conflict', async () => {
	const api = await import('$lib/apis/admin/billing');
	vi.mocked(api.updateLeadMagnetConfig).mockRejectedValueOnce({ status: 409 });
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(FreeAccess, {
		target,
		context: new Map([['i18n', writable({ language: 'en-US', t: (key: string): string => key })]])
	});
	try {
		await vi.waitFor(() => expect(target.textContent).toContain('Save changes'));
		expect(target.querySelector('[role="switch"][aria-label="Enable free access"]')).toBeTruthy();
		const input = Array.from(target.querySelectorAll('label'))
			.find((element) => element.textContent?.includes('Input tokens'))!
			.querySelector('input')!;
		input.value = '123';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		const save = Array.from(target.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === 'Save changes'
		)!;
		save.click();
		await vi.waitFor(() =>
			expect(target.querySelector('[role="alert"]')?.textContent).toContain(
				'Your draft has been preserved'
			)
		);
		expect(input.value).toBe('123');
		expect(save.disabled).toBe(true);
		const compare = Array.from(target.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === 'Compare saved settings'
		)!;
		vi.mocked(api.getLeadMagnetConfig).mockResolvedValueOnce({
			enabled: false,
			cycle_days: 7,
			quotas: { tokens_input: 80, tokens_output: 80, images: 1, tts_seconds: 60, stt_seconds: 60 },
			config_version: 2
		});
		compare.click();
		await vi.waitFor(() =>
			expect(
				target.querySelector('[data-testid="saved-config-comparison"]')?.textContent
			).toContain('Input tokens: 80')
		);
		expect(input.value).toBe('123');
		Array.from(target.querySelectorAll('button'))
			.find((button) => button.textContent?.trim() === 'Keep draft and use the reviewed version')!
			.click();
		await tick();
		expect(save.disabled).toBe(false);
		save.click();
		await vi.waitFor(() =>
			expect(api.updateLeadMagnetConfig).toHaveBeenLastCalledWith(
				undefined,
				expect.objectContaining({
					expected_config_version: 2,
					quotas: expect.objectContaining({ tokens_input: 123 })
				})
			)
		);
	} finally {
		await unmount(component);
		target.remove();
	}
});
