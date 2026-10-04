export type NoteRecord = Record<string, unknown> & {
	id: string;
	user_id: string;
	title: string;
	data: Record<string, unknown> & {
		content: Record<string, unknown> & { md: string; html: string; json: unknown };
		files: Record<string, unknown>[];
	};
	access_grants: Record<string, unknown>[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

// Missing legacy fields are empty; malformed existing content must not be silently erased.
export const normalizeNote = (value: unknown): NoteRecord => {
	if (
		!isRecord(value) ||
		typeof value.id !== 'string' ||
		typeof value.user_id !== 'string' ||
		typeof value.title !== 'string'
	) {
		throw new Error('Invalid note response');
	}
	const data = value.data ?? {};
	if (!isRecord(data)) throw new Error('Invalid note data');
	const content = data.content ?? {};
	if (!isRecord(content)) throw new Error('Invalid note content');
	for (const key of ['md', 'html']) {
		if (content[key] != null && typeof content[key] !== 'string')
			throw new Error('Invalid note content');
	}
	const files = data.files ?? [];
	const grants = value.access_grants ?? [];
	if (
		!Array.isArray(files) ||
		!files.every(isRecord) ||
		!Array.isArray(grants) ||
		!grants.every(isRecord)
	) {
		throw new Error('Invalid note files or access grants');
	}
	return {
		...value,
		id: value.id,
		user_id: value.user_id,
		title: value.title,
		data: {
			...data,
			content: {
				...content,
				md: (content.md ?? '') as string,
				html: (content.html ?? '') as string,
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
