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
export type FunctionRecord = FunctionListItem & {
	content: string;
	valves?: Record<string, unknown> | null;
};
export type FunctionForm = {
	id: string;
	name: string;
	content: string;
	meta: Partial<FunctionListItem['meta']>;
};

export const createNewFunction = async (
	token: string,
	func: FunctionForm,
	signal?: AbortSignal
): Promise<FunctionListItem | null> =>
	requestJSON(`${WEBUI_API_BASE_URL}/functions/create`, token, func, signal, 'Function request');

export const getFunctions = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/functions/`, {
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
): Promise<FunctionListItem | null> =>
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

export const getFunctionValvesById = async (token: string, id: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/functions/id/${id}/valves`, {
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

export const getFunctionValvesSpecById = async (token: string, id: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/functions/id/${id}/valves/spec`, {
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

export const updateFunctionValvesById = async (token: string, id: string, valves: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/functions/id/${id}/valves/update`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...valves
		})
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

export const getUserValvesById = async (token: string, id: string): Promise<ValveValues | null> =>
	requestUserValves(`${WEBUI_API_BASE_URL}/functions/id/${id}/valves/user`, token);

export const getUserValvesSpecById = async (token: string, id: string): Promise<ValveSpec | null> =>
	readValveSpec(
		await requestUserValves(`${WEBUI_API_BASE_URL}/functions/id/${id}/valves/user/spec`, token)
	);

export const updateUserValvesById = async (
	token: string,
	id: string,
	valves: object
): Promise<ValveValues | null> =>
	requestUserValves(`${WEBUI_API_BASE_URL}/functions/id/${id}/valves/user/update`, token, valves);
