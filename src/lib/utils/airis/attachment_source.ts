import { WEBUI_API_BASE_URL } from '$lib/constants';
import type { ChatAttachment } from './chat_history';

/** Preserve explicit sources; ID-only uploads use the authorized content endpoint. */
export const getAttachmentSource = (
	file: Pick<ChatAttachment, 'url' | 'id' | 'content_type'>
): string => {
	const url = typeof file.url === 'string' ? file.url : '';
	if (url.startsWith('data') || url.startsWith('http')) return url;
	if (url) return `${WEBUI_API_BASE_URL}/files/${url}${file.content_type ? '/content' : ''}`;
	return typeof file.id === 'string' && file.id
		? `${WEBUI_API_BASE_URL}/files/${file.id}/content`
		: '';
};
