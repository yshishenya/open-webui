import { convertMessagesToHistory, createMessagesList } from '$lib/utils';
import { getOutputText } from '$lib/components/chat/Messages/structuredOutput';
import type { ChatHistory } from './chat_history';
import type { SavedChat } from './frontend-contracts';

export function getChatExportHistory(chat: SavedChat): ChatHistory {
	const history = chat.chat.history ?? convertMessagesToHistory(chat.chat.messages);
	const currentId = chat.current_message_id;
	return currentId && history.messages[currentId] ? { ...history, currentId } : history;
}

export function getChatExportText(chat: SavedChat): string {
	const history = getChatExportHistory(chat);
	return createMessagesList(history, history.currentId)
		.reduce((text, message) => {
			const content = getOutputText(message.output) || message.content || '';
			return `${text}### ${message.role.toUpperCase()}\n${content}\n\n`;
		}, '')
		.trim();
}
