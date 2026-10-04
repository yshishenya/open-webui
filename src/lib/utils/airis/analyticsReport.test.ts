import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
import {
	cohortLabel,
	cohortWeekDates,
	defaultReportDates,
	getFunnelReport,
	reportDateRange,
	reportPresetDates,
	transitionPercent
} from './analyticsReport';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('report dates and conversion', () => {
	it('uses UTC inclusive dates and rejects reversed or invalid ranges', () => {
		expect(defaultReportDates(new Date('2026-10-04T01:00:00+03:00'))).toEqual({
			from: '2026-09-04',
			to: '2026-10-03'
		});
		expect(reportDateRange('2026-09-30', '2026-10-01')).toEqual({
			start: Date.parse('2026-09-30T00:00:00Z') / 1000,
			end: Date.parse('2026-10-02T00:00:00Z') / 1000
		});
		expect(() => reportDateRange('2026-10-02', '2026-10-01')).toThrow();
		expect(() => reportDateRange('2026-02-30', '2026-03-01')).toThrow();
	});
	it('does not represent an unknown denominator as zero conversion', () => {
		expect(transitionPercent(0, 0)).toBeNull();
		expect(transitionPercent(25, 800)).toBe(3.13);
	});
	it('keeps calendar presets separate from the observation window', () => {
		const now = new Date('2026-10-04T12:00:00Z');
		expect(reportPresetDates('7', now)).toEqual({ from: '2026-09-28', to: '2026-10-04' });
		expect(reportPresetDates('month', now)).toEqual({ from: '2026-10-01', to: '2026-10-04' });
		expect(reportPresetDates('30', now)).toEqual(defaultReportDates(now));
	});
	it('shows actual ISO week dates across years without inventing a traffic source', () => {
		expect(cohortWeekDates('2026-W40')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
		expect(cohortWeekDates('2020-W53')).toEqual({ from: '2020-12-28', to: '2021-01-03' });
		expect(cohortWeekDates('2021-W53')).toBeNull();
		expect(cohortLabel('unknown', 'utm_source')).toBe('Источник не определён');
		expect(cohortLabel('unknown', 'signup_method')).toBe('Не определён');
		expect(cohortLabel('2026-W40', 'week')).toContain('28 сентября 2026');
	});
	it('rejects expired access and reports without a server generation time', async () => {
		const fetchReport = vi.fn();
		vi.stubGlobal('fetch', fetchReport);
		const filters = { start: 1, end: 2, window_days: 7, breakdown: 'week' };
		for (const status of [401, 403]) {
			fetchReport.mockResolvedValueOnce(new Response(null, { status }));
			await expect(getFunnelReport('local-test', filters)).rejects.toThrow('Нет доступа');
		}
		fetchReport.mockResolvedValueOnce(Response.json({ summary: {}, sequence: {} }));
		await expect(getFunnelReport('local-test', filters)).rejects.toThrow('ещё не обновлён');
		const report = { summary: {}, sequence: {}, generated_at: 123 };
		fetchReport.mockResolvedValueOnce(Response.json(report));
		await expect(getFunnelReport('local-test', filters)).resolves.toEqual(report);
		expect(fetchReport.mock.lastCall?.[1]).toMatchObject({ cache: 'no-store' });
	});
});
