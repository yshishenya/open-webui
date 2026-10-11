import { convertOpenAIChats, getImportOrigin } from '$lib/utils';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

/** Normalize the existing AIRIS/ChatGPT exports; the server validates the API payload. */
export const parseChatImport = (text: string): object[] => {
	let entries: unknown;
	try {
		entries = JSON.parse(text);
	} catch {
		throw new Error('Invalid JSON file');
	}
	if (!Array.isArray(entries) || !entries.every(isRecord)) throw new Error('Invalid file format.');
	let rows: Record<string, unknown>[] = entries;
	if (getImportOrigin(rows) === 'openai') {
		if (
			rows.some(
				(row) =>
					'mapping' in row &&
					(!isRecord(row.mapping) || (row.title != null && typeof row.title !== 'string'))
			)
		)
			throw new Error('Invalid file format.');
		try {
			rows = convertOpenAIChats(rows);
		} catch {
			throw new Error('Invalid file format.');
		}
	}
	return rows.map((row) => {
		const wrapped = 'chat' in row;
		const chat = wrapped ? row.chat : row;
		const meta = wrapped ? (row.meta ?? {}) : {};
		const folderId = wrapped ? (row.folder_id ?? null) : null;
		if (!isRecord(chat) || !isRecord(meta) || (folderId !== null && typeof folderId !== 'string'))
			throw new Error('Invalid file format.');
		return {
			chat,
			meta,
			pinned: false,
			folder_id: folderId,
			created_at: row.created_at ?? null,
			updated_at: row.updated_at ?? null
		};
	});
};
