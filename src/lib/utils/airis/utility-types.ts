import type { ChatHistory, ChatHistoryMessage } from './chat_history';

/** Existing ChatGPT export fields consumed by the legacy import converter. */
export type OpenAIExportMessage = {
	author?: { role?: string };
	metadata?: { model_slug?: string };
	create_time?: number | null;
	content: { parts?: unknown[]; text?: string | null };
};

export type OpenAIExportEntry = Record<string, unknown> & {
	id?: string;
	title?: string;
	create_time?: number | null;
	update_time?: number | null;
	mapping?: Record<string, { children?: string[] | null; message?: OpenAIExportMessage | null }>;
};

export type ImportedOpenAIChat = {
	history: ChatHistory;
	models: string[];
	messages: (ChatHistoryMessage & { context: null })[];
	options: Record<string, never>;
	timestamp?: number | null;
	title: string;
};

export type ImportedOpenAIChatRow = {
	id?: string;
	user_id: string;
	title?: string;
	chat: ImportedOpenAIChat;
	created_at: number | null;
	updated_at: number | null;
};

/** Fields used by the existing OpenAPI-to-tool conversion, not a JSON validator. */
export type ToolSchema = Record<string, unknown> & {
	$ref?: string;
	type?: string | string[];
	description?: string;
	properties?: Record<string, ToolSchema>;
	required?: string[];
	items?: ToolSchema;
	enum?: unknown[];
	oneOf?: ToolSchema[];
	anyOf?: ToolSchema[];
	allOf?: ToolSchema[];
};

export type OpenAPIComponents = { schemas: Record<string, ToolSchema> };

export type OpenAPIParameter = {
	name?: string;
	in?: string;
	description?: string;
	required?: boolean;
	schema?: ToolSchema;
};

export type OpenAPIPathItem = { parameters?: OpenAPIParameter[] };

export type OpenAPIOperation = {
	operationId: string;
	description?: string;
	summary?: string;
	parameters?: OpenAPIParameter[];
	requestBody?: { content?: Record<string, { schema?: ToolSchema }> };
};

export type ToolPayload = {
	name: string;
	description: string;
	parameters: ToolSchema;
};
