import { WEBUI_API_BASE_URL } from '$lib/constants';
import { requestJSON } from '$lib/utils/airis/request_json';
import type { SkillListItem } from '$lib/utils/airis/frontend-contracts';
import type { ToolAccessGrantInput } from '$lib/apis/tools';

export type SkillUserItem = SkillListItem & {
	access_grants: (SkillListItem['access_grants'][number] & ToolAccessGrantInput)[];
	user?: { id: string; name: string; email: string; username?: string } | null;
	write_access?: boolean | null;
};
export type SkillRecord = SkillUserItem & { content: string };
export type SkillForm = {
	id: string;
	name: string;
	content: string;
	description?: string | null;
	meta?: { tags?: string[] | null };
	is_active?: boolean;
	access_grants?: ToolAccessGrantInput[] | null;
};
export type SkillPage = { items: SkillUserItem[]; total: number };
const readSkillPage = (value: SkillPage): SkillPage => {
	if (!value || !Array.isArray(value.items) || !Number.isInteger(value.total) || value.total < 0)
		throw new Error('Invalid skills list response');
	return value;
};
export const createNewSkill = async (
	token: string,
	skill: SkillForm,
	signal?: AbortSignal
): Promise<SkillUserItem | null> =>
	requestJSON(`${WEBUI_API_BASE_URL}/skills/create`, token, skill, signal, 'Skill request');
export const getSkills = async (token = '', signal?: AbortSignal): Promise<SkillUserItem[]> => {
	const result = await requestJSON<SkillUserItem[]>(
		`${WEBUI_API_BASE_URL}/skills/`,
		token,
		undefined,
		signal,
		'Skill request'
	);
	if (!Array.isArray(result)) throw new Error('Invalid skills list response');
	return result;
};
export const getSkillList = async (token = '', signal?: AbortSignal): Promise<SkillPage> =>
	readSkillPage(
		await requestJSON<SkillPage>(
			`${WEBUI_API_BASE_URL}/skills/list`,
			token,
			undefined,
			signal,
			'Skill request'
		)
	);
export const getSkillItems = async (
	token = '',
	query: string | null = null,
	viewOption: string | null = null,
	page: number | null = null,
	orderBy: string | null = null,
	direction: string | null = null,
	signal?: AbortSignal
): Promise<SkillPage> => {
	const searchParams = new URLSearchParams();
	if (query) searchParams.append('query', query);
	if (viewOption) searchParams.append('view_option', viewOption);
	if (page) searchParams.append('page', page.toString());
	if (orderBy) searchParams.append('order_by', orderBy);
	if (direction) searchParams.append('direction', direction);
	return readSkillPage(
		await requestJSON<SkillPage>(
			`${WEBUI_API_BASE_URL}/skills/list?${searchParams.toString()}`,
			token,
			undefined,
			signal,
			'Skill request'
		)
	);
};
export const exportSkills = async (token = '', signal?: AbortSignal): Promise<SkillRecord[]> => {
	const result = await requestJSON<SkillRecord[]>(
		`${WEBUI_API_BASE_URL}/skills/export`,
		token,
		undefined,
		signal,
		'Skill request'
	);
	if (!Array.isArray(result)) throw new Error('Invalid skills list response');
	return result;
};
export const getSkillById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<SkillRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/skills/id/${encodeURIComponent(id)}`,
		token,
		undefined,
		signal,
		'Skill request'
	);
export const updateSkillById = async (
	token: string,
	id: string,
	skill: SkillForm,
	signal?: AbortSignal
): Promise<SkillRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/skills/id/${encodeURIComponent(id)}/update`,
		token,
		skill,
		signal,
		'Skill request'
	);
export const updateSkillAccessGrants = async (
	token: string,
	id: string,
	accessGrants: ToolAccessGrantInput[],
	signal?: AbortSignal
): Promise<SkillRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/skills/id/${encodeURIComponent(id)}/access/update`,
		token,
		{ access_grants: accessGrants },
		signal,
		'Skill request'
	);
export const toggleSkillById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<SkillRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/skills/id/${encodeURIComponent(id)}/toggle`,
		token,
		undefined,
		signal,
		'Skill request',
		'POST'
	);
export const deleteSkillById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<boolean> => {
	const result = await requestJSON<boolean>(
		`${WEBUI_API_BASE_URL}/skills/id/${encodeURIComponent(id)}/delete`,
		token,
		undefined,
		signal,
		'Skill request',
		'DELETE'
	);
	if (result !== true) throw new Error('Failed to delete skill.');
	return result;
};
