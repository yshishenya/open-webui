import { WEBUI_API_BASE_URL } from '$lib/constants';

export type ReportingDirection = 'asc' | 'desc';
export type ReportingSort = 'paid' | 'spent' | 'balance' | 'last_payment' | 'last_usage';

export interface BillingReportingOverview {
	currency: string;
	from: number;
	to: number;
	as_of: number;
	time_semantics: string;
	metrics: Record<string, number>;
	warnings: Record<string, number>;
	series: Array<{ date: string; paid_kopeks: number; usage_kopeks: number; refund_kopeks: number }>;
	definitions: Record<string, string>;
}

export interface BillingReportingCustomer {
	user_id: string;
	name: string;
	email: string;
	role: string;
	currency: string;
	paid_kopeks: number;
	period_paid_kopeks: number;
	spent_kopeks: number;
	period_spent_kopeks: number;
	balance_topup_kopeks: number;
	balance_included_kopeks: number;
	last_payment_at: number | null;
	last_usage_at: number | null;
	successful_payment_count: number;
	failed_payment_count: number;
	status: string;
	refund_kopeks: number;
	period_refund_kopeks: number;
}

export interface BillingReportingPage<T> {
	items: T[];
	total: number;
	page: number;
	page_size: number;
	total_pages: number;
	currency: string;
	from: number;
	to: number;
	as_of: number;
	truncated?: boolean;
	payment_fact_limit_reached?: boolean;
	scope?: string;
}

export interface BillingReportingPayment {
	id: string;
	user_id: string;
	name: string | null;
	kind: string;
	status: string;
	amount_kopeks: number;
	currency: string;
	provider: string;
	provider_payment_id: string | null;
	processed_at: number;
	created_at: number;
	credited_at: number | null;
	credit_status: 'credited' | 'not_credited' | 'not_applicable';
	is_test: boolean | null;
	refunded_kopeks: number;
	refund_wallet_status?: string;
	source: string;
	wallet_id: string | null;
	subscription_id: string | null;
}

export interface BillingReportingCustomerDetail {
	user: { id: string; name: string; email: string; role: string };
	wallet: {
		id: string | null;
		currency: string;
		balance_topup_kopeks: number;
		balance_included_kopeks: number;
		daily_spent_kopeks: number;
		daily_cap_kopeks: number | null;
	};
	metrics: Record<string, number>;
	payments: BillingReportingPayment[];
	ledger: Array<Record<string, string | number | null>>;
	usage: Array<Record<string, string | number | boolean | null>>;
	from: number;
	to: number;
	as_of: number;
	time_semantics: string;
}

export interface BillingReportingRow {
	[key: string]: string | number | boolean | null;
}

const get = async <T>(token: string, path: string): Promise<T> => {
	const response = await fetch(`${WEBUI_API_BASE_URL}${path}`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(25000),
		cache: 'no-store'
	});
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body?.detail || `Billing reporting request failed (${response.status})`);
	}
	return response.json();
};

const params = (values: Record<string, string | number | boolean | undefined>): string => {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(values)) {
		if (value !== undefined && value !== '') search.set(key, String(value));
	}
	return search.toString();
};

export const getBillingReportingOverview = (
	token: string,
	values: { currency?: string; from?: number; to?: number } = {}
): Promise<BillingReportingOverview> =>
	get<BillingReportingOverview>(token, `/admin/billing/reporting/overview?${params(values)}`);

export const getBillingReportingCustomers = (
	token: string,
	values: {
		currency?: string;
		from?: number;
		to?: number;
		query?: string;
		page?: number;
		page_size?: number;
		sort?: ReportingSort;
		direction?: ReportingDirection;
		status?: 'paid' | 'never_paid' | 'problems' | 'negative_balance';
	} = {}
): Promise<BillingReportingPage<BillingReportingCustomer>> =>
	get<BillingReportingPage<BillingReportingCustomer>>(
		token,
		`/admin/billing/reporting/customers?${params(values)}`
	);

export const getBillingReportingCustomer = (
	token: string,
	userId: string,
	values: { currency?: string; from?: number; to?: number; limit?: number } = {}
): Promise<BillingReportingCustomerDetail> =>
	get<BillingReportingCustomerDetail>(
		token,
		`/admin/billing/reporting/customers/${encodeURIComponent(userId)}?${params(values)}`
	);

export const getBillingReportingPayments = (
	token: string,
	values: {
		currency?: string;
		from?: number;
		to?: number;
		user_id?: string;
		status?: string;
		kind?: string;
		credit_status?: string;
		older_than_hours?: number;
		attention?: 'stale_pending' | 'uncredited';
		is_test?: boolean;
		page?: number;
		page_size?: number;
	} = {}
): Promise<BillingReportingPage<BillingReportingPayment>> =>
	get<BillingReportingPage<BillingReportingPayment>>(
		token,
		`/admin/billing/reporting/payments?${params(values)}`
	);

export const getBillingReportingLedger = (
	token: string,
	values: {
		currency?: string;
		from?: number;
		to?: number;
		user_id?: string;
		page?: number;
		page_size?: number;
	} = {}
): Promise<BillingReportingPage<BillingReportingRow>> =>
	get<BillingReportingPage<BillingReportingRow>>(
		token,
		`/admin/billing/reporting/ledger?${params(values)}`
	);

export const getBillingReportingUsage = (
	token: string,
	values: {
		currency?: string;
		from?: number;
		to?: number;
		user_id?: string;
		page?: number;
		page_size?: number;
	} = {}
): Promise<BillingReportingPage<BillingReportingRow>> =>
	get<BillingReportingPage<BillingReportingRow>>(
		token,
		`/admin/billing/reporting/usage?${params(values)}`
	);

export const getBillingReportingExportUrl = (values: {
	dataset: 'payments' | 'ledger' | 'usage' | 'refunds';
	currency?: string;
	from?: number;
	to?: number;
	user_id?: string;
	status?: string;
	kind?: string;
	credit_status?: string;
	older_than_hours?: number;
	attention?: 'stale_pending' | 'uncredited';
	is_test?: boolean;
}): string => `${WEBUI_API_BASE_URL}/admin/billing/reporting/export?${params(values)}`;

export interface BillingReportingRefund {
	id: string;
	user_id: string;
	name: string | null;
	payment_id: string;
	amount_kopeks: number;
	currency: string;
	occurred_at: number;
	wallet_reflection: 'requires_verification';
}
export const getBillingReportingRefunds = (
	token: string,
	values: {
		currency?: string;
		from?: number;
		to?: number;
		user_id?: string;
		page?: number;
		page_size?: number;
	} = {}
): Promise<BillingReportingPage<BillingReportingRefund>> =>
	get(token, `/admin/billing/reporting/refunds?${params(values)}`);
