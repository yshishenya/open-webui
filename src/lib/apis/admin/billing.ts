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
	quotas?: Record<string, number | null>;
	features?: string[];
	is_active: boolean;
	display_order: number;
	plan_extra_metadata?: Record<string, any>;
	created_at: number;
	updated_at: number;
}

export interface PlanStats {
	plan: Plan;
	active_subscriptions: number;
	canceled_subscriptions: number;
	total_subscriptions: number;
	mrr: number;
}

export interface PlanSubscriber {
	user_id: string;
	email: string;
	name: string;
	subscription_status: string;
	subscribed_at: number;
	current_period_end: number;
}

export interface PaginatedSubscribers {
	items: PlanSubscriber[];
	total: number;
	page: number;
	page_size: number;
	total_pages: number;
}

export interface CreatePlanRequest {
	id?: string;
	name: string;
	name_ru?: string;
	description?: string;
	description_ru?: string;
	price: number;
	currency?: string;
	interval: string;
	quotas?: Record<string, number | null>;
	features?: string[];
	is_active?: boolean;
	display_order?: number;
	plan_extra_metadata?: Record<string, any>;
}

export interface UpdatePlanRequest {
	name?: string;
	name_ru?: string;
	description?: string;
	description_ru?: string;
	price?: number;
	currency?: string;
	interval?: string;
	quotas?: Record<string, number | null>;
	features?: string[];
	is_active?: boolean;
	display_order?: number;
	plan_extra_metadata?: Record<string, any>;
}

// ==================== Plans API ====================

export const getPlansWithStats = async (token: string): Promise<PlanStats[] | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/admin/billing/plans`, {
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

	const res = await fetch(`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}`, {
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

export const createPlan = async (
	token: string,
	data: CreatePlanRequest
): Promise<Plan | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/admin/billing/plans`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(data)
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

export const updatePlan = async (
	token: string,
	planId: string,
	data: UpdatePlanRequest
): Promise<Plan | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(data)
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

export const deletePlan = async (token: string, planId: string): Promise<boolean> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}`, {
		method: 'DELETE',
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

	return res?.success || false;
};

export const togglePlanActive = async (token: string, planId: string): Promise<Plan | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}/toggle`, {
		method: 'PATCH',
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

export const duplicatePlan = async (token: string, planId: string): Promise<Plan | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}/duplicate`, {
		method: 'POST',
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

export const getPlanSubscribers = async (
	token: string,
	planId: string,
	page: number = 1,
	pageSize: number = 20
): Promise<PaginatedSubscribers | null> => {
	let error = null;

	const params = new URLSearchParams({
		page: page.toString(),
		page_size: pageSize.toString()
	});

	const res = await fetch(`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}/subscribers?${params}`, {
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
