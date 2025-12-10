import { WEBUI_API_BASE_URL } from '$lib/constants';

// Types
export interface Plan {
	id: string;
	name: string;
	name_ru?: string;
	description?: string;
	description_ru?: string;
	price: number;
	currency: string;
	interval: string;
	quotas?: Record<string, number>;
	features?: string[];
	is_active: boolean;
	display_order: number;
	created_at: number;
	updated_at: number;
}

export interface Subscription {
	id: string;
	user_id: string;
	plan_id: string;
	status: string;
	yookassa_payment_id?: string;
	yookassa_subscription_id?: string;
	current_period_start: number;
	current_period_end: number;
	cancel_at_period_end: boolean;
	trial_end?: number;
	metadata?: Record<string, any>;
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
	metadata?: Record<string, any>;
	created_at: number;
	updated_at: number;
}

export interface UsageInfo {
	metric: string;
	current_usage: number;
	quota_limit?: number;
	remaining?: number;
}

export interface BillingInfo {
	subscription?: Subscription;
	plan?: Plan;
	usage: Record<string, UsageInfo>;
	transactions: Transaction[];
}

export interface PaymentResponse {
	transaction_id: string;
	payment_id: string;
	confirmation_url: string;
	status: string;
}

// ==================== Plans API ====================

export const getPlans = async (token: string): Promise<Plan[] | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/billing/plans`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getPlan = async (token: string, planId: string): Promise<Plan | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/billing/plans/${planId}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

// ==================== Subscription API ====================

export const getMySubscription = async (token: string): Promise<Subscription | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/billing/subscription`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const cancelSubscription = async (
	token: string,
	immediate: boolean = false
): Promise<Subscription | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/billing/subscription/cancel`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ immediate })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

// ==================== Payment API ====================

export const createPayment = async (
	token: string,
	planId: string,
	returnUrl: string
): Promise<PaymentResponse | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/billing/payment`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			plan_id: planId,
			return_url: returnUrl
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getTransactions = async (
	token: string,
	limit: number = 50,
	skip: number = 0
): Promise<Transaction[] | null> => {
	let error = null;

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/billing/transactions?limit=${limit}&skip=${skip}`,
		{
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

// ==================== Usage API ====================

export const getUsage = async (token: string, metric: string): Promise<UsageInfo | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/billing/usage/${metric}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const checkQuota = async (
	token: string,
	metric: string,
	amount: number = 1
): Promise<{ allowed: boolean; current_usage: number; quota_limit?: number; remaining?: number } | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/billing/usage/check`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ metric, amount })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

// ==================== Billing Info API ====================

export const getBillingInfo = async (token: string): Promise<BillingInfo | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/billing/me`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};
