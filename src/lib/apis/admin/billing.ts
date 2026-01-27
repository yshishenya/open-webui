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

export interface RateCard {
	id: string;
	model_id: string;
	model_tier?: string | null;
	modality: string;
	unit: string;
	raw_cost_per_unit_kopeks: number;
	version: string;
	created_at: number;
	provider?: string | null;
	is_default: boolean;
	is_active: boolean;
}

export interface RateCardListResponse {
	items: RateCard[];
	total: number;
	page: number;
	page_size: number;
	total_pages: number;
}

export interface RateCardCreateRequest {
	id?: string;
	model_id: string;
	model_tier?: string | null;
	modality: string;
	unit: string;
	raw_cost_per_unit_kopeks?: number;
	version?: string;
	provider?: string | null;
	is_default?: boolean;
	is_active?: boolean;
}

export interface RateCardUpdateRequest {
	model_tier?: string | null;
	raw_cost_per_unit_kopeks?: number;
	provider?: string | null;
	is_default?: boolean;
	is_active?: boolean;
}

export interface RateCardBulkDeleteRequest {
	rate_card_ids: string[];
}

export interface RateCardDeleteModelsRequest {
	model_ids: string[];
}

export interface RateCardDeleteResponse {
	deleted: number;
}

export interface RateCardDeactivateResponse {
	deactivated: number;
}

export interface RateCardSyncRequest {
	model_ids?: string[];
	modality_units?: { modality: string; unit: string }[];
	version?: string;
	provider?: string | null;
	model_tier?: string | null;
	is_active?: boolean;
	is_default?: boolean;
}

export interface RateCardSyncResponse {
	created: number;
	skipped: number;
	model_ids: string[];
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
	profile_image_url?: string;
	role: string;
	subscription_status: string;
	subscribed_at: number;
	current_period_start: number;
	current_period_end: number;
	tokens_input_used: number;
	tokens_input_limit?: number;
	tokens_output_used: number;
	tokens_output_limit?: number;
	requests_used: number;
	requests_limit?: number;
}

export interface UserSubscriptionInfo {
	user_id: string;
	subscription: {
		id: string;
		user_id: string;
		plan_id: string;
		status: string;
		current_period_start: number;
		current_period_end: number;
		created_at: number;
	} | null;
	plan: Plan | null;
	usage: Record<
		string,
		{
			used: number;
			limit: number | null;
			remaining: number | null;
			percentage: number | null;
		}
	>;
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
	plan_extra_metadata?: Record<string, unknown>;
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
	plan_extra_metadata?: Record<string, unknown>;
}

export interface ChangeUserPlanRequest {
	plan_id: string;
	reset_usage?: boolean;
}

export interface ChangeUserPlanResponse {
	success: boolean;
	subscription: {
		id: string;
		user_id: string;
		plan_id: string;
		status: string;
		current_period_start: number;
		current_period_end: number;
	};
	plan: Plan;
}

export interface LeadMagnetQuotas {
	tokens_input: number;
	tokens_output: number;
	images: number;
	tts_seconds: number;
	stt_seconds: number;
}

export interface LeadMagnetConfig {
	enabled: boolean;
	cycle_days: number;
	quotas: LeadMagnetQuotas;
	config_version: number;
}

export interface LeadMagnetConfigRequest {
	enabled: boolean;
	cycle_days: number;
	quotas: LeadMagnetQuotas;
}

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

// ==================== Plans API ====================

/**
 * Get all plans with statistics (admin only)
 * @param token - Auth token
 * @returns List of plans with stats
 */
export const getPlansWithStats = async (token: string): Promise<PlanStats[]> => {
	try {
		return await apiRequest<PlanStats[]>(`${WEBUI_API_BASE_URL}/admin/billing/plans`, token);
	} catch (error) {
		console.error('Failed to get plans with stats:', error);
		throw error;
	}
};

/**
 * Get a specific plan by ID (admin only)
 * @param token - Auth token
 * @param planId - Plan ID
 * @returns Plan details
 */
export const getPlan = async (token: string, planId: string): Promise<Plan> => {
	try {
		return await apiRequest<Plan>(`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}`, token);
	} catch (error) {
		console.error('Failed to get plan:', error);
		throw error;
	}
};

/**
 * Create a new plan (admin only)
 * @param token - Auth token
 * @param data - Plan data
 * @returns Created plan
 */
export const createPlan = async (token: string, data: CreatePlanRequest): Promise<Plan> => {
	try {
		return await apiRequest<Plan>(`${WEBUI_API_BASE_URL}/admin/billing/plans`, token, {
			method: 'POST',
			body: JSON.stringify(data)
		});
	} catch (error) {
		console.error('Failed to create plan:', error);
		throw error;
	}
};

/**
 * Update an existing plan (admin only)
 * @param token - Auth token
 * @param planId - Plan ID
 * @param data - Updated plan data
 * @returns Updated plan
 */
export const updatePlan = async (
	token: string,
	planId: string,
	data: UpdatePlanRequest
): Promise<Plan> => {
	try {
		return await apiRequest<Plan>(`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}`, token, {
			method: 'PUT',
			body: JSON.stringify(data)
		});
	} catch (error) {
		console.error('Failed to update plan:', error);
		throw error;
	}
};

/**
 * Delete a plan (admin only)
 * @param token - Auth token
 * @param planId - Plan ID
 * @returns Success status
 */
export const deletePlan = async (token: string, planId: string): Promise<boolean> => {
	try {
		const result = await apiRequest<{ success: boolean }>(
			`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}`,
			token,
			{ method: 'DELETE' }
		);
		return result?.success || false;
	} catch (error) {
		console.error('Failed to delete plan:', error);
		throw error;
	}
};

// ==================== Rate Card API ====================

export const listRateCards = async (
	token: string,
	params: {
		model_id?: string;
		modality?: string;
		unit?: string;
		version?: string;
		provider?: string;
		is_active?: boolean;
		page?: number;
		page_size?: number;
	} = {}
): Promise<RateCardListResponse> => {
	try {
		const searchParams = new URLSearchParams();
		if (params.model_id) searchParams.set('model_id', params.model_id);
		if (params.modality) searchParams.set('modality', params.modality);
		if (params.unit) searchParams.set('unit', params.unit);
		if (params.version) searchParams.set('version', params.version);
		if (params.provider) searchParams.set('provider', params.provider);
		if (typeof params.is_active === 'boolean') {
			searchParams.set('is_active', String(params.is_active));
		}
		if (params.page) searchParams.set('page', String(params.page));
		if (params.page_size) searchParams.set('page_size', String(params.page_size));

		const query = searchParams.toString();
		const url = query
			? `${WEBUI_API_BASE_URL}/admin/billing/rate-card?${query}`
			: `${WEBUI_API_BASE_URL}/admin/billing/rate-card`;
		return await apiRequest<RateCardListResponse>(url, token);
	} catch (error) {
		console.error('Failed to load rate cards:', error);
		throw error;
	}
};

export const createRateCard = async (
	token: string,
	data: RateCardCreateRequest
): Promise<RateCard> => {
	try {
		return await apiRequest<RateCard>(`${WEBUI_API_BASE_URL}/admin/billing/rate-card`, token, {
			method: 'POST',
			body: JSON.stringify(data)
		});
	} catch (error) {
		console.error('Failed to create rate card:', error);
		throw error;
	}
};

export const updateRateCard = async (
	token: string,
	rateCardId: string,
	data: RateCardUpdateRequest
): Promise<RateCard> => {
	try {
		return await apiRequest<RateCard>(
			`${WEBUI_API_BASE_URL}/admin/billing/rate-card/${rateCardId}`,
			token,
			{
				method: 'PATCH',
				body: JSON.stringify(data)
			}
		);
	} catch (error) {
		console.error('Failed to update rate card:', error);
		throw error;
	}
};

export const deleteRateCard = async (token: string, rateCardId: string): Promise<boolean> => {
	try {
		return await apiRequest<boolean>(
			`${WEBUI_API_BASE_URL}/admin/billing/rate-card/${rateCardId}`,
			token,
			{
				method: 'DELETE'
			}
		);
	} catch (error) {
		console.error('Failed to delete rate card:', error);
		throw error;
	}
};

export const bulkDeleteRateCards = async (
	token: string,
	data: RateCardBulkDeleteRequest
): Promise<RateCardDeleteResponse> => {
	try {
		return await apiRequest<RateCardDeleteResponse>(
			`${WEBUI_API_BASE_URL}/admin/billing/rate-card/bulk-delete`,
			token,
			{
				method: 'POST',
				body: JSON.stringify(data)
			}
		);
	} catch (error) {
		console.error('Failed to delete rate cards:', error);
		throw error;
	}
};

export const deleteRateCardsByModel = async (
	token: string,
	data: RateCardDeleteModelsRequest
): Promise<RateCardDeleteResponse> => {
	try {
		return await apiRequest<RateCardDeleteResponse>(
			`${WEBUI_API_BASE_URL}/admin/billing/rate-card/delete-models`,
			token,
			{
				method: 'POST',
				body: JSON.stringify(data)
			}
		);
	} catch (error) {
		console.error('Failed to delete model rate cards:', error);
		throw error;
	}
};

export const deactivateRateCardsByModel = async (
	token: string,
	data: RateCardDeleteModelsRequest
): Promise<RateCardDeactivateResponse> => {
	try {
		return await apiRequest<RateCardDeactivateResponse>(
			`${WEBUI_API_BASE_URL}/admin/billing/rate-card/deactivate-models`,
			token,
			{
				method: 'POST',
				body: JSON.stringify(data)
			}
		);
	} catch (error) {
		console.error('Failed to deactivate model rate cards:', error);
		throw error;
	}
};

export const syncRateCards = async (
	token: string,
	data: RateCardSyncRequest
): Promise<RateCardSyncResponse> => {
	try {
		return await apiRequest<RateCardSyncResponse>(
			`${WEBUI_API_BASE_URL}/admin/billing/rate-card/sync-models`,
			token,
			{
				method: 'POST',
				body: JSON.stringify(data)
			}
		);
	} catch (error) {
		console.error('Failed to sync rate cards:', error);
		throw error;
	}
};

// ==================== Lead Magnet API ====================

export const getLeadMagnetConfig = async (token: string): Promise<LeadMagnetConfig | null> => {
	try {
		return await apiRequest<LeadMagnetConfig>(
			`${WEBUI_API_BASE_URL}/admin/billing/lead-magnet`,
			token
		);
	} catch (error) {
		console.error('Failed to load lead magnet config:', error);
		throw error;
	}
};

export const updateLeadMagnetConfig = async (
	token: string,
	data: LeadMagnetConfigRequest
): Promise<LeadMagnetConfig | null> => {
	try {
		return await apiRequest<LeadMagnetConfig>(
			`${WEBUI_API_BASE_URL}/admin/billing/lead-magnet`,
			token,
			{
				method: 'POST',
				body: JSON.stringify(data)
			}
		);
	} catch (error) {
		console.error('Failed to update lead magnet config:', error);
		throw error;
	}
};

/**
 * Toggle plan active status (admin only)
 * @param token - Auth token
 * @param planId - Plan ID
 * @returns Updated plan
 */
export const togglePlanActive = async (token: string, planId: string): Promise<Plan> => {
	try {
		return await apiRequest<Plan>(
			`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}/toggle`,
			token,
			{ method: 'PATCH' }
		);
	} catch (error) {
		console.error('Failed to toggle plan:', error);
		throw error;
	}
};

/**
 * Duplicate a plan (admin only)
 * @param token - Auth token
 * @param planId - Plan ID to duplicate
 * @returns New duplicated plan
 */
export const duplicatePlan = async (token: string, planId: string): Promise<Plan> => {
	try {
		return await apiRequest<Plan>(
			`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}/duplicate`,
			token,
			{ method: 'POST' }
		);
	} catch (error) {
		console.error('Failed to duplicate plan:', error);
		throw error;
	}
};

/**
 * Get subscribers for a plan (admin only)
 * @param token - Auth token
 * @param planId - Plan ID
 * @param page - Page number
 * @param pageSize - Items per page
 * @returns Paginated subscribers
 */
export const getPlanSubscribers = async (
	token: string,
	planId: string,
	page: number = 1,
	pageSize: number = 20
): Promise<PaginatedSubscribers> => {
	try {
		const params = new URLSearchParams({
			page: page.toString(),
			page_size: pageSize.toString()
		});
		return await apiRequest<PaginatedSubscribers>(
			`${WEBUI_API_BASE_URL}/admin/billing/plans/${planId}/subscribers?${params}`,
			token
		);
	} catch (error) {
		console.error('Failed to get plan subscribers:', error);
		throw error;
	}
};

/**
 * Get user subscription info (admin only)
 * @param token - Auth token
 * @param userId - User ID
 * @returns User subscription info
 */
export const getUserSubscription = async (
	token: string,
	userId: string
): Promise<UserSubscriptionInfo | null> => {
	try {
		return await apiRequest<UserSubscriptionInfo>(
			`${WEBUI_API_BASE_URL}/admin/billing/users/${userId}/subscription`,
			token
		);
	} catch (error) {
		console.error('Failed to get user subscription:', error);
		throw error;
	}
};

/**
 * Change user subscription plan (admin only)
 * @param token - Auth token
 * @param userId - User ID
 * @param data - Plan change data
 * @returns Change result
 */
export const changeUserSubscription = async (
	token: string,
	userId: string,
	data: ChangeUserPlanRequest
): Promise<ChangeUserPlanResponse> => {
	try {
		return await apiRequest<ChangeUserPlanResponse>(
			`${WEBUI_API_BASE_URL}/admin/billing/users/${userId}/subscription`,
			token,
			{
				method: 'PUT',
				body: JSON.stringify(data)
			}
		);
	} catch (error) {
		console.error('Failed to change user subscription:', error);
		throw error;
	}
};

/**
 * Get all active plans (admin only)
 * Convenience method that extracts plans from stats response
 * @param token - Auth token
 * @returns List of active plans
 */
export const getActivePlans = async (token: string): Promise<Plan[]> => {
	try {
		const stats = await getPlansWithStats(token);
		return stats.map((stat) => stat.plan);
	} catch (error) {
		console.error('Failed to get active plans:', error);
		throw error;
	}
};
