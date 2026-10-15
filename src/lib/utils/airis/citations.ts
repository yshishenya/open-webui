export type CitationMetadata = Record<string, unknown> & {
	file_id?: string;
	page?: number;
	html?: boolean;
};

export type CitationSource = Record<string, unknown> & {
	id: string;
	name: string;
	url?: string;
	embed_url?: string;
};

export type Citation = {
	id: string;
	source: CitationSource;
	document: string[];
	metadata: (CitationMetadata | undefined)[];
	distances: (number | undefined)[];
};

export type CitationDocument = {
	source: CitationSource;
	document: string;
	metadata?: CitationMetadata;
	distance?: number;
};

export type CitationEmbed = {
	url: string;
	title: string;
	source: Citation;
	chatId: string;
	messageId: string;
	sourceId: string;
};

const record = (value: unknown): Record<string, unknown> | undefined =>
	value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

/** Keep source numbering and every document's optional fields aligned. */
export const groupCitations = (sources: unknown): Citation[] => {
	const groups = new Map<string, Citation>();
	for (const entry of Array.isArray(sources) ? sources : []) {
		const row = record(entry);
		if (!Array.isArray(row?.document)) continue;
		const info = record(row.source) ?? {};
		row.document.forEach((document: unknown, index: number) => {
			if (typeof document !== 'string') return;
			const raw = record(Array.isArray(row.metadata) ? row.metadata[index] : undefined);
			const rawId = raw?.source || info.id || 'N/A';
			const id =
				typeof rawId === 'string' || (typeof rawId === 'number' && Number.isFinite(rawId))
					? String(rawId)
					: 'N/A';
			const name =
				typeof raw?.name === 'string' && raw.name
					? raw.name
					: typeof info.name === 'string' && info.name
						? info.name
						: id;
			const isUrl = id.startsWith('http://') || id.startsWith('https://');
			const source: CitationSource = {
				...info,
				id:
					typeof info.id === 'string' || (typeof info.id === 'number' && Number.isFinite(info.id))
						? String(info.id)
						: id,
				name: isUrl ? id : name,
				url: isUrl ? id : typeof info.url === 'string' ? info.url : undefined,
				embed_url: typeof info.embed_url === 'string' ? info.embed_url : undefined
			};
			const metadata: CitationMetadata | undefined = raw
				? {
						...raw,
						file_id: typeof raw.file_id === 'string' ? raw.file_id : undefined,
						page: typeof raw.page === 'number' && Number.isInteger(raw.page) ? raw.page : undefined,
						html: raw.html === true
					}
				: undefined;
			const value: unknown = Array.isArray(row.distances) ? row.distances[index] : undefined;
			const distance = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
			let citation = groups.get(id);
			if (!citation) {
				citation = { id, source, document: [], metadata: [], distances: [] };
				groups.set(id, citation);
			}
			citation.document.push(document);
			citation.metadata.push(metadata);
			citation.distances.push(distance);
		});
	}
	return [...groups.values()];
};
