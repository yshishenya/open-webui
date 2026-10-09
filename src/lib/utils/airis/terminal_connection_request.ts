import { WEBUI_API_BASE_URL } from '$lib/constants';
import type { TerminalServerConnection } from './frontend-contracts';
import { requestModelConnection } from './model_connection_request';

type TerminalServersConfig = { TERMINAL_SERVER_CONNECTIONS: TerminalServerConnection[] };
const readConfig = async (response: Response): Promise<TerminalServersConfig> => {
	const result: unknown = await response.json();
	if (
		!result ||
		typeof result !== 'object' ||
		!('TERMINAL_SERVER_CONNECTIONS' in result) ||
		!Array.isArray(result.TERMINAL_SERVER_CONNECTIONS) ||
		!result.TERMINAL_SERVER_CONNECTIONS.every(
			(s: unknown) => s && typeof s === 'object' && 'url' in s && typeof s.url === 'string'
		)
	)
		throw new Error('Invalid terminal connections response');
	return result as TerminalServersConfig;
};
export const getTerminalServerConnections = (
	token: string,
	signal?: AbortSignal
): Promise<TerminalServersConfig> =>
	requestModelConnection(
		`${WEBUI_API_BASE_URL}/configs/terminal_servers`,
		{
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` }
		},
		signal,
		readConfig
	);
export const setTerminalServerConnections = (
	token: string,
	connections: TerminalServersConfig,
	signal?: AbortSignal
): Promise<TerminalServersConfig> =>
	requestModelConnection(
		`${WEBUI_API_BASE_URL}/configs/terminal_servers`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(connections)
		},
		signal,
		readConfig
	);

const proxy = (
	token: string,
	endpoint: string,
	body: object,
	signal?: AbortSignal
): Promise<Record<string, unknown>> =>
	requestModelConnection(
		`${WEBUI_API_BASE_URL}/configs/terminal_servers/${endpoint}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(body)
		},
		signal
	);
const policyBody = (url: string, key: string, policyId: string, authType: string): object => ({
	url: url.replace(/\/$/, ''),
	key,
	policy_id: policyId,
	auth_type: authType
});
export const putOrchestratorPolicy = (
	token: string,
	url: string,
	key: string,
	policyId: string,
	policyData: object,
	authType = 'bearer',
	signal?: AbortSignal
): Promise<Record<string, unknown>> =>
	proxy(
		token,
		'policy',
		{ ...policyBody(url, key, policyId, authType), policy_data: policyData },
		signal
	);
export const getOrchestratorPolicy = (
	token: string,
	url: string,
	key: string,
	policyId: string,
	authType = 'bearer',
	signal?: AbortSignal
): Promise<Record<string, unknown>> =>
	proxy(token, 'policy', policyBody(url, key, policyId, authType), signal);
export const putOrchestratorLifecycle = (
	token: string,
	url: string,
	key: string,
	policyId: string,
	lifecycleData: object,
	authType = 'bearer',
	signal?: AbortSignal
): Promise<Record<string, unknown>> =>
	proxy(
		token,
		'lifecycle',
		{ ...policyBody(url, key, policyId, authType), lifecycle_data: lifecycleData },
		signal
	);
export const getOrchestratorLifecycle = (
	token: string,
	url: string,
	key: string,
	policyId: string,
	authType = 'bearer',
	signal?: AbortSignal
): Promise<Record<string, unknown>> =>
	proxy(token, 'lifecycle', policyBody(url, key, policyId, authType), signal);
export const refreshOrchestratorTerminals = (
	token: string,
	url: string,
	key: string,
	body: { user_id?: string; policy_id?: string; only_idle?: boolean; reset?: boolean },
	authType = 'bearer',
	signal?: AbortSignal
): Promise<Record<string, unknown>> =>
	proxy(
		token,
		'refresh',
		{ ...body, url: url.replace(/\/$/, ''), key, auth_type: authType },
		signal
	);
export const verifyTerminalServerConnection = (
	token: string,
	connection: Partial<TerminalServerConnection>,
	signal?: AbortSignal
): Promise<{ status: boolean; type?: 'orchestrator' | 'terminal' }> =>
	requestModelConnection(
		`${WEBUI_API_BASE_URL}/configs/terminal_servers/verify`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(connection)
		},
		signal
	);
