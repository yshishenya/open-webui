import type { OutputItem } from '$lib/components/chat/Messages/structuredOutput';

export type ChatAttachment = Record<string, unknown> & {
	type?: string;
	content_type?: string;
	id?: string | null;
	url?: string | null;
	name?: string;
	size?: number;
	itemId?: string;
	status?: string;
	collection_name?: string | null;
	context?: string;
	content?: string;
	file?: string | (Record<string, unknown> & { data?: Record<string, unknown> | null });
};

export type ChatStatus = Record<string, unknown> & {
	action?: string;
	done?: boolean;
	hidden?: boolean;
	description?: string;
	urls?: string[];
	query?: string;
};

export type ChatCodeExecution = Record<string, unknown> & {
	id: string;
	name?: string;
	code?: string;
	language?: string;
	result?: {
		error?: string;
		output?: string;
		files?: { name: string; url: string }[];
	};
};

export type ChatAnnotation = Record<string, unknown> & {
	rating?: number;
	type?: string;
	reason?: string | null;
	comment?: string;
	tags?: string[];
	details?: { rating?: number | null };
};

/** Client history after the existing graph repair boundary. */
export type ChatHistoryMessage = {
	id: string;
	parentId: string | null;
	childrenIds: string[];
	role: string;
	content?: string;
	timestamp?: number;
	model?: string;
	modelName?: string;
	modelIdx?: number;
	models?: string[];
	selectedModelId?: string;
	operation_id?: string;
	arena?: boolean;
	done?: boolean;
	merged?: { status?: boolean; content?: string; timestamp?: number };
	files?: ChatAttachment[];
	contextSummary?: string;
	context_summary?: string;
	usage?: {
		input_tokens?: number;
		prompt_tokens?: number;
		output_tokens?: number;
		completion_tokens?: number;
		[key: string]: unknown;
	};
	info?: {
		usage?: ChatHistoryMessage['usage'];
		openai?: boolean;
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
		eval_count?: number;
		eval_duration?: number;
		prompt_eval_count?: number;
		prompt_eval_duration?: number;
		total_duration?: number;
		load_duration?: number;
		[key: string]: unknown;
	};
	tool_calls?: unknown[];
	sources?: unknown[];
	citations?: unknown[];
	error?: boolean | { content: unknown };
	output?: OutputItem[];
	originalContent?: string;
	status?: ChatStatus;
	statusHistory?: ChatStatus[];
	code_executions?: ChatCodeExecution[];
	embeds?: string[];
	followUps?: string[];
	favorite?: boolean;
	lastSentence?: string;
	annotation?: ChatAnnotation;
	feedbackId?: string;
};

export type ChatHistory = {
	messages: Record<string, ChatHistoryMessage>;
	currentId: string | null;
};

export type ChatMessageEdit = {
	content?: string;
	files?: ChatHistoryMessage['files'];
	output?: OutputItem[];
};

/** Finish a response and its actual assistant siblings without repairing the graph. */
export const finishResponseGroup = (history: ChatHistory, messageId: string | null): boolean => {
	const response = messageId ? history.messages[messageId] : undefined;
	if (!response || response.role !== 'assistant') return false;
	const parent = response.parentId ? history.messages[response.parentId] : undefined;
	let changed = false;
	for (const id of [response.id, ...(parent?.childrenIds ?? [])]) {
		const message = history.messages[id];
		if (message?.role === 'assistant' && message.parentId === response.parentId) {
			changed ||= message.done !== true;
			message.done = true;
		}
	}
	return changed;
};

/** Select the last reachable unique node without rewriting stored links. */
export const getLastMessageId = (
	history: Pick<ChatHistory, 'messages'>,
	messageId: string | null | undefined
): string | null => {
	let currentId =
		messageId === null
			? Object.keys(history.messages)
					.filter((id) => history.messages[id]?.parentId === null)
					.at(-1)
			: messageId;
	let lastId: string | null = null;
	const visited = new Set<string>();
	while (currentId != null && !visited.has(currentId)) {
		const message = history.messages[currentId];
		if (!message) break;
		visited.add(currentId);
		lastId = currentId;
		currentId = message.childrenIds?.at(-1);
	}
	return lastId;
};
