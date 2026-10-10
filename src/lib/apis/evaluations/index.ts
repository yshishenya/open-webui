import { WEBUI_API_BASE_URL } from '$lib/constants';
import { requestJSON } from '$lib/utils/airis/request_json';
import type { ChatHistory } from '$lib/utils/airis/chat_history';

export type FeedbackRecord = Record<string, unknown> & {
	id: string;
	user_id: string;
	created_at: number;
	updated_at: number;
	data?:
		| (Record<string, unknown> & {
				chat_id?: string | null;
				model_id?: string | null;
				sibling_model_ids?: string[] | null;
				rating?: string | number | null;
				reason?: string | null;
				comment?: string | null;
				tags?: string[] | null;
				details?: { rating?: string | number | null } | null;
		  })
		| null;
	meta?: { chat_id?: string | null; message_id?: string | null } | null;
	snapshot?: { chat?: { chat?: { history?: Partial<ChatHistory> | null } | null } | null } | null;
};
export type FeedbackItem = FeedbackRecord & { user?: { id: string; name: string } | null };
export type FeedbackList = { items: FeedbackItem[]; total: number };

export const getConfig = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/config`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const updateConfig = async (token: string, config: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/config`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...config
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getLeaderboard = async (token: string = '', query: string = '') => {
	let error = null;

	const searchParams = new URLSearchParams();
	if (query) searchParams.append('query', query);

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/evaluations/leaderboard?${searchParams.toString()}`,
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getModelHistory = async (token: string = '', modelId: string, days: number = 30) => {
	let error = null;

	const searchParams = new URLSearchParams();
	searchParams.append('days', days.toString());

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/evaluations/leaderboard/${encodeURIComponent(modelId)}/history?${searchParams.toString()}`,
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getFeedbackModelIds = async (
	token: string = '',
	signal?: AbortSignal
): Promise<string[]> => {
	const res = await requestJSON<string[]>(
		`${WEBUI_API_BASE_URL}/evaluations/feedbacks/models`,
		token,
		undefined,
		signal,
		'Feedback models'
	);
	if (!Array.isArray(res) || res.some((id) => typeof id !== 'string'))
		throw new Error('Invalid feedback models response');
	return res;
};

export const getFeedbackItems = async (
	token: string = '',
	orderBy: string,
	direction: 'asc' | 'desc',
	page: number,
	modelId: string = '',
	signal?: AbortSignal
): Promise<FeedbackList> => {
	const searchParams = new URLSearchParams();
	if (orderBy) searchParams.append('order_by', orderBy);
	if (direction) searchParams.append('direction', direction);
	if (page) searchParams.append('page', page.toString());
	if (modelId) searchParams.append('model_id', modelId);
	const res = await requestJSON<FeedbackList>(
		`${WEBUI_API_BASE_URL}/evaluations/feedbacks/list?${searchParams}`,
		token,
		undefined,
		signal,
		'Feedback list'
	);
	if (
		!res ||
		!Array.isArray(res.items) ||
		res.items.some((item) => !item || typeof item.id !== 'string') ||
		!Number.isInteger(res.total) ||
		res.total < 0
	)
		throw new Error('Invalid feedback list response');
	return res;
};

export const exportAllFeedbacks = async (
	token: string = '',
	modelId: string = '',
	signal?: AbortSignal
): Promise<FeedbackRecord[]> => {
	const searchParams = new URLSearchParams();
	if (modelId) searchParams.append('model_id', modelId);
	const res = await requestJSON<FeedbackRecord[]>(
		`${WEBUI_API_BASE_URL}/evaluations/feedbacks/all/export?${searchParams}`,
		token,
		undefined,
		signal,
		'Feedback export'
	);
	if (!Array.isArray(res) || res.some((item) => !item || typeof item.id !== 'string'))
		throw new Error('Invalid feedback export response');
	return res;
};

export const createNewFeedback = async (token: string, feedback: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/feedback`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...feedback
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getFeedbackById = async (
	token: string,
	feedbackId: string,
	signal?: AbortSignal
): Promise<FeedbackRecord> => {
	const res = await requestJSON<FeedbackRecord>(
		`${WEBUI_API_BASE_URL}/evaluations/feedback/${encodeURIComponent(feedbackId)}`,
		token,
		undefined,
		signal,
		'Feedback details'
	);
	if (!res || typeof res.id !== 'string' || res.id !== feedbackId)
		throw new Error('Invalid feedback details response');
	return res;
};

export const updateFeedbackById = async (token: string, feedbackId: string, feedback: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/feedback/${feedbackId}`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...feedback
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const deleteFeedbackById = async (token: string, feedbackId: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/evaluations/feedback/${feedbackId}`, {
		method: 'DELETE',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};
