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

export const getTools = async (token = '', signal?: AbortSignal): Promise<ToolListItem[]> => {
	const result = await requestJSON<ToolListItem[]>(
		`${WEBUI_API_BASE_URL}/tools/`,
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
	tool: ToolForm,
	signal?: AbortSignal
): Promise<ToolRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/tools/id/${encodeURIComponent(id)}/update`,
		token,
		tool,
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
