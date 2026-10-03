import { describe, expect, it, vi } from 'vitest';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
import { defaultReportDates, reportDateRange, transitionPercent } from './analyticsReport';

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
});
