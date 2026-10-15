import { WEBUI_API_BASE_URL } from '$lib/constants';
import { requestJSON } from '$lib/utils/airis/request_json';
import type { ModelMeta } from '$lib/apis';
import type { Model } from '$lib/stores';
import type { ToolAccessGrantInput } from '$lib/apis/tools';
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

export type ArenaModel = {
	id: string;
	name: string;
	meta: ModelMeta & {
		model_ids?: string[] | null;
		filter_mode?: string | null;
		access_grants?: ToolAccessGrantInput[] | null;
	};
};
export type EvaluationConfig = {
	ENABLE_EVALUATION_ARENA_MODELS: boolean;
	EVALUATION_ARENA_MODELS: ArenaModel[];
};
export type EvaluationTag = { tag: string; count: number };
export type LeaderboardEntry = {
	model_id: string;
	rating: number;
	won: number;
	lost: number;
	count: number;
	top_tags: EvaluationTag[];
};
export type LeaderboardResponse = { entries: LeaderboardEntry[] };
export type ModelHistoryEntry = { date: string; won: number; lost: number };
export type ModelHistoryResponse = { model_id: string; history: ModelHistoryEntry[] };
export type RankedModel = Model & {
	rating: number | '-';
	stats: { count: number; won: string; lost: string };
	top_tags: EvaluationTag[];
};

const readEvaluationConfig = (value: EvaluationConfig): EvaluationConfig => {
	if (
		!value ||
		typeof value.ENABLE_EVALUATION_ARENA_MODELS !== 'boolean' ||
		!Array.isArray(value.EVALUATION_ARENA_MODELS) ||
		value.EVALUATION_ARENA_MODELS.some(
			(model) =>
				!model ||
				typeof model.id !== 'string' ||
				typeof model.name !== 'string' ||
				!model.meta ||
				typeof model.meta !== 'object'
		)
	)
		throw new Error('Invalid evaluation configuration response');
	return value;
};
export const getConfig = async (token = ''): Promise<EvaluationConfig> =>
	readEvaluationConfig(
		await requestJSON<EvaluationConfig>(`${WEBUI_API_BASE_URL}/evaluations/config`, token)
	);

export const updateConfig = async (
	token: string,
	config: EvaluationConfig
): Promise<EvaluationConfig> =>
	readEvaluationConfig(
		await requestJSON<EvaluationConfig>(`${WEBUI_API_BASE_URL}/evaluations/config`, token, config)
	);

export const getLeaderboard = async (token = '', query = ''): Promise<LeaderboardResponse> => {
	const searchParams = new URLSearchParams();
	if (query) searchParams.append('query', query);
	const result = await requestJSON<LeaderboardResponse>(
		`${WEBUI_API_BASE_URL}/evaluations/leaderboard?${searchParams}`,
		token
	);
	if (
		!result ||
		!Array.isArray(result.entries) ||
		result.entries.some(
			(entry) =>
				!entry ||
				typeof entry.model_id !== 'string' ||
				!Number.isFinite(entry.rating) ||
				!Number.isInteger(entry.won) ||
				entry.won < 0 ||
				!Number.isInteger(entry.lost) ||
				entry.lost < 0 ||
				!Number.isInteger(entry.count) ||
				entry.count < 0 ||
				!Array.isArray(entry.top_tags) ||
				entry.top_tags.some(
					(tag) =>
						!tag || typeof tag.tag !== 'string' || !Number.isInteger(tag.count) || tag.count < 0
				)
		)
	)
		throw new Error('Invalid leaderboard response');
	return result;
};

export const getModelHistory = async (
	token: string = '',
	modelId: string,
	days: number = 30
): Promise<ModelHistoryResponse> => {
	const searchParams = new URLSearchParams({ days: days.toString() });
	const result = await requestJSON<ModelHistoryResponse>(
		`${WEBUI_API_BASE_URL}/evaluations/leaderboard/${encodeURIComponent(modelId)}/history?${searchParams}`,
		token
	);
	if (
		!result ||
		result.model_id !== modelId ||
		!Array.isArray(result.history) ||
		result.history.some(
			(entry) =>
				!entry ||
				typeof entry.date !== 'string' ||
				!Number.isInteger(entry.won) ||
				entry.won < 0 ||
				!Number.isInteger(entry.lost) ||
				entry.lost < 0
		)
	)
		throw new Error('Invalid model history response');
	return result;
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
