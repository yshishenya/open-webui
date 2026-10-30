import { WEBUI_API_BASE_URL } from '$lib/constants';
import { requestJSON } from '$lib/utils/airis/request_json';
import type { SkillListItem } from '$lib/utils/airis/frontend-contracts';
import type { ToolAccessGrantInput } from '$lib/apis/tools';

export type SkillUserItem = SkillListItem & {
	access_grants: (SkillListItem['access_grants'][number] & ToolAccessGrantInput)[];
	user?: { id: string; name: string; email: string; username?: string } | null;
	write_access?: boolean | null;
};
export type SkillRecord = SkillUserItem & { content: string; files?: SkillFile[]; version_id?: string | null };
export type SkillForm = {
	id: string;
	name: string;
	content?: string;
	files?: SkillFile[];
	operations?: SkillFileOperation[];
	expected_version_id?: string | null;
	commit_message?: string;
	version_id?: string | null;
	description?: string | null;
	meta?: { tags?: string[] | null; i18n?: Record<string, Record<string, string>> };
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
): Promise<SkillRecord | null> =>
	requestJSON(`${WEBUI_API_BASE_URL}/skills/create`, token, skill, signal, 'Skill request');
export const getSkills = async (token = '', signal?: AbortSignal, query: string | null = null): Promise<SkillUserItem[]> => {
	const result = await requestJSON<SkillUserItem[]>(
		`${WEBUI_API_BASE_URL}/skills/${query ? `?${new URLSearchParams({ query })}` : ''}`,
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
	skill: Omit<SkillForm, 'access_grants'>,
	signal?: AbortSignal
): Promise<SkillRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/skills/id/${encodeURIComponent(id)}/update`,
		token,
		{ ...skill, access_grants: undefined },
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

export type SkillFile = { path: string; content: string; encoding?: 'base64' };
export type SkillFileSummary = { path: string; size: number; encoding?: 'base64' | null };
export type SkillFileOperation = {
	op: 'put' | 'move' | 'delete';
	path: string;
	content?: string;
	encoding?: 'base64';
	destination?: string;
};

export const skillRequest = async (token: string, path: string, options: RequestInit = {}) => {
	const response = await fetch(`${WEBUI_API_BASE_URL}/skills${path}`, {
		...options,
		headers: {
			authorization: `Bearer ${token}`,
			...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
			...options.headers
		}
	});
	if (!response.ok) {
		const body = await response.json();
		throw body.detail ?? body;
	}
	return response;
};
export const getSkillFiles = async (token: string, id: string, versionId: string) =>
	(
		await skillRequest(token, `/id/${id}/files?${new URLSearchParams({ version_id: versionId })}`)
	).json();
export const getSkillFile = async (token: string, id: string, versionId: string, path: string) =>
	(
		await skillRequest(
			token,
			`/id/${id}/files/content?${new URLSearchParams({ version_id: versionId, path })}`
		)
	).blob();
export const getSkillHistory = async (token: string, id: string, page = 1) =>
	(await skillRequest(token, `/id/${id}/history?page=${page}`)).json();
export const getSkillVersion = async (token: string, id: string, versionId: string) =>
	(await skillRequest(token, `/id/${id}/history/${versionId}`)).json();
export const deleteSkillHistoryVersion = async (token: string, id: string, versionId: string) =>
	(await skillRequest(token, `/id/${id}/history/${versionId}`, { method: 'DELETE' })).json();
export const setProductionSkillVersion = async (
	token: string,
	id: string,
	versionId: string,
	expectedVersionId: string
) =>
	(
		await skillRequest(token, `/id/${id}/update/version`, {
			method: 'POST',
			body: JSON.stringify({ version_id: versionId, expected_version_id: expectedVersionId })
		})
	).json();
export const cloneSkill = async (
	token: string,
	id: string,
	name: string,
	newId: string,
	versionId?: string
) =>
	(
		await skillRequest(token, `/id/${id}/clone`, {
			method: 'POST',
			body: JSON.stringify({ id: newId, name, version_id: versionId })
		})
	).json();
export const exportSkillBundle = async (
	token: string,
	format: 'json' | 'zip' | 'skill',
	ids: string[] = [],
	versionId?: string
) => {
	const query = new URLSearchParams({ format });
	ids.forEach((id) => query.append('ids', id));
	if (versionId) query.set('version_id', versionId);
	return (await skillRequest(token, `/export?${query}`)).blob();
};
export const importSkillBundles = async (token: string, files: File[], decisions?: object[]) => {
	const body = new FormData();
	files.forEach((file) => body.append('files', file, file.webkitRelativePath || file.name));
	if (decisions) body.append('decisions', JSON.stringify(decisions));
	return (
		await skillRequest(token, decisions ? '/import' : '/import/preview', { method: 'POST', body })
	).json();
};
export const loadSkillByUrl = async (token: string, url: string, signal?: AbortSignal) =>
	(
		await skillRequest(token, '/load/url', {
			signal,
			method: 'POST',
			body: JSON.stringify({ url })
		})
	).json();
export const skillError = (error: unknown): string =>
	error instanceof Error
		? error.message
		: typeof error === 'string'
			? error
			: JSON.stringify(error);

export const downloadSkillBlob = (blob: Blob, filename: string) => {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
};
