import type { OutputItem } from '$lib/components/chat/Messages/structuredOutput';

/** Client history after the existing graph repair boundary. */
export type ChatHistoryMessage = {
	id: string;
	parentId: string | null;
	childrenIds: string[];
	role: string;
	content?: string;
	timestamp?: number;
	model?: string;
	modelIdx?: number;
	models?: string[];
	done?: boolean;
	merged?: { status?: boolean; content?: string; timestamp?: number };
	files?: (Record<string, unknown> & { type?: string; content_type?: string })[];
	contextSummary?: string;
	context_summary?: string;
	usage?: { input_tokens?: number; prompt_tokens?: number; [key: string]: unknown };
	info?: { usage?: ChatHistoryMessage['usage']; [key: string]: unknown };
	sources?: unknown[];
	error?: { content: unknown };
	output?: OutputItem[];
	originalContent?: string;
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
