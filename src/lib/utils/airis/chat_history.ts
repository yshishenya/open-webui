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
	models?: string[];
	done?: boolean;
	files?: Record<string, unknown>[];
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
