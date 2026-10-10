import { WEBUI_API_BASE_URL } from '$lib/constants';
import { requestJSON } from '$lib/utils/airis/request_json';
import type { ToolAccessGrantInput } from '$lib/apis/tools';

export type PromptForm = {
	id?: string;
	command: string;
	name: string;
	content: string;
	data?: Record<string, unknown> | null;
	meta?: Record<string, unknown> | null;
	tags?: (string | null)[] | null;
	access_grants?: ToolAccessGrantInput[] | null;
	version_id?: string | null;
	commit_message?: string | null;
	is_production?: boolean | null;
};
export type PromptRecord = Omit<PromptForm, 'id' | 'access_grants'> & {
	id: string | null;
	user_id: string;
	access_grants: ToolAccessGrantInput[];
	is_active?: boolean | null;
	created_at?: number | null;
	updated_at?: number | null;
	user?: { id: string; name: string; email: string } | null;
	write_access?: boolean | null;
};
export type PromptPage = { items: PromptRecord[]; total: number };
export type PromptHistoryItem = {
	id: string;
	prompt_id: string;
	parent_id: string | null;
	snapshot: Partial<PromptForm>;
	user_id: string;
	commit_message: string | null;
	created_at: number;
	user?: { id: string; name: string; email: string } | null;
};
export type PromptDiff = {
	from_id: string;
	to_id: string;
	from_snapshot: Partial<PromptForm>;
	to_snapshot: Partial<PromptForm>;
	content_diff: string[];
	name_changed: boolean;
};
const readPromptPage = (value: PromptPage): PromptPage => {
	if (!value || !Array.isArray(value.items) || !Number.isInteger(value.total) || value.total < 0)
		throw new Error('Invalid prompts list response');
	return value;
};
export const createNewPrompt = async (
	token: string,
	prompt: PromptForm,
	signal?: AbortSignal
): Promise<PromptRecord | null> => {
	const result = await requestJSON<PromptRecord | null>(
		`${WEBUI_API_BASE_URL}/prompts/create`,
		token,
		{
			...prompt,
			command: prompt.command.startsWith('/') ? prompt.command.slice(1) : prompt.command
		},
		signal,
		'Prompt request'
	);
	return result;
};
export const getPrompts = async (token = '', signal?: AbortSignal): Promise<PromptRecord[]> => {
	const result = await requestJSON<PromptRecord[]>(
		`${WEBUI_API_BASE_URL}/prompts/`,
		token,
		undefined,
		signal,
		'Prompt request'
	);
	if (!Array.isArray(result)) throw new Error('Invalid prompts list response');
	return result;
};
export const getPromptTags = async (token = '', signal?: AbortSignal): Promise<string[]> => {
	const result = await requestJSON<string[]>(
		`${WEBUI_API_BASE_URL}/prompts/tags`,
		token,
		undefined,
		signal,
		'Prompt request'
	);
	if (!Array.isArray(result)) throw new Error('Invalid prompts list response');
	return result;
};
export const getPromptItems = async (
	token = '',
	query: string | null,
	viewOption: string | null,
	selectedTag: string | null,
	orderBy: string | null,
	direction: string | null,
	page: number,
	signal?: AbortSignal
): Promise<PromptPage> => {
	const searchParams = new URLSearchParams();
	if (query) searchParams.append('query', query);
	if (viewOption) searchParams.append('view_option', viewOption);
	if (selectedTag) searchParams.append('tag', selectedTag);
	if (orderBy) searchParams.append('order_by', orderBy);
	if (direction) searchParams.append('direction', direction);
	if (page) searchParams.append('page', page.toString());
	return readPromptPage(
		await requestJSON<PromptPage>(
			`${WEBUI_API_BASE_URL}/prompts/list?${searchParams.toString()}`,
			token,
			undefined,
			signal,
			'Prompt request'
		)
	);
};
export const getPromptList = async (token = '', signal?: AbortSignal): Promise<PromptPage> => {
	const result = await requestJSON<PromptPage>(
		`${WEBUI_API_BASE_URL}/prompts/list`,
		token,
		undefined,
		signal,
		'Prompt request'
	);
	return readPromptPage(result);
};
export const getPromptById = async (
	token: string,
	promptId: string,
	signal?: AbortSignal
): Promise<PromptRecord | null> => {
	const result = await requestJSON<PromptRecord | null>(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(promptId)}`,
		token,
		undefined,
		signal,
		'Prompt request'
	);
	return result;
};
export const updatePromptById = async (
	token: string,
	prompt: PromptForm,
	signal?: AbortSignal
): Promise<PromptRecord | null> => {
	if (!prompt.id) throw new Error('Prompt id is required.');
	return requestJSON(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(prompt.id)}/update`,
		token,
		prompt,
		signal,
		'Prompt request'
	);
};
export const updatePromptMetadata = async (
	token: string,
	promptId: string,
	name: string,
	command: string,
	tags: string[] = [],
	signal?: AbortSignal
): Promise<PromptRecord | null> => {
	const result = await requestJSON<PromptRecord | null>(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(promptId)}/update/meta`,
		token,
		{ name, command, tags },
		signal,
		'Prompt request'
	);
	return result;
};
export const setProductionPromptVersion = async (
	token: string,
	promptId: string,
	version_id: string,
	signal?: AbortSignal
): Promise<PromptRecord | null> => {
	const result = await requestJSON<PromptRecord | null>(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(promptId)}/update/version`,
		token,
		{ version_id },
		signal,
		'Prompt request'
	);
	return result;
};
export const togglePromptById = async (
	token: string,
	promptId: string,
	signal?: AbortSignal
): Promise<PromptRecord | null> => {
	const result = await requestJSON<PromptRecord | null>(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(promptId)}/toggle`,
		token,
		undefined,
		signal,
		'Prompt request',
		'POST'
	);
	return result;
};
export const deletePromptById = async (
	token: string,
	promptId: string,
	signal?: AbortSignal
): Promise<boolean> => {
	const result = await requestJSON<boolean>(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(promptId)}/delete`,
		token,
		undefined,
		signal,
		'Prompt request',
		'DELETE'
	);
	if (result !== true) throw new Error('Failed to delete prompt version or prompt.');
	return result;
};
export const updatePromptAccessGrants = async (
	token: string,
	promptId: string,
	accessGrants: ToolAccessGrantInput[],
	signal?: AbortSignal
): Promise<PromptRecord | null> => {
	const result = await requestJSON<PromptRecord | null>(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(promptId)}/access/update`,
		token,
		{ access_grants: accessGrants },
		signal,
		'Prompt request'
	);
	return result;
};
export const getPromptHistory = async (
	token: string,
	promptId: string,
	page = 0,
	signal?: AbortSignal
): Promise<PromptHistoryItem[]> => {
	const result = await requestJSON<PromptHistoryItem[]>(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(promptId)}/history?page=${page}`,
		token,
		undefined,
		signal,
		'Prompt request'
	);
	if (!Array.isArray(result)) throw new Error('Invalid prompts list response');
	return result;
};
export const deletePromptHistoryVersion = async (
	token: string,
	promptId: string,
	historyId: string,
	signal?: AbortSignal
): Promise<boolean> => {
	const result = await requestJSON<boolean>(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(promptId)}/history/${encodeURIComponent(historyId)}`,
		token,
		undefined,
		signal,
		'Prompt request',
		'DELETE'
	);
	if (result !== true) throw new Error('Failed to delete prompt version or prompt.');
	return result;
};
export const getPromptHistoryEntry = async (
	token: string,
	promptId: string,
	historyId: string,
	signal?: AbortSignal
): Promise<PromptHistoryItem> => {
	const result = await requestJSON<PromptHistoryItem>(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(promptId)}/history/${encodeURIComponent(historyId)}`,
		token,
		undefined,
		signal,
		'Prompt request'
	);
	return result;
};
export const getPromptDiff = async (
	token: string,
	promptId: string,
	fromId: string,
	toId: string,
	signal?: AbortSignal
): Promise<PromptDiff> => {
	const result = await requestJSON<PromptDiff>(
		`${WEBUI_API_BASE_URL}/prompts/id/${encodeURIComponent(promptId)}/history/diff?${new URLSearchParams({ from_id: fromId, to_id: toId })}`,
		token,
		undefined,
		signal,
		'Prompt request'
	);
	return result;
};
