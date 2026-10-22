// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { createInstance } from 'i18next';
import type { PublicRateCardResponse } from '$lib/apis/billing';
import Page from './+page.svelte';

const mocks = vi.hoisted(() => ({ getRates: vi.fn(), getConfig: vi.fn(), goto: vi.fn() }));
vi.mock('$lib/apis/billing', () => ({
	getPublicRateCards: mocks.getRates,
	getPublicPricingConfig: mocks.getConfig
}));
vi.mock('$lib/utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			url: new URL(
				'http://localhost/billing/cost?from_date=2026-10-01&to_date=2026-10-02&return_to=%2Fc%2Fexample'
			)
		})
	};
});
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');
	return { WEBUI_NAME: writable('AIRIS') };
});

const rates: PublicRateCardResponse = {
	currency: 'RUB',
	updated_at: '2026-10-20T12:00:00Z',
	models: [
		{
			id: 'model',
			display_name: 'Example model',
			capabilities: ['text'],
			rates: {
				text_in_1000_tokens: 100,
				text_out_1000_tokens: 200,
				image_1024: null,
				tts_1000_chars: null,
				stt_minute: null
			}
		}
	]
};
const flushPromises = async (): Promise<void> => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('billing cost', () => {
	let mounted: ReturnType<typeof mount> | null = null;
	let target: HTMLDivElement | null = null;

	beforeEach(() => {
		mocks.getRates.mockReset().mockResolvedValue(rates);
		mocks.getConfig.mockReset().mockResolvedValue(null);
		mocks.goto.mockReset();
	});
	afterEach(async () => {
		if (mounted) await unmount(mounted);
		target?.remove();
		mounted = null;
		target = null;
	});
	const renderPage = async (): Promise<HTMLDivElement> => {
		const selected = createInstance();
		await selected.init({
			lng: 'en-US',
			fallbackLng: 'en-US',
			resources: { 'en-US': { translation: { 'Usage cost': 'Usage cost' } } }
		});
		target = document.createElement('div');
		document.body.appendChild(target);
		mounted = mount(Page, { target, context: new Map([['i18n', writable(selected)]]) });
		await flushPromises();
		return target;
	};

	it('keeps period and safe return links while rendering unchanged model rates', async () => {
		const root = await renderPage();
		for (const [label, path] of [
			['Back to balance', '/billing/balance'],
			['View operations', '/billing/history']
		]) {
			const link = [...root.querySelectorAll('a')].find(
				(node) => node.textContent?.trim() === label
			);
			expect(link).toBeTruthy();
			const url = new URL(link!.href);
			expect(url.pathname).toBe(path);
			expect(url.searchParams.get('from_date')).toBe('2026-10-01');
			expect(url.searchParams.get('to_date')).toBe('2026-10-02');
			expect(url.searchParams.get('return_to')).toBe('/c/example');
		}
		expect(root.querySelector('tbody tr')?.children[1].textContent).toBe(
			new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RUB' }).format(1)
		);
		expect(root.querySelector('tbody tr')?.children[2].textContent).toBe(
			new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RUB' }).format(2)
		);
		expect(root.querySelector('label[for="rates-search"]')?.textContent).toBe('Search models');
		expect(root.querySelector('[role="alert"]')).toBeNull();
	});

	it('shows a rate-load error without a false zero price and recovers through the existing retry', async () => {
		mocks.getRates.mockRejectedValueOnce(new Error('offline'));
		const root = await renderPage();
		expect(root.querySelector('[role="alert"]')?.textContent).toContain(
			'Rates could not be loaded'
		);
		expect(root.querySelector('table')).toBeNull();
		const retry = root.querySelector<HTMLButtonElement>('[role="alert"] button');
		expect(retry?.textContent).toBe('Retry');
		retry!.click();
		await flushPromises();
		expect(root.querySelector('[role="alert"]')).toBeNull();
		expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
		expect(mocks.getRates).toHaveBeenCalledTimes(2);
	});
});
