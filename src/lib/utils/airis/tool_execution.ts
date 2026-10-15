import { requestModelConnection } from './model_connection_request';

export type ToolExecutionResult = [unknown, Record<string, string> | null];
const record = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);
const methods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

const findOperation = (
	server: unknown,
	name: string
): [string, string, Record<string, unknown>, Record<string, unknown>] => {
	if (!record(server) || !record(server.openapi) || !record(server.openapi.paths))
		throw new Error('Invalid OpenAPI spec');
	for (const [path, item] of Object.entries(server.openapi.paths)) {
		if (!record(item)) continue;
		for (const [method, operation] of Object.entries(item)) {
			if (methods.has(method) && record(operation) && operation.operationId === name)
				return [path, method, item, operation];
		}
	}
	throw new Error('Tool operation not found.');
};

const toolRequest = (
	token: string | null | undefined,
	url: string,
	name: string,
	params: Record<string, unknown>,
	server: unknown,
	sessionId?: string,
	customHeaders?: Record<string, string> | null
): [string, RequestInit] => {
	const [path, method, item, operation] = findOperation(server, name);
	const parameters = new Map<string, Record<string, unknown>>();
	for (const list of [item.parameters, operation.parameters]) {
		if (!Array.isArray(list)) continue;
		for (const p of list) {
			if (record(p) && typeof p.name === 'string') parameters.set(`${p.name}:${p.in ?? ''}`, p);
		}
	}
	let target = `${url}${path}`;
	const query = new URLSearchParams();
	for (const p of parameters.values()) {
		const key = String(p.name);
		if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
		if (p.in === 'path')
			target = target.split(`{${key}}`).join(encodeURIComponent(String(params[key])));
		else if (p.in === 'query') query.append(key, String(params[key]));
	}
	if (query.size) target += `?${query}`;
	const headers = new Headers({ 'Content-Type': 'application/json', ...customHeaders });
	if (token) headers.set('Authorization', `Bearer ${token}`);
	if (sessionId) headers.set('X-Session-Id', sessionId);
	return [
		target,
		{
			method: method.toUpperCase(),
			headers,
			...(['post', 'put', 'patch', 'delete'].includes(method) && operation.requestBody
				? { body: JSON.stringify(params) }
				: {})
		}
	];
};

const readToolResponse = async (response: Response): Promise<ToolExecutionResult> => {
	const headers: Record<string, string> = {};
	response.headers.forEach((value, key) => {
		headers[key] = value;
	});
	const type = response.headers.get('Content-Type')?.split(';')[0]?.trim() ?? '';
	let data: unknown;
	try {
		data = await response.clone().json();
	} catch {
		if (type.startsWith('text/') || !type) data = await response.text();
		else {
			const bytes = new Uint8Array(await response.arrayBuffer());
			let binary = '';
			for (const byte of bytes) binary += String.fromCharCode(byte);
			data = `data:${type};base64,${btoa(binary)}`;
		}
	}
	return [data, headers];
};

// A tool may already have changed external data: never retry execution automatically.
export const executeToolServer = async (
	token: string | null | undefined,
	url: string,
	name: string,
	params: Record<string, unknown>,
	serverData: unknown,
	sessionId?: string,
	headers?: Record<string, string> | null,
	signal?: AbortSignal
): Promise<ToolExecutionResult> => {
	try {
		const [target, options] = toolRequest(token, url, name, params, serverData, sessionId, headers);
		return await requestModelConnection(target, options, signal, readToolResponse);
	} catch (error) {
		let message = 'Tool execution failed.';
		if (record(error) && typeof error.status === 'number')
			message = `Tool request failed (${error.status}).`;
		else if (error instanceof Error && error.name === 'TimeoutError')
			message = 'Tool request timed out.';
		else if (signal?.aborted) message = 'Tool request cancelled.';
		return [{ error: message }, null];
	}
};
