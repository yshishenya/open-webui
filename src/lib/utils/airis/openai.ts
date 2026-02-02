import { v4 as uuidv4 } from 'uuid';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const enhanceOpenAIChatCompletionBody = (value: unknown): unknown => {
	if (!isRecord(value)) return value;

	const chatId = typeof value.chat_id === 'string' ? value.chat_id : null;
	const messageId = typeof value.id === 'string' ? value.id : null;

	const rawMetadata = value.metadata;
	const metadata: Record<string, unknown> = isRecord(rawMetadata) ? { ...rawMetadata } : {};

	if (typeof metadata.request_id !== 'string' || metadata.request_id.length === 0) {
		metadata.request_id = uuidv4();
	}

	if (chatId && (typeof metadata.chat_id !== 'string' || metadata.chat_id.length === 0)) {
		metadata.chat_id = chatId;
	}

	if (messageId && (typeof metadata.message_id !== 'string' || metadata.message_id.length === 0)) {
		metadata.message_id = messageId;
	}

	return {
		...value,
		metadata
	};
};

