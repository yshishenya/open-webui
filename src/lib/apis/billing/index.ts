import { WEBUI_API_BASE_URL } from '$lib/constants';

// ==================== Types ====================

export interface Plan {
	id: string;
	name: string;
	name_ru?: string;
	description?: string;
	description_ru?: string;
	price: number;
	price_kopeks?: number;
	currency: string;
	interval: string;
	included_kopeks_per_period?: number;
	discount_percent?: number;
	model_tiers_allowed?: string[] | null;
	images_per_period?: number | null;
	tts_seconds_per_period?: number | null;
	max_reply_cost_kopeks?: number | null;
	daily_cap_kopeks?: number | null;
	is_annual?: boolean;
	quotas?: Record<string, number | null>;
	features?: string[];
	is_active: boolean;
	display_order: number;
	plan_extra_metadata?: Record<string, unknown>;
	created_at: number;
	updated_at: number;
}

export interface PublicPlan {
	id: string;
	name: string;
	name_ru?: string;
	description?: string;
	description_ru?: string;
	price: number;
	currency: string;
	interval: string;
	features?: string[];
	quotas?: Record<string, number>;
	display_order?: number;
}

export interface Balance {
	balance_topup_kopeks: number;
	balance_included_kopeks: number;
	included_expires_at?: number | null;
	max_reply_cost_kopeks?: number | null;
	daily_cap_kopeks?: number | null;
	daily_spent_kopeks: number;
	daily_reset_at?: number | null;
	auto_topup_enabled?: boolean;
	auto_topup_threshold_kopeks?: number | null;
	auto_topup_amount_kopeks?: number | null;
	auto_topup_fail_count?: number;
	auto_topup_last_failed_at?: number | null;
	auto_topup_payment_method_saved?: boolean;
	currency: string;
}

export interface LeadMagnetUsage {
	tokens_input: number;
	tokens_output: number;
	images: number;
	tts_seconds: number;
	stt_seconds: number;
}

export interface LeadMagnetInfo {
	enabled: boolean;
	cycle_start: number | null;
	cycle_end: number | null;
	usage: LeadMagnetUsage;
	quotas: LeadMagnetUsage;
	remaining: LeadMagnetUsage;
	config_version: number;
}

export interface PublicLeadMagnetConfig {
	enabled: boolean;
	cycle_days: number;
	quotas: LeadMagnetUsage;
	config_version: number;
}

export interface PublicRateCardRates {
	text_in_1000_tokens: number | null;
	text_out_1000_tokens: number | null;
	image_1024: number | null;
	tts_1000_chars: number | null;
	stt_minute: number | null;
}

export interface PublicRateCardModel {
	id: string;
	display_name: string;
	provider?: string | null;
	capabilities: string[];
	rates: PublicRateCardRates;
}

export interface PublicRateCardResponse {
	currency: string;
	updated_at: string;
	models: PublicRateCardModel[];
}

export interface PublicPricingFreeLimits {
	text_in: number;
	text_out: number;
	images: number;
	tts_minutes: number;
	stt_minutes: number;
}

export interface PublicPricingRecommendedModels {
	text?: string | null;
	image?: string | null;
	audio?: string | null;
}

export interface PublicPricingConfig {
	topup_amounts_rub: number[];
	free_limits: PublicPricingFreeLimits;
	popular_model_ids: string[];
	recommended_model_ids: PublicPricingRecommendedModels;
}

export interface LedgerEntry {
	id: string;
	user_id: string;
	wallet_id: string;
	currency: string;
	type: string;
	amount_kopeks: number;
	charged_input_kopeks?: number | null;
	charged_output_kopeks?: number | null;
	balance_included_after: number;
	balance_topup_after: number;
	reference_id?: string | null;
	reference_type?: string | null;
	idempotency_key?: string | null;
	hold_expires_at?: number | null;
	expires_at?: number | null;
	metadata_json?: Record<string, unknown> | null;
	created_at: number;
}

export interface UsageEvent {
	id: string;
	user_id: string;
	wallet_id: string;
	plan_id?: string | null;
	subscription_id?: string | null;
	chat_id?: string | null;
	message_id?: string | null;
	request_id: string;
	model_id: string;
	modality: string;
	provider?: string | null;
	measured_units_json?: Record<string, unknown> | null;
	prompt_tokens?: number | null;
	completion_tokens?: number | null;
	cost_raw_kopeks: number;
	cost_raw_input_kopeks?: number | null;
	cost_raw_output_kopeks?: number | null;
	cost_charged_kopeks: number;
	cost_charged_input_kopeks?: number | null;
	cost_charged_output_kopeks?: number | null;
	billing_source: string;
	is_estimated: boolean;
	estimate_reason?: string | null;
	pricing_version?: string | null;
	pricing_rate_card_id?: string | null;
	pricing_rate_card_input_id?: string | null;
	pricing_rate_card_output_id?: string | null;
	wallet_snapshot_json?: Record<string, unknown> | null;
	created_at: number;
}

export interface Subscription {
	id: string;
	user_id: string;
	plan_id: string;
	status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'pending';
	yookassa_payment_id?: string;
	yookassa_subscription_id?: string;
	current_period_start: number;
	current_period_end: number;
	cancel_at_period_end: boolean;
	trial_end?: number;
	metadata?: Record<string, unknown>;
	created_at: number;
	updated_at: number;
}

export interface Transaction {
	id: string;
	user_id: string;
	subscription_id?: string;
	amount: number;
	currency: string;
	status: string;
	yookassa_payment_id?: string;
	yookassa_status?: string;
	description?: string;
	description_ru?: string;
	receipt_url?: string;
	metadata?: Record<string, unknown>;
	created_at: number;
	updated_at: number;
}

export interface UsageInfo {
	metric: string;
	current_usage: number;
	quota_limit?: number;
	remaining?: number;
}

/**
 * Usage data returned by /billing/me endpoint
 */
export interface UsageData {
	current: number;
	limit: number | null;
}

/**
 * Complete billing information for a user
 */
export interface BillingInfo {
	subscription?: Subscription | null;
	plan?: Plan | null;
	usage: Record<string, UsageData>;
	transactions: Transaction[];
	lead_magnet?: LeadMagnetInfo;
}

export interface PaymentResponse {
	transaction_id: string;
	payment_id: string;
	confirmation_url: string;
	status: string;
}

export interface TopupResponse {
	payment_id: string;
	confirmation_url: string;
	status: string;
}

export interface TopupReconcileResponse {
	payment_id: string;
	provider_status?: string | null;
	payment_status?: string | null;
	credited: boolean;
}

export interface QuotaCheckResponse {
	allowed: boolean;
	current_usage: number;
	quota_limit?: number;
	remaining?: number;
}

const BILLING_INFO_TIMEOUT_MS = 15000;

// ==================== Helper Functions ====================

/**
 * Make an API request with consistent error handling
 * @param url - API endpoint URL
 * @param token - Auth token
 * @param options - Fetch options
 * @returns Response data or throws error
 */
async function apiRequest<T>(url: string, token: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
			...options.headers
		}
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		const errorMessage = errorData.detail || `Request failed with status ${response.status}`;
		console.error(`API Error [${url}]:`, errorMessage);
		throw errorMessage;
	}

	return response.json();
}

async function publicApiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options.headers
		}
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		const errorMessage = errorData.detail || `Request failed with status ${response.status}`;
		console.error(`API Error [${url}]:`, errorMessage);
		throw errorMessage;
	}

	return response.json();
}

// ==================== Plans API ====================

/**
 * Get all available subscription plans
 * @param token - Auth token
 * @returns List of plans or null on error
 */
export const getPlans = async (token: string): Promise<Plan[] | null> => {
	try {
		return await apiRequest<Plan[]>(`${WEBUI_API_BASE_URL}/billing/plans`, token);
	} catch (error) {
		console.error('Failed to get plans:', error);
		throw error;
	}
};

export const getPlansPublic = async (): Promise<PublicPlan[] | null> => {
	try {
		return await publicApiRequest<PublicPlan[]>(`${WEBUI_API_BASE_URL}/billing/plans/public`);
	} catch (error) {
		console.error('Failed to get public plans:', error);
		throw error;
	}
};

/**
 * Get a specific plan by ID
 * @param token - Auth token
 * @param planId - Plan ID
 * @returns Plan details or null on error
 */
export const getPlan = async (token: string, planId: string): Promise<Plan | null> => {
	try {
		return await apiRequest<Plan>(`${WEBUI_API_BASE_URL}/billing/plans/${planId}`, token);
	} catch (error) {
		console.error('Failed to get plan:', error);
		throw error;
	}
};

// ==================== Subscription API ====================

/**
 * Get current user's subscription
 * @param token - Auth token
 * @returns Subscription details or null
 */
export const getMySubscription = async (token: string): Promise<Subscription | null> => {
	try {
		return await apiRequest<Subscription | null>(
			`${WEBUI_API_BASE_URL}/billing/subscription`,
			token
		);
	} catch (error) {
		console.error('Failed to get subscription:', error);
		throw error;
	}
};

/**
 * Cancel current user's subscription
 * @param token - Auth token
 * @param immediate - Cancel immediately or at period end
 * @returns Updated subscription or null
 */
export const cancelSubscription = async (
	token: string,
	immediate: boolean = false
): Promise<Subscription | null> => {
	try {
		return await apiRequest<Subscription>(
			`${WEBUI_API_BASE_URL}/billing/subscription/cancel`,
			token,
			{
				method: 'POST',
				body: JSON.stringify({ immediate })
			}
		);
	} catch (error) {
		console.error('Failed to cancel subscription:', error);
		throw error;
	}
};

/**
 * Resume current user's subscription if cancellation is scheduled
 * @param token - Auth token
 * @returns Updated subscription or null
 */
export const resumeSubscription = async (token: string): Promise<Subscription | null> => {
	try {
		return await apiRequest<Subscription>(
			`${WEBUI_API_BASE_URL}/billing/subscription/resume`,
			token,
			{
				method: 'POST'
			}
		);
	} catch (error) {
		console.error('Failed to resume subscription:', error);
		throw error;
	}
};

// ==================== Payment API ====================

/**
 * Create a payment for a subscription plan
 * @param token - Auth token
 * @param planId - Plan to subscribe to
 * @param returnUrl - URL to redirect after payment
 * @returns Payment response with confirmation URL
 */
export const createPayment = async (
	token: string,
	planId: string,
	returnUrl: string
): Promise<PaymentResponse | null> => {
	try {
		return await apiRequest<PaymentResponse>(`${WEBUI_API_BASE_URL}/billing/payment`, token, {
			method: 'POST',
			body: JSON.stringify({
				plan_id: planId,
				return_url: returnUrl
			})
		});
	} catch (error) {
		console.error('Failed to create payment:', error);
		throw error;
	}
};

export const createTopup = async (
	token: string,
	amountKopeks: number,
	returnUrl: string
): Promise<TopupResponse | null> => {
	try {
		return await apiRequest<TopupResponse>(`${WEBUI_API_BASE_URL}/billing/topup`, token, {
			method: 'POST',
			body: JSON.stringify({
				amount_kopeks: amountKopeks,
				return_url: returnUrl
			})
		});
	} catch (error) {
		console.error('Failed to create topup:', error);
		throw error;
	}
};

export const reconcileTopup = async (
	token: string,
	paymentId: string
): Promise<TopupReconcileResponse | null> => {
	try {
		return await apiRequest<TopupReconcileResponse>(
			`${WEBUI_API_BASE_URL}/billing/topup/reconcile`,
			token,
			{
				method: 'POST',
				body: JSON.stringify({
					payment_id: paymentId
				})
			}
		);
	} catch (error) {
		console.error('Failed to reconcile topup:', error);
		throw error;
	}
};

/**
 * Get user's transaction history
 * @param token - Auth token
 * @param limit - Max number of transactions
 * @param skip - Number of transactions to skip
 * @returns List of transactions
 */
export const getTransactions = async (
	token: string,
	limit: number = 50,
	skip: number = 0
): Promise<Transaction[] | null> => {
	try {
		return await apiRequest<Transaction[]>(
			`${WEBUI_API_BASE_URL}/billing/transactions?limit=${limit}&skip=${skip}`,
			token
		);
	} catch (error) {
		console.error('Failed to get transactions:', error);
		throw error;
	}
};

export const getBalance = async (token: string): Promise<Balance | null> => {
	try {
		return await apiRequest<Balance>(`${WEBUI_API_BASE_URL}/billing/balance`, token);
	} catch (error) {
		console.error('Failed to get balance:', error);
		throw error;
	}
};

export const getLedger = async (
	token: string,
	limit: number = 50,
	skip: number = 0
): Promise<LedgerEntry[] | null> => {
	try {
		return await apiRequest<LedgerEntry[]>(
			`${WEBUI_API_BASE_URL}/billing/ledger?limit=${limit}&skip=${skip}`,
			token
		);
	} catch (error) {
		console.error('Failed to get ledger:', error);
		throw error;
	}
};

export const getUsageEvents = async (
	token: string,
	limit: number = 50,
	skip: number = 0,
	billingSource?: string
): Promise<UsageEvent[] | null> => {
	try {
		const params = new URLSearchParams({
			limit: String(limit),
			skip: String(skip)
		});
		if (billingSource) {
			params.set('billing_source', billingSource);
		}
		return await apiRequest<UsageEvent[]>(
			`${WEBUI_API_BASE_URL}/billing/usage-events?${params.toString()}`,
			token
		);
	} catch (error) {
		console.error('Failed to get usage events:', error);
		throw error;
	}
};

export const updateAutoTopup = async (
	token: string,
	payload: { enabled: boolean; threshold_kopeks?: number | null; amount_kopeks?: number | null }
): Promise<{ status: string } | null> => {
	try {
		return await apiRequest<{ status: string }>(`${WEBUI_API_BASE_URL}/billing/auto-topup`, token, {
			method: 'POST',
			body: JSON.stringify(payload)
		});
	} catch (error) {
		console.error('Failed to update auto-topup:', error);
		throw error;
	}
};

export const updateBillingSettings = async (
	token: string,
	payload: {
		max_reply_cost_kopeks?: number | null;
		daily_cap_kopeks?: number | null;
		billing_contact_email?: string | null;
		billing_contact_phone?: string | null;
	}
): Promise<{ status: string } | null> => {
	try {
		return await apiRequest<{ status: string }>(`${WEBUI_API_BASE_URL}/billing/settings`, token, {
			method: 'POST',
			body: JSON.stringify(payload)
		});
	} catch (error) {
		console.error('Failed to update billing settings:', error);
		throw error;
	}
};

// ==================== Usage API ====================

/**
 * Get usage for a specific metric
 * @param token - Auth token
 * @param metric - Metric name (e.g., 'tokens_input')
 * @returns Usage info
 */
export const getUsage = async (token: string, metric: string): Promise<UsageInfo | null> => {
	try {
		return await apiRequest<UsageInfo>(`${WEBUI_API_BASE_URL}/billing/usage/${metric}`, token);
	} catch (error) {
		console.error('Failed to get usage:', error);
		throw error;
	}
};

/**
 * Check if user can use specified amount without exceeding quota
 * @param token - Auth token
 * @param metric - Metric name
 * @param amount - Amount to check
 * @returns Quota check response
 */
export const checkQuota = async (
	token: string,
	metric: string,
	amount: number = 1
): Promise<QuotaCheckResponse | null> => {
	try {
		return await apiRequest<QuotaCheckResponse>(
			`${WEBUI_API_BASE_URL}/billing/usage/check`,
			token,
			{
				method: 'POST',
				body: JSON.stringify({ metric, amount })
			}
		);
	} catch (error) {
		console.error('Failed to check quota:', error);
		throw error;
	}
};

// ==================== Billing Info API ====================

/**
 * Get complete billing information for current user
 * @param token - Auth token
 * @returns Complete billing info including subscription, plan, usage, and transactions
 */
export const getBillingInfo = async (token: string): Promise<BillingInfo | null> => {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), BILLING_INFO_TIMEOUT_MS);

	try {
		return await apiRequest<BillingInfo>(`${WEBUI_API_BASE_URL}/billing/me`, token, {
			signal: controller.signal
		});
	} catch (error) {
		console.error('Failed to get billing info:', error);
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
};

export const getLeadMagnetInfo = async (token: string): Promise<LeadMagnetInfo | null> => {
	try {
		return await apiRequest<LeadMagnetInfo>(`${WEBUI_API_BASE_URL}/billing/lead-magnet`, token);
	} catch (error) {
		console.error('Failed to get lead magnet info:', error);
		return null;
	}
};

export const getPublicLeadMagnetConfig = async (): Promise<PublicLeadMagnetConfig | null> => {
	try {
		return await publicApiRequest<PublicLeadMagnetConfig>(
			`${WEBUI_API_BASE_URL}/billing/public/lead-magnet`
		);
	} catch (error) {
		console.error('Failed to get public lead magnet config:', error);
		return null;
	}
};

export const getPublicPricingConfig = async (): Promise<PublicPricingConfig | null> => {
	try {
		return await publicApiRequest<PublicPricingConfig>(
			`${WEBUI_API_BASE_URL}/billing/public/pricing-config`
		);
	} catch (error) {
		console.error('Failed to get public pricing config:', error);
		return null;
	}
};

export const getPublicRateCards = async (): Promise<PublicRateCardResponse | null> => {
	try {
		return await publicApiRequest<PublicRateCardResponse>(
			`${WEBUI_API_BASE_URL}/billing/public/rate-cards`
		);
	} catch (error) {
		console.error('Failed to get public rate cards:', error);
		return null;
	}
};
