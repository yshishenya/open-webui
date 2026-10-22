// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { createInstance } from 'i18next';
import type { PublicRateCardResponse } from '$lib/apis/billing';
import config from '$lib/data/pricing-estimator.json';
import Estimator, { type PricingEstimatorConfig } from './Estimator.svelte';

vi.mock('$lib/utils/analytics', () => ({ trackEvent: vi.fn() }));

describe('Estimator locale', () => {
	let mounted: ReturnType<typeof mount> | null = null;
	let target: HTMLDivElement | null = null;

	afterEach(async () => {
		if (mounted) await unmount(mounted);
		target?.remove();
		mounted = null;
		target = null;
	});

	it('switches RU/EN labels and money without resetting inputs or changing the estimate or currency', async () => {
		const selected = createInstance();
		await selected.init({
			lng: 'ru-RU',
			fallbackLng: 'en-US',
			resources: {
				'en-US': { translation: { Text: 'Text' } },
				'ru-RU': {
					translation: {
						Text: 'Текст',
						Images: 'Изображения',
						Audio: 'Аудио',
						month: 'месяц',
						'Messages per day': 'Сообщений в день',
						'Task type': 'Тип задачи',
						'Start for free': 'Начать бесплатно',
						'Enter a whole number of messages from 1 to 1,000.':
							'Укажите целое число сообщений от 1 до 1 000.'
					}
				}
			}
		});
		const i18n = writable(selected);
		const rates: PublicRateCardResponse = {
			currency: 'USD',
			updated_at: '2026-10-22T00:00:00Z',
			models: [
				{
					id: 'example',
					display_name: 'Example model',
					capabilities: ['text', 'image', 'tts', 'stt'],
					rates: {
						text_in_1000_tokens: 100,
						text_out_1000_tokens: 200,
						image_1024: 300,
						tts_1000_chars: 400,
						stt_minute: 500
					}
				}
			]
		};
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(Estimator, {
			target,
			context: new Map([['i18n', i18n]]),
			props: { config: config as PricingEstimatorConfig, rateCard: rates }
		});
		await tick();
		const panel = target.querySelector('#estimator-panel-text');
		const input = panel!.querySelector<HTMLInputElement>('input')!;
		expect(input.value).toBe('10');
		expect(target.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Тип задачи');
		expect(target.querySelector('#estimator-tab-text')?.textContent?.trim()).toBe('Текст');
		const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' });
		expect(panel!.textContent).toContain(`≈ ${money.format(61.2)} – ${money.format(86.4)} / месяц`);

		await selected.changeLanguage('en-US');
		i18n.set(selected);
		await tick();
		expect(target.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Task type');
		expect(target.querySelector('#estimator-tab-text')?.textContent?.trim()).toBe('Text');
		expect(target.textContent).toContain('Messages per day');
		expect(target.textContent).toContain('Start for free');
		expect(panel!.textContent).toContain('≈ $61.20 – $86.40 / month');
		expect(input.value).toBe('10');
		expect(panel!.querySelector('select')?.value).toBe('example');
		expect(target.textContent).not.toMatch(/[А-Яа-яЁё]/);

		target.querySelector<HTMLButtonElement>('#estimator-tab-audio')!.click();
		await tick();
		expect(target.textContent).toContain('Text to speech');
		expect(target.textContent).toContain('Speech recognition');
		expect(target.textContent).toContain('Characters for speech');
		// The existing JSON contains Russian audio labels: presentation must use the mode ID instead.
		expect(target.textContent).not.toMatch(/[А-Яа-яЁё]/);
		const stt = [
			...target.querySelectorAll<HTMLButtonElement>('#estimator-panel-audio button')
		].find((button) => button.textContent?.trim() === 'Speech recognition');
		stt!.click();
		await tick();
		expect(target.textContent).toContain('Transcription minutes');
		target.querySelector<HTMLButtonElement>('#estimator-tab-text')!.click();
		await tick();
		const currentInput = target.querySelector<HTMLInputElement>('#estimator-panel-text input')!;
		currentInput.value = '0';
		currentInput.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(target.querySelector('[role="alert"]')?.textContent).toContain(
			'Enter a whole number of messages from 1 to 1,000.'
		);
		await selected.changeLanguage('ru-RU');
		i18n.set(selected);
		await tick();
		expect(target.querySelector('[role="alert"]')?.textContent).toContain(
			'Укажите целое число сообщений от 1 до 1 000.'
		);
	});
});
