import { WEBUI_API_BASE_URL } from '$lib/constants';
import { getTimeRange } from '$lib/utils';
import {
	normalizeNote,
	readNoteResponse,
	type NoteRecord,
	type NoteModelResponse,
	type NoteListItem,
	type NoteSearchResponse
} from '$lib/utils/airis/notes';
import type { SavedChat } from '$lib/utils/airis/frontend-contracts';

export type NoteForm = {
	title: string;
	data?: null | object;
	meta?: null | object;
	access_grants?: object[];
};

export const createNewNote = async (
	token: string,
	note: NoteForm
): Promise<NoteModelResponse | null> => {
	let error = null;

	const res: NoteModelResponse | null = await fetch(`${WEBUI_API_BASE_URL}/notes/create`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...note
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getNotes = async (
	token: string = '',
	raw: boolean = false
): Promise<NoteListItem[] | Record<string, (NoteListItem & { timeRange: string })[]> | null> => {
	let error = null;

	const res: NoteListItem[] | null = await fetch(`${WEBUI_API_BASE_URL}/notes/`, {
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
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	if (raw) {
		return res; // Return raw response if requested
	}

	if (!Array.isArray(res)) {
		return {}; // or throw new Error("Notes response is not an array")
	}

	// Build the grouped object
	const grouped: Record<string, (NoteListItem & { timeRange: string })[]> = {};
	for (const note of res) {
		const timeRange = getTimeRange(note.updated_at / 1000000000);
		if (!grouped[timeRange]) {
			grouped[timeRange] = [];
		}
		grouped[timeRange].push({
			...note,
			timeRange
		});
	}

	return grouped;
};

export const searchNotes = async (
	token: string = '',
	query: string | null = null,
	viewOption: string | null = null,
	permission: string | null = null,
	sortKey: string | null = null,
	page: number | null = null,
	direction: string | null = null
): Promise<NoteSearchResponse | null> => {
	let error = null;
	const searchParams = new URLSearchParams();

	if (query !== null) {
		searchParams.append('query', query);
	}

	if (viewOption !== null) {
		searchParams.append('view_option', viewOption);
	}

	if (permission !== null) {
		searchParams.append('permission', permission);
	}

	if (sortKey !== null) {
		searchParams.append('order_by', sortKey);
	}

	if (direction !== null) {
		searchParams.append('direction', direction);
	}

	if (page !== null) {
		searchParams.append('page', `${page}`);
	}

	const res: NoteSearchResponse | null = await fetch(
		`${WEBUI_API_BASE_URL}/notes/search?${searchParams.toString()}`,
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
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getNoteList = async (
	token: string = '',
	page: number | null = null
): Promise<NoteListItem[] | null> => {
	let error = null;
	const searchParams = new URLSearchParams();

	if (page !== null) {
		searchParams.append('page', `${page}`);
	}

	const res: NoteListItem[] | null = await fetch(
		`${WEBUI_API_BASE_URL}/notes/?${searchParams.toString()}`,
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
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getNoteById = async (token: string, id: string): Promise<NoteRecord> => {
	const response = await fetch(`${WEBUI_API_BASE_URL}/notes/${id}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	});
	return normalizeNote(await readNoteResponse(response));
};

export const getNoteChatById = async (token: string, id: string): Promise<SavedChat | null> => {
	let error = null;
	const url = `${WEBUI_API_BASE_URL}/notes/${id}/chat`;

	console.info('[note-chat] fetching linked chat', { noteId: id, url });

	const res: SavedChat | null = await fetch(url, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			console.info('[note-chat] linked chat response', {
				noteId: id,
				status: res.status,
				ok: res.ok
			});
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error('[note-chat] linked chat request failed', { noteId: id, error: err });
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getNoteChatsById = async (token: string, id: string): Promise<SavedChat[] | null> => {
	let error = null;
	const url = `${WEBUI_API_BASE_URL}/notes/${id}/chats`;

	const res: SavedChat[] | null = await fetch(url, {
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
		.catch((err) => {
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const createNoteChatById = async (
	token: string,
	id: string,
	operationId?: string
): Promise<SavedChat | null> => {
	let error = null;
	const url = `${WEBUI_API_BASE_URL}/notes/${id}/chat${operationId ? `?operation_id=${encodeURIComponent(operationId)}` : ''}`;

	const res: SavedChat | null = await fetch(url, {
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
		.catch((err) => {
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

// Keep writes ordered even when the editor is unmounted and opened again.
const noteUpdates = new Map<string, Promise<NoteRecord>>();

export const updateNoteById = async (
	token: string,
	id: string,
	note: NoteForm
): Promise<NoteRecord> => {
	const body = JSON.stringify(note);
	const pending = (noteUpdates.get(id) ?? Promise.resolve())
		.catch(() => undefined)
		.then(async (): Promise<NoteRecord> => {
			const response = await fetch(`${WEBUI_API_BASE_URL}/notes/${id}/update`, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					authorization: `Bearer ${token}`
				},
				body
			});
			return normalizeNote(await readNoteResponse(response));
		});
	noteUpdates.set(id, pending);
	try {
		return await pending;
	} finally {
		if (noteUpdates.get(id) === pending) noteUpdates.delete(id);
	}
};

export const updateNoteAccessGrants = async (
	token: string,
	id: string,
	accessGrants: object[]
): Promise<NoteModelResponse | null> => {
	let error = null;

	const res: NoteModelResponse | null = await fetch(
		`${WEBUI_API_BASE_URL}/notes/${id}/access/update`,
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ access_grants: accessGrants })
		}
	)
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const deleteNoteById = async (token: string, id: string): Promise<boolean | null> => {
	let error = null;

	const res: boolean | null = await fetch(`${WEBUI_API_BASE_URL}/notes/${id}/delete`, {
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
		.catch((err) => {
			error = err.detail;

			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getPinnedNoteList = async (token: string = ''): Promise<NoteListItem[]> => {
	let error = null;

	const res: NoteListItem[] | null = await fetch(`${WEBUI_API_BASE_URL}/notes/pinned`, {
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
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res ?? [];
};

export const toggleNotePinnedStatusById = async (
	token: string,
	id: string
): Promise<NoteModelResponse | null> => {
	let error = null;

	const res: NoteModelResponse | null = await fetch(`${WEBUI_API_BASE_URL}/notes/${id}/pin`, {
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
		.then((json) => {
			return json;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};
