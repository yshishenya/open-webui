import type { SessionUser } from '$lib/stores';
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

// MessageResponse fields consumed by channel socket listeners.
export type ChannelEventMessage = {
	id: string;
	parent_id: string | null;
	temp_id?: string | null;
};

// Emitted by channels.py and socket/main.py; unrelated channel events are ignored.
export type ChannelMessageEvent = {
	channel_id: string;
	message_id: string | null;
	user: Pick<SessionUser, 'id' | 'name'>;
	data:
		| {
				type:
					| 'message'
					| 'message:update'
					| 'message:delete'
					| 'message:reply'
					| 'message:reaction:add'
					| 'message:reaction:remove';
				data: ChannelEventMessage;
		  }
		| { type: 'typing'; data: { typing: boolean } };
};
