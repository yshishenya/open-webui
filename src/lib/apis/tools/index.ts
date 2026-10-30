import { requestJSON } from '$lib/utils/airis/request_json';
import { WEBUI_API_BASE_URL } from '$lib/constants';
import {
	requestUserValves,
	readValveSpec,
	type ValveValues,
	type ValveSpec
} from '$lib/utils/airis/userValves';

import type { ToolListItem } from '$lib/utils/airis/frontend-contracts';

export type ToolAccessGrantInput = {
	id?: string;
	principal_type: 'user' | 'group' | 'anyone';
	principal_id: string;
	permission: 'read' | 'write';
};
export type ToolUserItem = ToolListItem & {
	user?: { id: string; name: string; email: string; username?: string } | null;
	write_access?: boolean | null;
};
export type ToolRecord = ToolUserItem & { content?: string | null };
export type ToolForm = {
	commit_message?: string | null;
	id: string;
	name: string;
	content: string;
	meta: Partial<ToolListItem['meta']> & Record<string, unknown>;
	access_grants?: ToolAccessGrantInput[] | null;
};

export const createNewTool = async (
	token: string,
	tool: ToolForm,
	signal?: AbortSignal
): Promise<ToolListItem | null> =>
	requestJSON(`${WEBUI_API_BASE_URL}/tools/create`, token, tool, signal, 'Tool request');
export const loadToolByUrl = async (
	token: string = '',
	url: string,
	signal?: AbortSignal
): Promise<{ name: string; content: string } | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/tools/load/url`,
		token,
		{ url },
		signal,
		'Tool source request'
	);

export const getTools = async (token = '', signal?: AbortSignal, query: string | null = null): Promise<ToolListItem[]> => {
	const result = await requestJSON<ToolListItem[]>(
		`${WEBUI_API_BASE_URL}/tools/${query ? `?${new URLSearchParams({ query })}` : ''}`,
		token,
		undefined,
		signal,
		'Tool request'
	);
	if (!Array.isArray(result)) throw new Error('Invalid tools list response');
	return result;
};

export const getToolList = async (token = '', signal?: AbortSignal): Promise<ToolUserItem[]> => {
	const result = await requestJSON<ToolUserItem[]>(
		`${WEBUI_API_BASE_URL}/tools/list`,
		token,
		undefined,
		signal,
		'Tool request'
	);
	if (!Array.isArray(result)) throw new Error('Invalid tools list response');
	return result;
};

export const getToolSpecs = async (token: string, id: string) => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/specs`, {
		headers: { Accept: 'application/json', authorization: `Bearer ${token}` }
	});
	if (!res.ok) {
		throw { status: res.status };
	}
	return (await res.json()).specs;
};

export const exportTools = async (token = '', signal?: AbortSignal): Promise<ToolRecord[]> => {
	const result = await requestJSON<ToolRecord[]>(
		`${WEBUI_API_BASE_URL}/tools/export`,
		token,
		undefined,
		signal,
		'Tool request'
	);
	if (!Array.isArray(result)) throw new Error('Invalid tools list response');
	return result;
};

export const getToolById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<ToolRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}`,
		token,
		undefined,
		signal,
		'Tool request'
	);
export const updateToolById = async (
	token: string,
	id: string,
	tool: Omit<ToolForm, 'access_grants'>,
	signal?: AbortSignal
): Promise<ToolRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/update`,
		token,
		{ ...tool, access_grants: undefined },
		signal,
		'Tool request'
	);
export const updateToolAccessGrants = async (
	token: string,
	id: string,
	accessGrants: ToolAccessGrantInput[],
	signal?: AbortSignal
): Promise<ToolRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/access/update`,
		token,
		{ access_grants: accessGrants },
		signal,
		'Tool request'
	);
export const deleteToolById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<boolean> => {
	const result = await requestJSON<boolean>(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/delete`,
		token,
		undefined,
		signal,
		'Tool request',
		'DELETE'
	);
	if (result !== true) throw new Error('Failed to delete tool.');
	return result;
};

export const getToolValvesById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<ValveValues | null> =>
	requestUserValves(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/valves`,
		token,
		undefined,
		signal
	);

export const getToolValvesSpecById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<ValveSpec | null> =>
	readValveSpec(
		await requestUserValves(
			`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/valves/spec`,
			token,
			undefined,
			signal
		)
	);

export const updateToolValvesById = async (
	token: string,
	id: string,
	valves: object,
	signal?: AbortSignal
): Promise<ValveValues | null> =>
	requestUserValves(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/valves/update`,
		token,
		valves,
		signal
	);

export const getUserValvesById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<ValveValues | null> =>
	requestUserValves(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/valves/user`,
		token,
		undefined,
		signal
	);

export const getUserValvesSpecById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<ValveSpec | null> =>
	readValveSpec(
		await requestUserValves(
			`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/valves/user/spec`,
			token,
			undefined,
			signal
		)
	);

export const updateUserValvesById = async (
	token: string,
	id: string,
	valves: object,
	signal?: AbortSignal
): Promise<ValveValues | null> =>
	requestUserValves(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/valves/user/update`,
		token,
		valves,
		signal
	);
export type ToolHistoryEntry = {
	id: string;
	tool_id: string;
	parent_id: string | null;
	user_id: string;
	commit_message: string | null;
	created_at: number;
	user?: { name: string } | null;
};

export type ToolSnapshot = {
	name: string;
	content: string;
	meta: Record<string, any>;
};

export const getToolHistory = async (
	token: string,
	id: string,
	page = 1
): Promise<ToolHistoryEntry[]> => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/history?page=${page}`,
		{
			method: 'GET',
			headers: { authorization: `Bearer ${token}` }
		}
	);
	if (!response.ok) throw await response.json();
	return response.json();
};

export const getToolHistoryEntry = async (
	token: string,
	id: string,
	versionId: string
): Promise<ToolHistoryEntry & { snapshot: ToolSnapshot }> => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/history/${encodeURIComponent(versionId)}`,
		{
			method: 'GET',
			headers: { authorization: `Bearer ${token}` }
		}
	);
	if (!response.ok) throw await response.json();
	return response.json();
};

export const getToolHistoryDiff = async (
	token: string,
	id: string,
	fromId: string,
	toId: string
) => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/history/diff?${new URLSearchParams({ from_id: fromId, to_id: toId })}`,
		{
			method: 'GET',
			headers: { authorization: `Bearer ${token}` }
		}
	);
	if (!response.ok) throw await response.json();
	return response.json();
};

export const deleteToolHistoryVersion = async (token: string, id: string, versionId: string) => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/history/${encodeURIComponent(versionId)}`,
		{
			method: 'DELETE',
			headers: { authorization: `Bearer ${token}` }
		}
	);
	if (!response.ok) throw await response.json();
	return response.json();
};

export const setProductionToolVersion = async (token: string, id: string, versionId: string) => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/update/version`,
		{
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ version_id: versionId })
		}
	);
	if (!response.ok) throw await response.json();
	return response.json();
};
