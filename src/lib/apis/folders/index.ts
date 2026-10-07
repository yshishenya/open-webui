import { WEBUI_API_BASE_URL } from '$lib/constants';
import type {
	FolderListItem,
	SelectedFolder,
	ChatListItem
} from '$lib/utils/airis/frontend-contracts';

const rethrowFolderError = (error: unknown): never => {
	if (error !== null && typeof error === 'object' && 'detail' in error) {
		throw error.detail ?? error;
	}
	throw error;
};

export type FolderAccessGrant = {
	id?: string;
	principal_type: 'user' | 'group';
	principal_id: string;
	permission: 'read' | 'write';
};

type FolderResponse = SelectedFolder & {
	access_grants?: FolderAccessGrant[];
};

type FolderReadResponse = {
	folder_id: string;
	folder_ids: string[];
	updated_count: number;
	folder_unread_counts: Record<string, number>;
};

type SharedFolderChatsResponse = {
	chats: Array<ChatListItem & { user_id: string; owner_name: string; readonly: boolean }>;
	folder_permission: 'read' | 'write';
	total?: number;
	has_more?: boolean;
};

export type FolderForm = {
	name?: string;
	data?: Record<string, unknown>;
	meta?: Record<string, unknown>;
	parent_id?: string | null;
};

export const createNewFolder = async (
	token: string,
	folderForm: FolderForm
): Promise<FolderResponse> => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/folders/`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify(folderForm)
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch(rethrowFolderError);

	return res;
};

export const getFolders = async (token: string = ''): Promise<FolderListItem[]> => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/folders/`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch(rethrowFolderError);

	return res;
};

export const getFolderById = async (token: string, id: string): Promise<FolderResponse> => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/folders/${id}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch(rethrowFolderError);

	return res;
};

export const updateFolderById = async (
	token: string,
	id: string,
	folderForm: FolderForm
): Promise<FolderResponse> => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/folders/${id}/update`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify(folderForm)
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch(rethrowFolderError);

	return res;
};

export const updateFolderIsExpandedById = async (
	token: string,
	id: string,
	isExpanded: boolean
): Promise<FolderResponse> => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/folders/${id}/update/expanded`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			is_expanded: isExpanded
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch(rethrowFolderError);

	return res;
};

export const updateFolderParentIdById = async (
	token: string,
	id: string,
	parentId?: string | null
): Promise<FolderResponse> => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/folders/${id}/update/parent`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			parent_id: parentId
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch(rethrowFolderError);

	return res;
};

export const deleteFolderById = async (
	token: string,
	id: string,
	deleteContents: boolean
): Promise<boolean> => {
	const searchParams = new URLSearchParams();
	searchParams.append('delete_contents', deleteContents ? 'true' : 'false');

	const res = await fetch(`${WEBUI_API_BASE_URL}/folders/${id}?${searchParams.toString()}`, {
		method: 'DELETE',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.then((json) => {
			return json;
		})
		.catch(rethrowFolderError);

	return res;
};

export const markFolderChatsReadById = async (
	token: string,
	id: string
): Promise<FolderReadResponse> => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/folders/${id}/read`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch(rethrowFolderError);

	return res;
};

export const updateFolderAccessById = async (
	token: string,
	id: string,
	accessGrants: unknown[]
): Promise<FolderResponse> => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/folders/${id}/access/update`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ access_grants: accessGrants })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch(rethrowFolderError);

	return res;
};

export const getSharedFolders = async (token: string): Promise<SelectedFolder[]> => {
	const res = await fetch(`${WEBUI_API_BASE_URL}/folders/shared`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch(rethrowFolderError);

	return res;
};

export const getSharedFolderChats = async (
	token: string,
	folderId: string,
	params: {
		page?: number | null;
		sortBy?: 'title' | 'updated_at';
		sortDir?: 'asc' | 'desc';
	} = {}
): Promise<SharedFolderChatsResponse> => {
	const searchParams = new URLSearchParams();
	if (params.page !== undefined && params.page !== null) {
		searchParams.append('page', `${params.page}`);
	}
	if (params.sortBy) {
		searchParams.append('sort_by', params.sortBy);
	}
	if (params.sortDir) {
		searchParams.append('sort_dir', params.sortDir);
	}
	const query = searchParams.toString();

	const res = await fetch(
		`${WEBUI_API_BASE_URL}/folders/${folderId}/shared/chats${query ? `?${query}` : ''}`,
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			}
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch(rethrowFolderError);

	return res;
};
