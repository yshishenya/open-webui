import { requestJSON } from '$lib/utils/airis/request_json';
import type { SuggestionPrompt } from '$lib/utils/airis/model-types';
import { WEBUI_API_BASE_URL, WEBUI_BASE_URL } from '$lib/constants';
import type { Banner } from '$lib/types';
import type { ToolServerConnection } from '$lib/utils/airis/frontend-contracts';
import { requestModelConnection } from '$lib/utils/airis/model_connection_request';

export const importConfig = async (token: string, config: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/import`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			config: config
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const exportConfig = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/export`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getConnectionsConfig = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/connections`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const setConnectionsConfig = async (token: string, config: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/connections`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...config
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

type ToolServersConfig = { TOOL_SERVER_CONNECTIONS: ToolServerConnection[] };
const readToolServersConfig = async (response: Response): Promise<ToolServersConfig> => {
	const data: unknown = await response.json();
	if (
		!data ||
		typeof data !== 'object' ||
		!('TOOL_SERVER_CONNECTIONS' in data) ||
		!Array.isArray(data.TOOL_SERVER_CONNECTIONS)
	)
		throw new Error('Invalid tool server configuration');
	return data as ToolServersConfig;
};

export const getToolServerConnections = async (
	token: string,
	signal?: AbortSignal
): Promise<ToolServersConfig> =>
	requestModelConnection(
		`${WEBUI_API_BASE_URL}/configs/tool_servers`,
		{
			method: 'GET',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
		},
		signal,
		readToolServersConfig
	);

export const setToolServerConnections = async (
	token: string,
	connections: ToolServersConfig,
	signal?: AbortSignal
): Promise<ToolServersConfig> =>
	requestModelConnection(
		`${WEBUI_API_BASE_URL}/configs/tool_servers`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(connections)
		},
		signal,
		readToolServersConfig
	);

export {
	getTerminalServerConnections,
	setTerminalServerConnections,
	putOrchestratorPolicy,
	getOrchestratorPolicy,
	putOrchestratorLifecycle,
	getOrchestratorLifecycle,
	refreshOrchestratorTerminals,
	verifyTerminalServerConnection
} from '$lib/utils/airis/terminal_connection_request';

/**
 * Detect whether a terminal server URL points to an Orchestrator or a direct
 * Open Terminal instance.
 *
 * - GET {url}/api/v1/policies → 200 → "orchestrator"
 * - GET {url}/api/config      → 200 → "terminal"
 * - Neither                         → null
 */
export const detectTerminalServerType = async (
	url: string,
	key: string
): Promise<'orchestrator' | 'terminal' | null> => {
	const baseUrl = url.replace(/\/$/, '');
	const headers: Record<string, string> = {};
	if (key) {
		headers['Authorization'] = `Bearer ${key}`;
	}

	// Orchestrators expose a policies API; plain terminals don't.
	try {
		const res = await fetch(`${baseUrl}/api/v1/policies`, { headers });
		if (res.ok) return 'orchestrator';
	} catch {
		// ignore
	}

	// Fall back to open-terminal config endpoint.
	try {
		const res = await fetch(`${baseUrl}/api/config`, { headers });
		if (res.ok) return 'terminal';
	} catch {
		// ignore
	}

	return null;
};

export const verifyToolServerConnection = async (
	token: string,
	connection: ToolServerConnection,
	signal?: AbortSignal
): Promise<Record<string, unknown>> =>
	requestModelConnection(
		`${WEBUI_API_BASE_URL}/configs/tool_servers/verify`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(connection)
		},
		signal
	);

type RegisterOAuthClientForm = {
	url: string;
	client_id: string;
	client_name?: string;
	client_secret?: string;
	oauth_server_url?: string;
	oauth_scope?: string;
};

export const registerOAuthClient = async (
	token: string,
	formData: RegisterOAuthClientForm,
	type: null | string = null,
	signal?: AbortSignal
): Promise<{ status: boolean; oauth_client_info: string }> => {
	const searchParams = type ? `?type=${encodeURIComponent(type)}` : '';
	return requestModelConnection(
		`${WEBUI_API_BASE_URL}/configs/oauth/clients/register${searchParams}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(formData)
		},
		signal
	);
};

export const getOAuthClientAuthorizationUrl = (clientId: string, type: null | string = null) => {
	const oauthClientId = type ? `${type}:${clientId}` : clientId;
	return `${WEBUI_BASE_URL}/oauth/clients/${oauthClientId}/authorize`;
};

export const initiateOAuthRedirect = (tool: {
	id: string;
	serverId: string;
	authType?: string | null;
}) => {
	sessionStorage.setItem('pendingOAuthToolId', tool.id);
	sessionStorage.setItem('oauthRedirectInProgressToolId', tool.id);
	const authUrl = getOAuthClientAuthorizationUrl(tool.serverId, tool.authType ?? 'mcp');
	window.open(authUrl, '_self', 'noopener');
};

export const getCodeExecutionConfig = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/code_execution`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const setCodeExecutionConfig = async (token: string, config: object) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/code_execution`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...config
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getModelsDefaults = async (token: string) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/models/defaults`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export type ModelsConfig = {
	DEFAULT_MODELS: string | null;
	DEFAULT_PINNED_MODELS: string | null;
	MODEL_ORDER_LIST: (string | null)[];
	DEFAULT_MODEL_METADATA: Record<string, unknown> | null;
	DEFAULT_MODEL_PARAMS: Record<string, unknown> | null;
};

export const getModelsConfig = async (token: string): Promise<ModelsConfig | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/models`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const setModelsConfig = async (
	token: string,
	config: object
): Promise<ModelsConfig | null> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/models`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...config
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getSubagentsConfig = async (token: string) => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/subagents`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const setSubagentsConfig = async (token: string, config: object) => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/subagents`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(config)
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const setDefaultPromptSuggestions = async (
	token: string,
	promptSuggestions: SuggestionPrompt[]
): Promise<SuggestionPrompt[]> => {
	const rows = await requestJSON<SuggestionPrompt[]>(
		`${WEBUI_API_BASE_URL}/configs/suggestions`,
		token,
		{ suggestions: promptSuggestions },
		undefined,
		'Prompt suggestions'
	);
	if (
		!Array.isArray(rows) ||
		!rows.every(
			(row) =>
				row &&
				typeof row === 'object' &&
				typeof row.content === 'string' &&
				Array.isArray(row.title) &&
				row.title.every((part: unknown) => typeof part === 'string')
		)
	)
		throw new Error('Invalid prompt suggestions response');
	return rows;
};

export const getBanners = async (token: string): Promise<Banner[]> => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/banners`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const setBanners = async (token: string, banners: Banner[]) => {
	let error = null;

	const res = await fetch(`${WEBUI_API_BASE_URL}/configs/banners`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			banners: banners
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};
