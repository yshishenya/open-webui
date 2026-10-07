import type { ChatAttachment } from '$lib/utils/airis/chat_history';
import '@tiptap/core';

declare module '@tiptap/core' {
	interface Storage {
		files?: ChatAttachment[];
	}
}
