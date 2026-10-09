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
