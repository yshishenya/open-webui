// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { Writable } from 'svelte/store';
import { page } from '$app/stores';
import type { FunnelReport } from '$lib/utils/airis/analyticsReport';
import ProductFunnel from './ProductFunnel.svelte';

const state = vi.hoisted(() => ({
	request: vi.fn(),
	navigate: null as (() => void) | null,
	initialNavigation: true
}));
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
vi.mock('$app/stores', async () => ({
	page: (await import('svelte/store')).writable({
		url: new URL('http://localhost/admin/analytics/funnel?from=2026-09-01&to=2026-09-30')
	})
}));
vi.mock('$app/navigation', async () => {
	const { onMount } = await import('svelte');
	const { page } = await import('$app/stores');
	return {
		afterNavigate: (callback: () => void): void => {
			onMount(() => {
				state.navigate = callback;
				if (state.initialNavigation) callback();
				return () => {
					state.navigate = null;
				};
			});
		},
		goto: vi.fn(async (url: string): Promise<void> => {
			(page as unknown as Writable<{ url: URL }>).set({ url: new URL(url, 'http://localhost') });
			state.navigate?.();
		})
	};
});
vi.mock('$lib/utils/airis/analyticsReport', async (load) => ({
	...(await load<typeof import('$lib/utils/airis/analyticsReport')>()),
	getFunnelReport: state.request
}));

const fixture = (): FunnelReport => ({
	generated_at: Date.parse('2026-10-04T00:05:00Z') / 1000,
	summary: {
		visitors: 14,
		registered: 3,
		activated: 2,
		paid: 0,
		repeated: 0,
		mature_visitors: 0,
		mature_paid: 0,
		immature_visitors: 14,
		conversion_percent: null,
		next_maturity_at: null
	},
	sequence: {
		visitors: 14,
		registered: 3,
		responded: 2,
		paid_after_response: 0,
		paid_before_response: 0,
		paid_without_observed_response: 0,
		incomplete_paid: 0,
		mature_visitors: 0,
		mature_registered: 0,
		mature_responded: 0,
		mature_paid_after_response: 0,
		mature_paid_before_response: 0,
		mature_paid_without_observed_response: 0,
		mature_incomplete_paid: 0
	},
	rows: [
		{
			cohort: '2026-W40',
			visitors: 14,
			registered: 3,
			activated: 2,
			paid: 0,
			repeated: 0,
			mature_visitors: 0,
			mature_paid: 0,
			immature_visitors: 14,
			conversion_percent: null,
			median_hours_to_pay: null
		}
	],
	financial: {
		RUB: { confirmed_payments: 22, gross_kopeks: 670000, refund_kopeks: 0, net_kopeks: 670000 }
	},
	payment_funnel: { created: 36, confirmed: 22, conversion_percent: 61.11 },
	coverage: { consented_identities: 20, linked_accounts: 9, excluded_existing_accounts: 5 },
	delivery: [],
	events: {}
});

describe('ProductFunnel applied report and truthful states', () => {
	let target: HTMLDivElement;
	let mounted: Record<string, unknown> | null = null;
	beforeEach(() => {
		vi.clearAllMocks();
		state.initialNavigation = true;
		state.request.mockReset().mockResolvedValue(fixture());
		(page as unknown as Writable<{ url: URL }>).set({
			url: new URL('http://localhost/admin/analytics/funnel?from=2026-09-01&to=2026-09-30')
		});
		target = document.createElement('div');
		document.body.appendChild(target);
		localStorage.token = 'local-test';
	});
	afterEach(async () => {
		if (mounted) await unmount(mounted);
		mounted = null;
		target.remove();
	});
	async function show(): Promise<void> {
		mounted = mount(ProductFunnel, { target });
		await vi.waitFor(() => expect(target.textContent).toContain('Данные сформированы'));
		await tick();
	}
	async function click(name: string): Promise<void> {
		const button = [...target.querySelectorAll('button')].find(
			(item) => item.textContent?.trim() === name
		);
		expect(button, name).toBeTruthy();
		button?.click();
		await tick();
	}
	async function changeDate(value: string): Promise<void> {
		const input = target.querySelector('input[type=date]') as HTMLInputElement;
		input.value = value;
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
	}

	it('keeps observed zero distinct from unavailable conversion and lifetime coverage', async () => {
		await show();
		expect(target.textContent).toContain('Результат за 30 дней пока недоступен');
		expect(target.textContent).toContain('Срок наблюдения завершился у 0 из 14');
		expect(target.textContent).not.toContain('0%');
		expect(target.textContent).toContain('28 сентября 2026');
		expect(target.textContent).toContain('Существующих аккаунтов исключено: 5');
		expect(target.querySelector('a[href="/admin/billing"]')?.textContent).toContain(
			'выбрать период'
		);
		expect(target.textContent).toContain('00:05');
	});
	it('loads when the administrator component mounts after navigation has completed', async () => {
		state.initialNavigation = false;
		await show();
		expect(state.request).toHaveBeenCalledOnce();
	});
	it('retains the previous report during loading and failure, and retries the attempted filters', async () => {
		await show();
		let reject: (cause: Error) => void = () => {};
		state.request.mockReturnValueOnce(
			new Promise((_resolve, failed) => {
				reject = failed;
			})
		);
		await changeDate('2026-09-02');
		await click('Применить');
		expect(target.textContent).toContain('Ниже предыдущий отчёт');
		expect(target.textContent).toContain('Первые визиты: 2026-09-01');
		reject(new Error('Не удалось загрузить отчёт'));
		await vi.waitFor(() => expect(target.querySelector('[role=alert]')).not.toBeNull());
		expect(target.textContent).toContain('Сохранён предыдущий отчёт');
		await click('Повторить');
		await vi.waitFor(() => expect(target.textContent).toContain('Первые визиты: 2026-09-02'));
		expect(state.request.mock.lastCall?.[1].start).toBe(Date.parse('2026-09-02T00:00:00Z') / 1000);
	});
	it('refreshes applied filters without discarding a draft', async () => {
		await show();
		await changeDate('2026-09-03');
		expect(state.request).toHaveBeenCalledTimes(1);
		await click('Обновить');
		await vi.waitFor(() => expect(state.request).toHaveBeenCalledTimes(2));
		expect(state.request.mock.lastCall?.[1].start).toBe(Date.parse('2026-09-01T00:00:00Z') / 1000);
		expect(target.textContent).toContain('Изменения не применены');
	});
	it('restores URL filters and ignores a superseded response', async () => {
		await show();
		let resolve: (report: FunnelReport) => void = () => {};
		state.request.mockReturnValueOnce(
			new Promise((done) => {
				resolve = done;
			})
		);
		await click('Обновить');
		(page as unknown as Writable<{ url: URL }>).set({
			url: new URL(
				'http://localhost/admin/analytics/funnel?from=2026-09-04&to=2026-09-30&window_days=7&breakdown=utm_source'
			)
		});
		await tick();
		state.navigate?.();
		await vi.waitFor(() => expect(target.textContent).toContain('Первые визиты: 2026-09-04'));
		resolve({ ...fixture(), summary: { ...fixture().summary, visitors: 999 } });
		await tick();
		expect(target.textContent).not.toContain('999');
		expect(state.request.mock.lastCall?.[1]).toMatchObject({
			window_days: 7,
			breakdown: 'utm_source'
		});
	});
	it('keeps data when invalid dates are submitted without issuing a request', async () => {
		await show();
		await changeDate('2026-10-01');
		await click('Применить');
		expect(target.querySelector('[role=alert]')?.textContent).toContain(
			'начало должно быть не позже конца'
		);
		expect(state.request).toHaveBeenCalledTimes(1);
		expect(target.textContent).toContain('Первые визиты: 2026-09-01');
	});
	it('does not turn an empty report into zero conversion', async () => {
		const empty = fixture();
		empty.rows = [];
		empty.summary = {
			...empty.summary,
			visitors: 0,
			registered: 0,
			activated: 0,
			immature_visitors: 0
		};
		state.request.mockResolvedValue(empty);
		await show();
		expect(target.textContent).toContain('Нет новых наблюдаемых посетителей');
		expect(target.querySelector('table')).toBeNull();
	});
	it('does not invent zero exclusions when coverage information is missing', async () => {
		const result = fixture();
		delete result.coverage.excluded_existing_accounts;
		state.request.mockResolvedValue(result);
		await show();
		expect(target.textContent).toContain('Существующих аккаунтов исключено: нет данных');
	});
});
