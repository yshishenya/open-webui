import type { SessionUser } from '$lib/stores';
import type { ChatAttachment } from './chat_history';
import type { OutputItem } from '$lib/components/chat/Messages/structuredOutput';
import type { ToolListItem } from './frontend-contracts';

// ChannelModel + ChannelListItemResponse (GET /channels/).
export type ChannelListItem = {
	id: string;
	user_id: string;
	type: string | null;
	name: string;
	description: string | null;
	is_private: boolean | null;
	data: Record<string, unknown> | null;
	meta: Record<string, unknown> | null;
	access_grants: ToolListItem['access_grants'];
	created_at: number;
	updated_at: number;
	updated_by: string | null;
	archived_at: number | null;
	archived_by: string | null;
	deleted_at: number | null;
	deleted_by: string | null;
	user_ids: string[] | null;
	users:
		| (Pick<SessionUser, 'id' | 'name'> &
				Required<Pick<SessionUser, 'status_emoji' | 'status_message' | 'status_expires_at'>> & {
					is_active: boolean | null;
				})[]
		| null;
	last_message_at: number | null;
	unread_count: number;
};

// GET /channels/{id}: ChannelFullResponse has no last_message_at field.
export type ChannelDetail = Omit<ChannelListItem, 'last_message_at'> & {
	is_manager: boolean;
	write_access: boolean;
	user_count: number | null;
	last_read_at: number | null;
};

export type ChannelMessageData = Record<string, unknown> & {
	files?: ChatAttachment[];
	output?: OutputItem[];
};
export type ChannelMessageMeta = Record<string, unknown> & {
	model_id?: string | null;
	model_name?: string | null;
	done?: boolean;
};
export type ChannelMessageUser = Pick<SessionUser, 'id' | 'name' | 'role'>;
export type ChannelReaction = {
	name: string;
	users: Pick<SessionUser, 'id' | 'name'>[];
	count: number;
};

// backend.models.messages.MessageModel + MessageUserResponse.
export type ChannelMessage = {
	id: string;
	user_id: string;
	channel_id: string | null;
	reply_to_id: string | null;
	parent_id: string | null;
	is_pinned: boolean;
	pinned_by: string | null;
	pinned_at: number | null;
	content: string;
	data: ChannelMessageData | null;
	meta: ChannelMessageMeta | null;
	created_at: number;
	updated_at: number;
	user: ChannelMessageUser | null;
};
export type ChannelReplyMessage = Omit<ChannelMessage, 'data'> & { data: boolean | null };
export type ChannelMessageResponse = ChannelMessage & {
	reply_to_message: ChannelReplyMessage | null;
	latest_reply_at: number | null;
	reply_count: number;
	reactions: ChannelReaction[];
};
// HTTP list/thread and pin responses serialize data as bool; sockets usually send full data.
export type ChannelListMessage = Omit<ChannelMessageResponse, 'data'> & { data: boolean | null };
export type ChannelPinnedMessage = ChannelReplyMessage & { reactions: ChannelReaction[] };

export type ChannelMessageForm = {
	temp_id?: string | null;
	reply_to_id?: string | null;
	parent_id?: string | null;
	content: string;
	data?: ChannelMessageData | null;
	meta?: ChannelMessageMeta | null;
};
export type ChannelMessageInput = { content: string; data: { files: ChatAttachment[] } };
export type ChannelPinHandler = (
	messageId: string,
	pinned: boolean,
	pinnedBy?: string | null,
	pinnedAt?: number | null
) => void | Promise<void>;

// Only the root composer creates this partial optimistic object before server acknowledgement.
export type ChannelPendingMessage = Pick<
	ChannelMessageResponse,
	'id' | 'content' | 'created_at' | 'updated_at' | 'reply_to_id'
> & {
	temp_id: string;
	data: ChannelMessageData;
	user_id: string | undefined;
	user: SessionUser | null | undefined;
	reply_to_message: ChannelDisplayMessage | null;
} & Partial<
		Omit<
			ChannelMessageResponse,
			| 'id'
			| 'content'
			| 'created_at'
			| 'updated_at'
			| 'reply_to_id'
			| 'data'
			| 'user_id'
			| 'user'
			| 'reply_to_message'
		>
	>;
// Pinned replies/counts are absent in the API; loaded data replaces its slim bool in the UI.
export type ChannelDisplayMessage =
	| (Omit<ChannelMessageResponse, 'data'> & {
			data: ChannelMessageData | boolean | null;
			temp_id?: string | null;
	  })
	| (Omit<ChannelPinnedMessage, 'data'> & {
			data: ChannelMessageData | boolean | null;
			temp_id?: string | null;
			reply_to_message?: ChannelReplyMessage | null;
			reply_count?: number;
			latest_reply_at?: number | null;
	  })
	| ChannelPendingMessage;

// Narrow consumed fields for delete events and deduplication.
export type ChannelEventMessage = Pick<ChannelMessage, 'id' | 'parent_id'> & {
	temp_id?: string | null;
};
export type ChannelMessageEvent = {
	channel_id: string;
	message_id: string | null;
	user: Pick<SessionUser, 'id' | 'name'>;
	data:
		| { type: 'message'; data: ChannelMessageResponse & { temp_id?: string | null } }
		| { type: 'message:update'; data: ChannelMessageResponse | ChannelListMessage }
		| {
				type: 'message:reply' | 'message:reaction:add' | 'message:reaction:remove';
				data: ChannelMessageResponse;
		  }
		| { type: 'message:delete'; data: ChannelEventMessage }
		| { type: 'typing'; data: { typing: boolean } };
};
