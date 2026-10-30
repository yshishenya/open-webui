import type { KnowledgeFileDisplay } from '$lib/utils/airis/knowledge-types';
export type KnowledgeFile = KnowledgeFileDisplay & {
	directory_id?: string | null;
	directory_path?: string;
	has_original?: boolean;
};
export type KnowledgeDirectory = {
	id: string;
	name: string;
	parent_id: string | null;
	updated_at?: number;
};
export type ViewerState = {
	mode: 'preview' | 'indexed';
	indexed: string | null;
	draft: string;
	editing: boolean;
	originalUnavailable?: boolean;
};
export const fileName = (file: KnowledgeFile) =>
	file.meta?.name || file.name || file.filename || 'Untitled';
export const newViewerState = (): ViewerState => ({
	mode: 'preview',
	indexed: null,
	draft: '',
	editing: false
});
