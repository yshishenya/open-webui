// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { createInstance } from 'i18next';
import type { PublicRateCardModel } from '$lib/apis/billing';
import RatesTable from './RatesTable.svelte';

vi.mock('$lib/utils/analytics', () => ({ trackEvent: vi.fn() }));

const model: PublicRateCardModel = {
	id: 'model',
	display_name: 'Example model',
	capabilities: ['text', 'image', 'tts', 'stt'],
	rates: {
		text_in_1000_tokens: 1234,
		text_out_1000_tokens: 0,
		image_1024: 5678,
		tts_1000_chars: 2345,
		stt_minute: null
	}
};

describe('RatesTable', () => {
	let mounted: ReturnType<typeof mount> | null = null;
	let target: HTMLDivElement | null = null;

	afterEach(async () => {
		if (mounted) await unmount(mounted);
		target?.remove();
		mounted = null;
		target = null;
		vi.restoreAllMocks();
	});

	it('reacts to RU/EN with the existing locale helper without changing currency, units or rates', async () => {
		const selected = createInstance();
		await selected.init({
			lng: 'ru-RU',
			fallbackLng: 'en-US',
			resources: {
				'en-US': { translation: { 'Search models': 'Search models' } },
				'ru-RU': {
					translation: {
						'Search models': 'Поиск моделей',
						All: 'Все',
						'Input: 1,000 tokens': 'Ввод: 1 000 токенов',
						'Image: 1024px': 'Изображение: 1024px',
						'Speech: 1,000 characters': 'Озвучка: 1 000 символов',
						'Rates updated {{date}}': 'Ставки обновлены {{date}}'
					}
				}
			}
		});
		const i18n = writable(selected);
		const moneySpy = vi.spyOn(Intl, 'NumberFormat');
		const dateSpy = vi.spyOn(Intl, 'DateTimeFormat');
		const updatedAt = '2026-10-20T12:00:00Z';
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(RatesTable, {
			target,
			context: new Map([['i18n', i18n]]),
			props: { models: [model], currency: 'USD', updatedAt }
		});
		await tick();
		expect(target.querySelector('label')?.textContent).toBe('Поиск моделей');
		expect(target.querySelector('label')?.classList.contains('dark:text-gray-200')).toBe(true);
		expect(target.querySelector('label')?.htmlFor).toBe(target.querySelector('input')?.id);
		expect(target.querySelector('tbody tr')?.children[1].textContent).toBe(
			new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' }).format(12.34)
		);
		expect(target.querySelector('tbody tr')?.children[2].textContent).toBe(
			new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' }).format(0)
		);
		expect(target.textContent).toContain(
			'Ставки обновлены ' +
				new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(
					new Date(updatedAt)
				)
		);
		expect(moneySpy).toHaveBeenCalledWith('ru-RU', { style: 'currency', currency: 'USD' });
		expect(dateSpy).toHaveBeenCalledWith('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

		await selected.changeLanguage('en-US');
		i18n.set(selected);
		await tick();
		expect(target.querySelector('label')?.textContent).toBe('Search models');
		expect(target.querySelector('input')?.placeholder).toBe('Search models');
		expect(target.querySelector('button[aria-pressed="true"]')?.textContent?.trim()).toBe('All');
		expect(target.querySelector('tbody tr')?.children[1].textContent).toBe('$12.34');
		expect(target.querySelector('tbody tr')?.children[2].textContent).toBe('$0.00');
		expect(target.querySelector('tbody tr')?.children[5].textContent).toBe('—');
		expect(target.querySelector('th span')?.textContent).toBe('Input: 1,000 tokens');
		expect(target.querySelector('article dl')?.textContent).toContain('Image: 1024px');
		expect(target.querySelector('article dl')?.textContent).toContain('Speech: 1,000 characters');
		expect(target.textContent).toContain(
			'Rates updated ' +
				new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
					new Date(updatedAt)
				)
		);
		expect(target.textContent).not.toContain('Поиск');
		expect(moneySpy).toHaveBeenCalledWith('en-US', { style: 'currency', currency: 'USD' });
		expect(dateSpy).toHaveBeenCalledWith('en-US', { dateStyle: 'medium', timeStyle: 'short' });
		expect(
			target.querySelector('table')?.parentElement?.classList.contains('overflow-x-auto')
		).toBe(true);
		expect(target.querySelector('table')?.parentElement?.hasAttribute('onkeydown')).toBe(false);
		expect(model.rates).toEqual({
			text_in_1000_tokens: 1234,
			text_out_1000_tokens: 0,
			image_1024: 5678,
			tts_1000_chars: 2345,
			stt_minute: null
		});
	});

	it('uses the resolved translation language instead of the requested language', async () => {
		const selected = createInstance();
		await selected.init({
			lng: 'ru-RU',
			fallbackLng: 'en-US',
			resources: { 'en-US': { translation: { 'Search models': 'Search models' } } }
		});
		expect(selected.resolvedLanguage).toBe('en-US');
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(RatesTable, {
			target,
			context: new Map([['i18n', writable(selected)]]),
			props: { models: [model], currency: 'USD' }
		});
		await tick();
		expect(target.querySelector('tbody tr')?.children[1].textContent).toBe('$12.34');
		expect(target.querySelector('label')?.textContent).toBe('Search models');
	});
});
