// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { createInstance } from 'i18next';
import ru from '$lib/i18n/locales/ru-RU/translation.json';
import en from '$lib/i18n/locales/en-US/translation.json';
import Models from './+page.svelte';
import * as api from '$lib/apis/admin/billing';
import type { RateCard } from '$lib/apis/admin/billing';
import { createNewModel, updateModelById } from '$lib/apis/models';
import { toast } from 'svelte-sonner';

import { beforeNavigate } from '$app/navigation';
vi.mock('$app/navigation', () => ({ goto: vi.fn(), beforeNavigate: vi.fn() }));
vi.mock('$app/state', () => ({ updated: { current: false } }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return { page: writable({ url: new URL('http://localhost/admin/billing/models') }) };
});
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		WEBUI_NAME: writable('Airis'),
		user: writable({ role: 'admin' }),
		settings: writable({})
	};
});
vi.mock('$lib/apis', () => ({
	getModels: vi.fn().mockResolvedValue([{ id: 'model-a', name: 'Model A' }])
}));
vi.mock('$lib/apis/models', () => ({
	getBaseModels: vi.fn().mockResolvedValue([{ id: 'model-a', name: 'Model A' }]),
	createNewModel: vi.fn(),
	updateModelById: vi.fn()
}));
vi.mock('$lib/apis/admin/billing', () => ({
	listRateCards: vi.fn(),
	createRateCard: vi.fn(),
	updateRateCard: vi.fn(),
	deleteRateCardsByModel: vi.fn(),
	deactivateRateCardsByModel: vi.fn(),
	exportRateCardsXlsx: vi.fn(),
	previewRateCardsXlsxImport: vi.fn(),
	applyRateCardsXlsxImport: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }) }));
vi.mock('$lib/utils/transitions', () => ({ flyAndScale: () => ({ duration: 0 }) }));
// Reuse the import dialog test's boundary: real controls, synthetic API, no browser focus proof.
vi.mock('focus-trap', () => ({
	createFocusTrap: () => ({
		activate: vi.fn(),
		deactivate: vi.fn(),
		pause: vi.fn(),
		unpause: vi.fn()
	})
}));

const rates: RateCard[] = ['token_in', 'token_out'].map((unit, index) => ({
	id: `rate-${unit}`,
	model_id: 'model-a',
	modality: 'text',
	unit,
	raw_cost_per_unit_kopeks: index === 0 ? 12 : 34,
	version: 'g3-original',
	created_at: 1,
	is_default: false,
	is_active: true
}));

const button = (name: string): HTMLButtonElement => {
	const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(element) => element.getAttribute('aria-label') === name || element.textContent?.trim() === name
	);
	if (!found) throw new Error(`Missing button: ${name}`);
	return found;
};

const setInputPrice = async (value: string): Promise<void> => {
	const input = document.querySelector<HTMLInputElement>(
		'input[aria-label="Input price per 1000 tokens · RUB"]'
	);
	if (!input) throw new Error('Missing input price');
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await tick();
};

describe('model price editor save requests (synthetic API)', () => {
	let component: ReturnType<typeof mount> | null = null;
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.setItem('token', 'synthetic-admin-token');
		vi.mocked(api.listRateCards).mockResolvedValue({
			items: rates,
			total_pages: 1,
			total: rates.length,
			page: 1,
			page_size: 200
		});
	});
	afterEach(async () => {
		if (component) await unmount(component);
		component = null;
		document.body.innerHTML = '';
		localStorage.removeItem('token');
	});
	const openEditor = async (mode = 'Edit'): Promise<void> => {
		const target = document.createElement('div');
		document.body.append(target);
		component = mount(Models, {
			target,
			context: new Map([['i18n', writable({ language: 'en-US', t: (key: string): string => key })]])
		});
		await vi.waitFor(() =>
			expect(button(`${mode}: Model prices — Model A (model-a)`)).toBeTruthy()
		);
		button(`${mode}: Model prices — Model A (model-a)`).click();
		await tick();
	};
	const save = async (): Promise<void> => {
		button('Save').click();
		await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		expect(toast.error).not.toHaveBeenCalled();
		expect(api.deleteRateCardsByModel).not.toHaveBeenCalled();
		expect(createNewModel).not.toHaveBeenCalled();
		expect(updateModelById).not.toHaveBeenCalled();
	};

	it.each([
		['ru-RU', ru, 'Модальности: Текст, Изображения, Озвучивание, Распознавание речи', 'Статус'],
		['en-US', en, 'Modalities: Text, Image, Speech synthesis, Speech recognition', 'Status']
	] as const)(
		'localizes modality summaries and the status filter with real i18next (%s)',
		async (lng, translation, summary, statusLabel) => {
			const i18n = createInstance();
			await i18n.init({
				lng,
				resources: { [lng]: { translation } },
				returnEmptyString: false,
				interpolation: { escapeValue: false }
			});
			const items: RateCard[] = [
				...rates,
				...(['image', 'tts', 'stt'] as const).map((modality) => ({
					...rates[0],
					id: `rate-${modality}`,
					modality,
					unit: { image: 'image_1024', tts: 'tts_char', stt: 'stt_second' }[modality]
				}))
			];
			vi.mocked(api.listRateCards).mockResolvedValue({
				items,
				total_pages: 1,
				total: items.length,
				page: 1,
				page_size: 200
			});
			const target = document.createElement('div');
			document.body.append(target);
			component = mount(Models, {
				target,
				context: new Map([['i18n', writable(i18n)]])
			});
			await vi.waitFor(() =>
				expect(
					target
						.querySelector('tbody [aria-label^="Modalities:"], tbody [aria-label^="Модальности:"]')
						?.getAttribute('aria-label')
				).toBe(summary)
			);
			expect(target.querySelector('select')?.getAttribute('aria-label')).toBe(statusLabel);
			expect(api.createRateCard).not.toHaveBeenCalled();
			expect(api.updateRateCard).not.toHaveBeenCalled();
		}
	);

	it('creates linked input/output prices in integer kopeks without changing free access', async () => {
		vi.mocked(api.listRateCards).mockResolvedValue({
			items: [],
			total_pages: 1,
			total: 0,
			page: 1,
			page_size: 200
		});
		await openEditor('Add');
		expect(button('Enable modality: Text').getAttribute('aria-checked')).toBe('true');
		await setInputPrice('1,23');
		await save();
		expect(vi.mocked(api.createRateCard).mock.calls).toEqual(
			['token_in', 'token_out'].map((unit) => [
				'synthetic-admin-token',
				{
					model_id: 'model-a',
					modality: 'text',
					unit,
					raw_cost_per_unit_kopeks: 123,
					is_active: true
				}
			])
		);
		expect(api.updateRateCard).not.toHaveBeenCalled();
	});

	it('revises only the changed price by creating a new row and deactivating the old row', async () => {
		await openEditor();
		await setInputPrice('0.56');
		await save();
		expect(vi.mocked(api.createRateCard).mock.calls).toEqual([
			[
				'synthetic-admin-token',
				{
					model_id: 'model-a',
					modality: 'text',
					unit: 'token_in',
					raw_cost_per_unit_kopeks: 56,
					is_active: true
				}
			]
		]);
		expect(vi.mocked(api.updateRateCard).mock.calls).toEqual([
			['synthetic-admin-token', 'rate-token_in', { is_active: false }],
			['synthetic-admin-token', 'rate-token_out', { is_active: true }]
		]);
		expect(vi.mocked(api.createRateCard).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(api.updateRateCard).mock.invocationCallOrder[0]
		);
	});

	it('deactivates both text units without deleting history or creating zero prices', async () => {
		await openEditor();
		button('Enable modality: Text').click();
		await vi.waitFor(() =>
			expect(
				document.querySelector<HTMLInputElement>(
					'input[aria-label="Input price per 1000 tokens · RUB"]'
				)?.disabled
			).toBe(true)
		);
		await save();
		expect(vi.mocked(api.updateRateCard).mock.calls).toEqual(
			['token_in', 'token_out'].map((unit) => [
				'synthetic-admin-token',
				`rate-${unit}`,
				{ is_active: false }
			])
		);
		expect(api.createRateCard).not.toHaveBeenCalled();
	});

	it('does not create a revision when the saved prices are unchanged', async () => {
		await openEditor();
		await save();
		expect(api.createRateCard).not.toHaveBeenCalled();
		expect(vi.mocked(api.updateRateCard).mock.calls).toEqual(
			['token_in', 'token_out'].map((unit) => [
				'synthetic-admin-token',
				`rate-${unit}`,
				{ is_active: true }
			])
		);
	});

	it('rejects invalid prices before making any save request', async () => {
		await openEditor();
		await setInputPrice('0.001');
		button('Save').click();
		await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(api.createRateCard).not.toHaveBeenCalled();
		expect(api.updateRateCard).not.toHaveBeenCalled();
		expect(toast.success).not.toHaveBeenCalled();
	});

	it('guards Close, Escape, backdrop and route departure without losing the price draft', async () => {
		await openEditor();
		await setInputPrice('0.56');
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		try {
			button('Close').click();
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			const modal = document.querySelector('.modal')!;
			modal.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			const navigation = {
				from: { url: new URL('http://localhost/admin/billing/models') },
				to: { url: new URL('http://localhost/admin/billing') },
				willUnload: false,
				cancel: vi.fn()
			};
			vi.mocked(beforeNavigate).mock.calls[0][0](
				navigation as unknown as Parameters<Parameters<typeof beforeNavigate>[0]>[0]
			);
			await tick();
			expect(confirm).toHaveBeenCalledTimes(4);
			expect(navigation.cancel).toHaveBeenCalledOnce();
			expect(
				document.querySelector<HTMLInputElement>(
					'input[aria-label="Input price per 1000 tokens · RUB"]'
				)?.value
			).toBe('0.56');
			confirm.mockReturnValue(true);
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			await tick();
			expect(document.querySelector('.modal')).toBeNull();
			expect(api.createRateCard).not.toHaveBeenCalled();
		} finally {
			confirm.mockRestore();
		}
	});

	it('keeps the draft after a partial save, blocks blind retry, and requires confirmed current-price reload', async () => {
		await openEditor();
		await setInputPrice('0.56');
		vi.mocked(api.createRateCard).mockResolvedValueOnce({
			...rates[0],
			id: 'new-rate',
			raw_cost_per_unit_kopeks: 56
		});
		vi.mocked(api.updateRateCard).mockRejectedValueOnce(new Error('connection lost after request'));
		button('Save').click();
		await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(
			document.querySelector<HTMLInputElement>(
				'input[aria-label="Input price per 1000 tokens · RUB"]'
			)?.value
		).toBe('0.56');
		expect(button('Save').disabled).toBe(true);
		button('Save').click();
		expect(api.createRateCard).toHaveBeenCalledTimes(1);
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		try {
			button('Reload current prices').click();
			await tick();
			expect(button('Save').disabled).toBe(true);
			confirm.mockReturnValue(true);
			button('Reload current prices').click();
			await vi.waitFor(() => expect(button('Save').disabled).toBe(false));
			expect(
				document.querySelector<HTMLInputElement>(
					'input[aria-label="Input price per 1000 tokens · RUB"]'
				)?.value
			).toBe('0.12');
			expect(api.createRateCard).toHaveBeenCalledTimes(1);
		} finally {
			confirm.mockRestore();
		}
	});

	it('does not reopen a stale editor while reconciling an uncertain write after a failed read', async () => {
		await openEditor();
		await setInputPrice('0.56');
		vi.mocked(api.createRateCard).mockRejectedValueOnce(new Error('unknown write result'));
		vi.mocked(api.listRateCards).mockRejectedValueOnce(new Error('read unavailable'));
		button('Save').click();
		await vi.waitFor(() => expect(button('Reload current prices').disabled).toBe(false));
		let finish!: (data: Awaited<ReturnType<typeof api.listRateCards>>) => void;
		vi.mocked(api.listRateCards).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		);
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
		try {
			button('Reload current prices').click();
			await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
			button('Close').click();
			await tick();
			expect(
				document.querySelector('button[aria-label="Edit: Model prices — Model A (model-a)"]')
			).toBeNull();
			expect(document.querySelector('.modal')).toBeNull();
			finish({
				items: rates.map((rate) => ({ ...rate, raw_cost_per_unit_kopeks: 56 })),
				total_pages: 1,
				total: 2,
				page: 1,
				page_size: 200
			});
			await vi.waitFor(() => expect(button('Refresh').disabled).toBe(false));
			button('Edit: Model prices — Model A (model-a)').click();
			await tick();
			expect(
				document.querySelector<HTMLInputElement>(
					'input[aria-label="Input price per 1000 tokens · RUB"]'
				)?.value
			).toBe('0.56');
			expect(api.createRateCard).toHaveBeenCalledTimes(1);
		} finally {
			confirm.mockRestore();
		}
	});

	it.each(['edited', 'reopened'] as const)(
		'does not close a newer %s draft after a late successful save',
		async (scenario) => {
			await openEditor();
			await setInputPrice('0.56');
			let finish!: (rate: RateCard) => void;
			vi.mocked(api.createRateCard).mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					})
			);
			button('Save').click();
			await vi.waitFor(() => expect(api.createRateCard).toHaveBeenCalledOnce());
			if (scenario === 'reopened') {
				const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
				button('Close').click();
				await tick();
				confirm.mockRestore();
				button('Edit: Model prices — Model A (model-a)').click();
				await tick();
			}
			await setInputPrice('0.78');
			finish({ ...rates[0], id: 'new-rate', raw_cost_per_unit_kopeks: 56 });
			await vi.waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
			await tick();
			expect(
				document.querySelector<HTMLInputElement>(
					'input[aria-label="Input price per 1000 tokens · RUB"]'
				)?.value
			).toBe('0.78');
			expect(button('Save').disabled).toBe(true);
			expect(button('Reload current prices')).toBeTruthy();
		}
	);
});
