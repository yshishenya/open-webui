import { WEBUI_API_BASE_URL } from '$lib/constants';

// ==================== Types ====================

export interface Plan {
	id: string;
	name: string;
	name_ru?: string;
	description?: string;
	description_ru?: string;
	price: number;
	currency: string;
	interval: string;
	quotas?: Record<string, number | null>;
	features?: string[];
	is_active: boolean;
	display_order: number;
	plan_extra_metadata?: Record<string, unknown>;
	created_at: number;
	updated_at: number;
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
}

export interface PaymentResponse {
	transaction_id: string;
	payment_id: string;
	confirmation_url: string;
	status: string;
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
async function apiRequest<T>(
	url: string,
	token: string,
	options: RequestInit = {}
): Promise<T> {
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

/**
 * Activate a free subscription plan
 * @param token - Auth token
 * @param planId - Free plan ID
 * @returns Activated subscription or null
 */
export const activateFreePlan = async (
	token: string,
	planId: string
): Promise<Subscription | null> => {
	try {
		return await apiRequest<Subscription>(
			`${WEBUI_API_BASE_URL}/billing/subscription/free`,
			token,
			{
				method: 'POST',
				body: JSON.stringify({ plan_id: planId })
			}
		);
	} catch (error) {
		console.error('Failed to activate free plan:', error);
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
