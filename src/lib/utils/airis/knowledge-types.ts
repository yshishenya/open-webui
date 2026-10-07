import type { FolderAccessGrant } from '$lib/apis/folders';
import type { ToolListItem } from './frontend-contracts';
import type { ChatAttachment } from './chat_history';

export type KnowledgeAccessGrant = Omit<FolderAccessGrant, 'principal_type'> & {
	principal_type: 'user' | 'group' | 'anyone';
};

// GET /knowledge/search and /knowledge/. Grants are normalized by the server.
export type KnowledgeRecord = {
	id: string;
	user_id: string;
	name: string;
	description: string;
	meta: {
		source?: string;
		document?: boolean;
		external?: {
			connection_id?: string;
			provider?: string;
			source?: {
				id?: string;
				name?: string;
				config?: {
					content_field?: string;
					vector_field?: string;
					metadata_field?: string;
					document_id_field?: string;
					table_name?: string;
					collection_field?: string;
					[key: string]: unknown;
				};
			};
			[key: string]: unknown;
		};
		[key: string]: unknown;
	} | null;
	access_grants: (ToolListItem['access_grants'][number] & KnowledgeAccessGrant)[];
	created_at: number;
	updated_at: number;
};

export type KnowledgeListItem = KnowledgeRecord & {
	user: { id: string; name: string; role: string; email: string } | null;
	// Both list producers fill missing counts with 0.
	file_count: number;
	write_access: boolean | null;
};
export type KnowledgeListResponse = { items: KnowledgeListItem[]; total: number };

// Metadata-only records have no filename, owner or extracted content.
export type KnowledgeFileMetadata = {
	id: string;
	hash: string | null;
	meta: Record<string, unknown> | null;
	created_at: number;
	updated_at: number;
};
export type KnowledgeDetails = KnowledgeRecord & {
	files: (KnowledgeFileMetadata | null)[] | null;
	write_access?: boolean | null;
};
export type KnowledgeEditable = Omit<KnowledgeDetails, 'access_grants'> & {
	access_grants: KnowledgeAccessGrant[];
};

// FileModelResponse/FileUserResponse, including legacy null metadata/timestamps.
export type KnowledgeFile = {
	id: string;
	user_id: string;
	filename: string;
	hash: string | null;
	data: { content?: string | null; status?: string; [key: string]: unknown } | null;
	meta: {
		name?: string | null;
		content_type?: string | null;
		size?: number | null;
		[key: string]: unknown;
	} | null;
	created_at: number;
	updated_at: number | null;
	user?: KnowledgeListItem['user'];
	collection?: KnowledgeRecord | null;
	description?: string | null;
	error?: string;
};

export type KnowledgeDirectory = {
	id: string;
	knowledge_id: string;
	parent_id: string | null;
	name: string;
	user_id: string;
	created_at: number;
	updated_at: number;
};
export type KnowledgeFileListResponse = {
	items: KnowledgeFile[];
	directories: KnowledgeDirectory[];
	breadcrumbs: KnowledgeDirectory[];
	total: number;
};

// Rows also show uploads before the server has assigned an id.
export type KnowledgeFileDisplay = Partial<Omit<KnowledgeFile, 'id'>> &
	Pick<ChatAttachment, 'id' | 'type' | 'url' | 'itemId' | 'status'> & {
		name?: string | null;
		size?: number | null;
		tempId?: string;
		file?: string;
	};

export type KnowledgeSyncDiff = {
	added: { filename: string; path: string }[];
	modified: { filename: string; path: string; stale_file_id: string }[];
	deleted: { file_id: string; filename: string }[];
	mkdir: string[];
	rmdir: string[];
	unmodified_count: number;
	directory_map: Record<string, string>;
};
