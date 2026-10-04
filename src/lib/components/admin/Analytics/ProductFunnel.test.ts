// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { FunnelReport, FunnelSequence } from '$lib/utils/airis/analyticsReport';
import ProductFunnel from './ProductFunnel.svelte';

const api = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return {
		page: writable({
			url: new URL('http://localhost/admin/analytics/funnel?from=2026-09-01&to=2026-09-30')
		})
	};
});
vi.mock('$lib/utils/airis/analyticsReport', async (load) => ({
	...(await load<typeof import('$lib/utils/airis/analyticsReport')>()),
	getFunnelReport: api.report
}));

const sequence = (responded: number, paid: number): FunnelSequence => ({
	visitors: 10,
	registered: 4,
	responded,
	paid_after_response: paid,
	paid_before_response: 3 - paid,
	paid_without_observed_response: 0,
	incomplete_paid: 0,
	mature_visitors: 10,
	mature_registered: 4,
	mature_responded: responded,
	mature_paid_after_response: paid,
	mature_paid_before_response: 3 - paid,
	mature_paid_without_observed_response: 0,
	mature_incomplete_paid: 0
});
const fixture = (): FunnelReport => ({
	summary: {
		visitors: 20,
		registered: 8,
		activated: 8,
		paid: 6,
		repeated: 0,
		mature_visitors: 20,
		mature_paid: 6,
		immature_visitors: 0,
		conversion_percent: 30,
		next_maturity_at: null
	},
	sequence: {
		...sequence(5, 4),
		visitors: 20,
		mature_visitors: 20,
		registered: 8,
		mature_registered: 8,
		paid_before_response: 2,
		mature_paid_before_response: 2
	},
	rows: ['Источник А', 'Источник Б'].map((cohort, i) => ({
		cohort,
		visitors: 10,
		registered: 4,
		activated: 4,
		paid: 3,
		repeated: 0,
		mature_visitors: 10,
		mature_paid: 3,
		immature_visitors: 0,
		conversion_percent: 30,
		median_hours_to_pay: null,
		sequence: i === 0 ? sequence(2, 1) : sequence(3, 3)
	})),
	financial: {},
	payment_funnel: { created: 6, confirmed: 6, conversion_percent: 100 },
	coverage: { consented_identities: 20, linked_accounts: 8 },
	delivery: [],
	events: {}
});

describe('ProductFunnel source paths and factual attention', () => {
	let mounted: Record<string, unknown> | null = null;
	let target: HTMLDivElement;
	beforeEach(() => {
		vi.resetAllMocks();
		target = document.createElement('div');
		document.body.append(target);
		api.report.mockResolvedValue(fixture());
	});
	afterEach(async () => {
		if (mounted) await unmount(mounted);
		mounted = null;
		target.remove();
	});
	async function show(overview = false): Promise<void> {
		mounted = mount(ProductFunnel, { target, props: { overview } });
		await vi.waitFor(() => expect(target.querySelector('h2')).toBeTruthy());
		await tick();
	}
	it('shows distinct ordered source paths even when independent achievement totals match', async () => {
		await show();
		const articles = Array.from(target.querySelectorAll('article'));
		expect(articles).toHaveLength(2);
		const paidStep = (article: HTMLElement): string | null | undefined =>
			Array.from(article.querySelectorAll('span')).find(
				(span) => span.textContent === 'Первое пополнение после ответа'
			)?.nextElementSibling?.textContent;
		expect(paidStep(articles[0])).toBe('1');
		expect(paidStep(articles[1])).toBe('3');
		expect(articles[0].textContent).toContain('50% от предыдущего шага');
		expect(articles[0].textContent).toContain('Следующий шаг не наблюдается: 2');
		expect(articles[1].textContent).toContain('100% от предыдущего шага');
		expect(articles[0].textContent).toContain('Завершённые наблюдения: 10');
		expect(articles[0].textContent).toContain('Отсутствие события не доказывает');
	});
	it('does not substitute the overall path when a source sequence is unavailable', async () => {
		const report = fixture();
		delete report.rows[0].sequence;
		api.report.mockResolvedValue(report);
		await show();
		const article = target.querySelector('article');
		expect(article?.textContent).toContain('Последовательность этой группы не загружена.');
		expect(article?.textContent).not.toContain('Первое пополнение после ответа');
	});
	it('shows only observed attention facts and labels external failures as lifetime', async () => {
		const report = fixture();
		report.delivery = [
			{ destination: 'posthog', state: 'failed', count: 2 },
			{ destination: 'metrica', state: 'pending', count: 99 }
		];
		report.sequence.mature_incomplete_paid = 1;
		api.report.mockResolvedValue(report);
		await show(true);
		const attention = Array.from(target.querySelectorAll('section')).find(
			(section) => section.querySelector('h2')?.textContent === 'Требует внимания'
		);
		expect(attention?.textContent).toContain('неполный порядок наблюдаемых событий: 1');
		expect(attention?.textContent).toContain('2 за всё время');
		expect(attention?.textContent).not.toContain('99');
		expect(attention?.querySelector('a[href$="#data-quality"]')).toBeTruthy();
	});
	it('does not claim that the product is healthy when no attention facts are supplied', async () => {
		await show(true);
		expect(target.textContent).not.toContain('Требует внимания');
		expect(target.textContent).not.toContain('Всё в порядке');
	});
});
