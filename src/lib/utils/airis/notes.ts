import type { Content, JSONContent } from '@tiptap/core';

export type NoteContent = Record<string, unknown> & {
	md: string;
	html: string;
	json: Content | null;
};
export type NoteVersion = Record<string, unknown> & {
	md?: string | null;
	html?: string | null;
	json?: Content | null;
};
export type NoteFile = Record<string, unknown> & {
	id?: string | null;
	type?: string;
	name?: string;
	url?: string;
	content_type?: string;
	status?: string;
	itemId?: string;
	size?: number;
};
type NoteAccessGrant = Record<string, unknown> & {
	id?: string;
	principal_type: 'user' | 'group' | 'anyone';
	principal_id: string;
	permission: 'read' | 'write';
};
export type NoteRecord = Record<string, unknown> & {
	id: string;
	user_id: string;
	title: string;
	created_at: number;
	updated_at: number;
	write_access?: boolean;
	data: Record<string, unknown> & {
		content: NoteContent;
		files: NoteFile[];
		versions?: NoteVersion[] | null;
	};
	access_grants: NoteAccessGrant[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isJsonContent = (value: unknown): value is JSONContent => {
	if (!isRecord(value)) return false;
	if (value.type !== undefined && typeof value.type !== 'string') return false;
	if (value.text !== undefined && typeof value.text !== 'string') return false;
	if (value.attrs !== undefined && !isRecord(value.attrs)) return false;
	if (
		value.content !== undefined &&
		(!Array.isArray(value.content) || !value.content.every(isJsonContent))
	)
		return false;
	if (
		value.marks !== undefined &&
		(!Array.isArray(value.marks) ||
			!value.marks.every(
				(mark: unknown) =>
					isRecord(mark) &&
					typeof mark.type === 'string' &&
					(mark.attrs === undefined || isRecord(mark.attrs))
			))
	)
		return false;
	return true;
};
const isContent = (value: unknown): value is NoteVersion => {
	if (!isRecord(value)) return false;
	for (const key of ['md', 'html']) {
		if (value[key] != null && typeof value[key] !== 'string') return false;
	}
	const json = value.json;
	return (
		json == null ||
		typeof json === 'string' ||
		isJsonContent(json) ||
		(Array.isArray(json) && json.every(isJsonContent))
	);
};
const isNoteFile = (value: unknown): value is NoteFile => {
	if (!isRecord(value)) return false;
	if (value.id != null && typeof value.id !== 'string') return false;
	for (const key of ['type', 'name', 'url', 'content_type', 'status', 'itemId']) {
		if (value[key] !== undefined && typeof value[key] !== 'string') return false;
	}
	return (
		value.size === undefined ||
		(typeof value.size === 'number' && Number.isFinite(value.size) && value.size >= 0)
	);
};

const isNoteAccessGrant = (value: unknown): value is NoteAccessGrant =>
	isRecord(value) &&
	(value.id === undefined || typeof value.id === 'string') &&
	(value.principal_type === 'user' ||
		value.principal_type === 'group' ||
		value.principal_type === 'anyone') &&
	typeof value.principal_id === 'string' &&
	(value.permission === 'read' || value.permission === 'write');

// Missing legacy fields are empty; malformed existing content must not be silently erased.
export const normalizeNote = (value: unknown): NoteRecord => {
	if (
		!isRecord(value) ||
		typeof value.id !== 'string' ||
		typeof value.user_id !== 'string' ||
		typeof value.title !== 'string' ||
		typeof value.created_at !== 'number' ||
		!Number.isInteger(value.created_at) ||
		typeof value.updated_at !== 'number' ||
		!Number.isInteger(value.updated_at) ||
		(value.write_access !== undefined && typeof value.write_access !== 'boolean')
	) {
		throw new Error('Invalid note response');
	}
	const data = value.data ?? {};
	if (!isRecord(data)) throw new Error('Invalid note data');
	const content = data.content ?? {};
	if (!isContent(content)) throw new Error('Invalid note content');
	const versions = data.versions;
	if (versions != null && (!Array.isArray(versions) || !versions.every(isContent)))
		throw new Error('Invalid note versions');
	const files = data.files ?? [];
	const grants = value.access_grants ?? [];
	if (
		!Array.isArray(files) ||
		!files.every(isNoteFile) ||
		!Array.isArray(grants) ||
		!grants.every(isNoteAccessGrant)
	) {
		throw new Error('Invalid note files or access grants');
	}
	return {
		...value,
		id: value.id,
		user_id: value.user_id,
		title: value.title,
		created_at: value.created_at,
		updated_at: value.updated_at,
		...(value.write_access === undefined ? {} : { write_access: value.write_access }),
		data: {
			...data,
			...(versions === undefined ? {} : { versions }),
			content: {
				...content,
				md: content.md ?? '',
				html: content.html ?? '',
				json: content.json ?? null
			},
			files
		},
		access_grants: grants
	};
};

export const readNoteResponse = async (response: Response): Promise<unknown> => {
	const value: unknown = await response.json();
	if (!response.ok) {
		throw isRecord(value) && typeof value.detail === 'string'
			? value.detail
			: new Error(`Note request failed (${response.status})`);
	}
	if (!isRecord(value)) throw new Error('Invalid note response');
	return value;
};
