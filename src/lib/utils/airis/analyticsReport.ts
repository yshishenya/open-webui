import { WEBUI_API_BASE_URL } from '$lib/constants';

export interface FunnelSummary {
	visitors: number;
	registered: number;
	activated: number;
	paid: number;
	repeated: number;
	mature_visitors: number;
	mature_paid: number;
	immature_visitors: number;
	conversion_percent: number | null;
	next_maturity_at: number | null;
}

export interface FunnelSequence {
	visitors: number;
	registered: number;
	responded: number;
	paid_after_response: number;
	paid_before_response: number;
	paid_without_observed_response: number;
	incomplete_paid: number;
	mature_visitors: number;
	mature_registered: number;
	mature_responded: number;
	mature_paid_after_response: number;
	mature_paid_before_response: number;
	mature_paid_without_observed_response: number;
	mature_incomplete_paid: number;
}

export interface FunnelReport {
	generated_at: number;
	summary: FunnelSummary;
	sequence: FunnelSequence;
	rows: Array<
		Omit<FunnelSummary, 'next_maturity_at'> & { cohort: string; median_hours_to_pay: number | null }
	>;
	financial: Record<
		string,
		{ confirmed_payments: number; gross_kopeks: number; refund_kopeks: number; net_kopeks: number }
	>;
	payment_funnel: { created: number; confirmed: number; conversion_percent: number | null };
	coverage: {
		consented_identities: number;
		linked_accounts: number;
		excluded_existing_accounts?: number;
	};
	delivery: Array<{ destination: string; state: string; count: number }>;
	events: Record<string, number>;
}

export const defaultReportDates = (now: Date = new Date()): { from: string; to: string } => {
	const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	return {
		from: new Date(end.getTime() - 29 * 86400000).toISOString().slice(0, 10),
		to: end.toISOString().slice(0, 10)
	};
};

export const reportDateRange = (from: string, to: string): { start: number; end: number } => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
		throw new Error('Выберите обе даты');
	const start = Date.parse(`${from}T00:00:00Z`) / 1000;
	const last = Date.parse(`${to}T00:00:00Z`) / 1000;
	if (
		!Number.isFinite(start) ||
		!Number.isFinite(last) ||
		start > last ||
		new Date(start * 1000).toISOString().slice(0, 10) !== from ||
		new Date(last * 1000).toISOString().slice(0, 10) !== to
	)
		throw new Error('Проверьте даты: начало должно быть не позже конца');
	return { start, end: last + 86400 };
};

export const transitionPercent = (count: number, base: number): number | null =>
	base > 0 ? Math.round((count * 10000) / base) / 100 : null;

export const reportPresetDates = (
	preset: '7' | '30' | 'month',
	now: Date = new Date()
): { from: string; to: string } => {
	const { to } = defaultReportDates(now);
	const end = Date.parse(`${to}T00:00:00Z`);
	return {
		from:
			preset === 'month'
				? `${to.slice(0, 7)}-01`
				: new Date(end - (Number(preset) - 1) * 86400000).toISOString().slice(0, 10),
		to
	};
};

export const cohortWeekDates = (cohort: string): { from: string; to: string } | null => {
	const match = /^(\d{4})-W(\d{2})$/.exec(cohort);
	if (!match) return null;
	const year = Number(match[1]);
	const week = Number(match[2]);
	if (week < 1 || week > 53) return null;
	const jan4 = new Date(`${match[1]}-01-04T00:00:00Z`);
	const monday =
		jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (week - 1) * 7 * 86400000;
	if (new Date(monday + 3 * 86400000).getUTCFullYear() !== year) return null;
	return {
		from: new Date(monday).toISOString().slice(0, 10),
		to: new Date(monday + 6 * 86400000).toISOString().slice(0, 10)
	};
};

export const cohortLabel = (cohort: string, group: string): string => {
	if (!cohort || cohort === 'unknown')
		return group === 'utm_source' ? 'Источник не определён' : 'Не определён';
	const week = group === 'week' ? cohortWeekDates(cohort) : null;
	if (!week) return cohort;
	const format = (day: string): string =>
		new Date(`${day}T00:00:00Z`).toLocaleDateString('ru-RU', {
			timeZone: 'UTC',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	return `${format(week.from)} — ${format(week.to)}`;
};

export const getFunnelReport = async (
	token: string,
	values: { start: number; end: number; window_days: number; breakdown: string }
): Promise<FunnelReport> => {
	const params = new URLSearchParams(
		Object.entries(values).map(([key, value]) => [key, String(value)])
	);
	const response = await fetch(`${WEBUI_API_BASE_URL}/analytics/funnel-report?${params}`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(25000),
		cache: 'no-store'
	});
	if (response.status === 401 || response.status === 403)
		throw new Error('Нет доступа к отчёту. Требуется действующая сессия администратора.');
	if (!response.ok) throw new Error('Не удалось загрузить отчёт. Повторите попытку.');
	const report: FunnelReport = await response.json();
	if (!report.summary || !report.sequence || !Number.isFinite(report.generated_at))
		throw new Error('Расчёт отчёта ещё не обновлён. Повторите загрузку позже.');
	return report;
};
