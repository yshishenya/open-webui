import type { FunctionForm } from '$lib/apis/functions';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

export const parseFunctionImport = (text: string): FunctionForm[] => {
	const entries: unknown = JSON.parse(text);
	if (!Array.isArray(entries) || entries.length === 0)
		throw new Error('Select a non-empty JSON array of functions.');
	const ids = new Set<string>();
	return entries.map((entry: unknown): FunctionForm => {
		const value = isRecord(entry) && 'function' in entry ? entry.function : entry;
		if (
			!isRecord(value) ||
			typeof value.id !== 'string' ||
			typeof value.name !== 'string' ||
			typeof value.content !== 'string' ||
			!isRecord(value.meta)
		) {
			throw new Error('Invalid function import. Check ids, names, code and metadata.');
		}
		// Python uses normalized identifier rules; the server remains authoritative for its Unicode version.
		const identifier = /^[_\p{ID_Start}][_\p{ID_Continue}]*$/u;
		if (
			!identifier.test(value.id) ||
			!identifier.test(value.id.normalize('NFKC')) ||
			ids.has(value.id.toLowerCase())
		) {
			throw new Error('Invalid or duplicate function id.');
		}
		const { description, manifest } = value.meta;
		if (
			(description !== undefined && description !== null && typeof description !== 'string') ||
			(manifest !== undefined && manifest !== null && !isRecord(manifest))
		) {
			throw new Error('Invalid function metadata.');
		}
		ids.add(value.id.toLowerCase());
		return { id: value.id, name: value.name, content: value.content, meta: value.meta };
	});
};
