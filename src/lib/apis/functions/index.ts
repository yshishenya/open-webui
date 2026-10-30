import { WEBUI_API_BASE_URL } from '$lib/constants';
import {
	requestUserValves,
	readValveSpec,
	type ValveValues,
	type ValveSpec
} from '$lib/utils/airis/userValves';

import { requestJSON } from '$lib/utils/airis/request_json';
import type { FunctionListItem } from '$lib/utils/airis/frontend-contracts';

export type FunctionUserItem = FunctionListItem & {
	user?: { id: string; name: string; email: string; username?: string } | null;
};
export type FunctionMeta = FunctionListItem['meta'] & {
	i18n?: Record<string, Record<string, string>>;
};
export type FunctionRecord = Omit<FunctionListItem, 'meta'> & {
	meta: FunctionMeta;
	content: string;
	valves?: Record<string, unknown> | null;
};
export type FunctionForm = {
	commit_message?: string | null;
	id: string;
	name: string;
	content: string;
	meta: Partial<FunctionMeta>;
};

export const createNewFunction = async (
	token: string,
	func: FunctionForm,
	signal?: AbortSignal
): Promise<FunctionRecord | null> =>
	requestJSON(`${WEBUI_API_BASE_URL}/functions/create`, token, func, signal, 'Function request');

export const getFunctions = async (
	token = '',
	signal?: AbortSignal
): Promise<FunctionListItem[]> => {
	const result = await requestJSON<FunctionListItem[]>(
		`${WEBUI_API_BASE_URL}/functions/`,
		token,
		undefined,
		signal,
		'Function request'
	);
	if (!Array.isArray(result)) throw new Error('Invalid function catalog response');
	return result;
};

export const getFunctionList = async (
	token = '',
	signal?: AbortSignal
): Promise<FunctionUserItem[]> =>
	requestJSON(`${WEBUI_API_BASE_URL}/functions/list`, token, undefined, signal, 'Function request');

export const loadFunctionByUrl = async (
	token: string,
	url: string,
	signal?: AbortSignal
): Promise<{ name: string; content: string } | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/functions/load/url`,
		token,
		{ url },
		signal,
		'Function request'
	);

export const exportFunctions = async (
	token = '',
	signal?: AbortSignal
): Promise<FunctionRecord[]> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/functions/export`,
		token,
		undefined,
		signal,
		'Function request'
	);

export const getFunctionById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<FunctionRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}`,
		token,
		undefined,
		signal,
		'Function request'
	);

export const updateFunctionById = async (
	token: string,
	id: string,
	func: FunctionForm,
	signal?: AbortSignal
): Promise<FunctionRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/update`,
		token,
		func,
		signal,
		'Function request'
	);

export const deleteFunctionById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<boolean> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/delete`,
		token,
		undefined,
		signal,
		'Function request',
		'DELETE'
	);

export const toggleFunctionById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<FunctionRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/toggle`,
		token,
		undefined,
		signal,
		'Function request',
		'POST'
	);

export const toggleGlobalById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<FunctionRecord | null> =>
	requestJSON(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/toggle/global`,
		token,
		undefined,
		signal,
		'Function request',
		'POST'
	);

export const getFunctionValvesById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<ValveValues | null> =>
	requestUserValves(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/valves`,
		token,
		undefined,
		signal
	);

export const getFunctionValvesSpecById = async (
	token: string,
	id: string,
	signal?: AbortSignal
): Promise<ValveSpec | null> =>
	readValveSpec(
		await requestUserValves(
			`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/valves/spec`,
			token,
			undefined,
			signal
		)
	);

export const updateFunctionValvesById = async (
	token: string,
	id: string,
	valves: object,
	signal?: AbortSignal
): Promise<ValveValues | null> =>
	requestUserValves(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/valves/update`,
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
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/valves/user`,
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
			`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/valves/user/spec`,
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
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/valves/user/update`,
		token,
		valves,
		signal
	);

export type FunctionHistoryEntry = {
	id: string;
	function_id: string;
	parent_id: string | null;
	user_id: string;
	commit_message: string | null;
	created_at: number;
	user?: { name: string } | null;
};

export type FunctionSnapshot = {
	name: string;
	content: string;
	meta: FunctionMeta;
};

export const getFunctionHistory = async (
	token: string,
	id: string,
	page = 1
): Promise<FunctionHistoryEntry[]> => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/history?page=${page}`,
		{
			method: 'GET',
			headers: { authorization: `Bearer ${token}` }
		}
	);
	if (!response.ok) throw await response.json();
	return response.json();
};

export const getFunctionHistoryEntry = async (
	token: string,
	id: string,
	versionId: string
): Promise<FunctionHistoryEntry & { snapshot: FunctionSnapshot }> => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/history/${encodeURIComponent(versionId)}`,
		{
			method: 'GET',
			headers: { authorization: `Bearer ${token}` }
		}
	);
	if (!response.ok) throw await response.json();
	return response.json();
};

export type FunctionHistoryDiff = {
	from_id: string; to_id: string;
	metadata: Record<string, {before: unknown; after: unknown}>;
	content_diff: string; line_endings_only: boolean;
};

export const getFunctionHistoryDiff = async (
	token: string,
	id: string,
	fromId: string,
	toId: string
): Promise<FunctionHistoryDiff> => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/history/diff?${new URLSearchParams({ from_id: fromId, to_id: toId })}`,
		{
			method: 'GET',
			headers: { authorization: `Bearer ${token}` }
		}
	);
	if (!response.ok) throw await response.json();
	return response.json();
};

export const deleteFunctionHistoryVersion = async (
	token: string,
	id: string,
	versionId: string
): Promise<boolean> => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/history/${encodeURIComponent(versionId)}`,
		{
			method: 'DELETE',
			headers: { authorization: `Bearer ${token}` }
		}
	);
	if (!response.ok) throw await response.json();
	return response.json();
};

export const setProductionFunctionVersion = async (
	token: string,
	id: string,
	versionId: string
): Promise<FunctionRecord> => {
	const response = await fetch(
		`${WEBUI_API_BASE_URL}/functions/id/${encodeURIComponent(id)}/update/version`,
		{
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ version_id: versionId })
		}
	);
	if (!response.ok) throw await response.json();
	return response.json();
};
