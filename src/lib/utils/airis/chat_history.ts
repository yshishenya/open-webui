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
	usage?: { input_tokens?: number; prompt_tokens?: number; [key: string]: unknown };
	info?: { usage?: ChatHistoryMessage['usage']; [key: string]: unknown };
	sources?: unknown[];
	error?: { content: unknown };
	output?: OutputItem[];
	originalContent?: string;
	statusHistory?: (Record<string, unknown> & { action?: string })[];
	code_executions?: (Record<string, unknown> & { id: string })[];
	embeds?: string[];
	followUps?: string[];
	favorite?: boolean;
	lastSentence?: string;
	annotation?: { rating: number; [key: string]: unknown };
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
