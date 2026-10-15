import type { ToolServerConnection } from './frontend-contracts';
import { parseConnectionHeaders } from './model_connection_request';

const record = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);

export type ToolServerSpec = {
	paths: Record<string, unknown>;
	info?: { title?: string; version?: string; description?: string };
	[key: string]: unknown;
};

export const parseToolSpec = (text: string): ToolServerSpec => {
	const data: unknown = JSON.parse(text);
	if (!record(data) || !record(data.paths)) throw new Error('Please enter a valid JSON spec');
	const info = data.info;
	if (info !== undefined) {
		if (
			!record(info) ||
			['title', 'version', 'description'].some(
				(k) => info[k] !== undefined && typeof info[k] !== 'string'
			)
		)
			throw new Error('Please enter a valid JSON spec');
	}
	return data as ToolServerSpec;
};

// Validate the whole import before assigning even the first form field.
export const parseToolConnectionImport = (text: string): ToolServerConnection => {
	const parsed: unknown = JSON.parse(text);
	const data: unknown = Array.isArray(parsed) ? parsed[0] : parsed;
	if (!record(data) || typeof data.url !== 'string' || !data.url.trim())
		throw new Error('Please select a valid JSON file');
	for (const field of ['path', 'type', 'spec_type', 'spec', 'auth_type', 'key']) {
		if (
			data[field] !== undefined &&
			typeof data[field] !== 'string' &&
			!(data[field] === null && ['type', 'auth_type', 'key'].includes(field))
		)
			throw new Error('Please select a valid JSON file');
	}
	if (data.type && !['openapi', 'mcp'].includes(String(data.type)))
		throw new Error('Please select a valid JSON file');
	if (data.spec_type && !['url', 'json'].includes(String(data.spec_type)))
		throw new Error('Please select a valid JSON file');
	if (
		data.auth_type &&
		!['none', 'bearer', 'session', 'system_oauth', 'oauth_2.1', 'oauth_2.1_static'].includes(
			String(data.auth_type)
		)
	)
		throw new Error('Please select a valid JSON file');
	if (data.headers !== undefined) parseConnectionHeaders(JSON.stringify(data.headers));
	if (data.spec_type === 'json') parseToolSpec(String(data.spec ?? ''));
	if (data.info != null) {
		if (
			!record(data.info) ||
			Object.entries(data.info).some(
				([k, v]) =>
					v !== undefined && typeof v !== 'string' && !(k === 'oauth_client_info' && v === null)
			)
		)
			throw new Error('Please select a valid JSON file');
	}
	if (data.config != null) {
		const config = data.config;
		if (
			!record(config) ||
			(config.enable != null && typeof config.enable !== 'boolean') ||
			(config.function_name_filter_list != null &&
				typeof config.function_name_filter_list !== 'string')
		)
			throw new Error('Please select a valid JSON file');
		if (
			config.access_grants !== undefined &&
			(!Array.isArray(config.access_grants) ||
				!config.access_grants.every(
					(g: unknown) =>
						record(g) &&
						['user', 'group', 'anyone'].includes(String(g.principal_type)) &&
						typeof g.principal_id === 'string' &&
						['read', 'write'].includes(String(g.permission)) &&
						(g.id === undefined || typeof g.id === 'string')
				))
		)
			throw new Error('Please select a valid JSON file');
	}
	return structuredClone(data) as ToolServerConnection;
};
