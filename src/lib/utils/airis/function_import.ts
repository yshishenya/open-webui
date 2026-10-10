import type { FunctionForm } from '$lib/apis/functions';
import type { ToolAccessGrantInput } from '$lib/apis/tools';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

export const parseCodeImport = (
	text: string,
	kind: 'function' | 'tool'
): (FunctionForm & { access_grants?: ToolAccessGrantInput[] | null })[] => {
	const entries: unknown = JSON.parse(text);
	if (!Array.isArray(entries) || entries.length === 0)
		throw new Error(`Select a non-empty JSON array of ${kind}s.`);
	const ids = new Set<string>();
	return entries.map((entry: unknown) => {
		const value = isRecord(entry) && kind in entry ? entry[kind] : entry;
		if (
			!isRecord(value) ||
			typeof value.id !== 'string' ||
			typeof value.name !== 'string' ||
			typeof value.content !== 'string' ||
			!isRecord(value.meta)
		) {
			throw new Error(`Invalid ${kind} import. Check ids, names, code and metadata.`);
		}
		// Python uses normalized identifier rules; the server remains authoritative for its Unicode version.
		const identifier = /^[_\p{ID_Start}][_\p{ID_Continue}]*$/u;
		if (
			!identifier.test(value.id) ||
			!identifier.test(value.id.normalize('NFKC')) ||
			ids.has(value.id.toLowerCase())
		) {
			throw new Error(`Invalid or duplicate ${kind} id.`);
		}
		const { description, manifest } = value.meta;
		if (
			(description !== undefined && description !== null && typeof description !== 'string') ||
			(manifest !== undefined && manifest !== null && !isRecord(manifest))
		) {
			throw new Error(`Invalid ${kind} metadata.`);
		}
		const grants =
			kind === 'tool' ? parseImportAccessGrants(value.access_grants, 'tool') : undefined;
		ids.add(value.id.toLowerCase());
		return {
			id: value.id,
			name: value.name,
			content: value.content,
			meta: value.meta,
			...(grants === undefined ? {} : { access_grants: grants })
		};
	});
};

export const parseFunctionImport = (text: string): FunctionForm[] =>
	parseCodeImport(text, 'function');

export const parseImportAccessGrants = (
	value: unknown,
	kind: 'tool' | 'skill' | 'prompt'
): ToolAccessGrantInput[] | null | undefined => {
	let grants: ToolAccessGrantInput[] | null | undefined;
	if (value !== undefined) {
		if (value === null) grants = null;
		else {
			if (!Array.isArray(value)) throw new Error(`Invalid ${kind} access grants.`);
			grants = value.map((grant: unknown): ToolAccessGrantInput => {
				if (
					!isRecord(grant) ||
					(grant.id !== undefined && typeof grant.id !== 'string') ||
					(grant.principal_type !== 'user' &&
						grant.principal_type !== 'group' &&
						grant.principal_type !== 'anyone') ||
					typeof grant.principal_id !== 'string' ||
					(grant.permission !== 'read' && grant.permission !== 'write')
				)
					throw new Error(`Invalid ${kind} access grants.`);
				return grant as ToolAccessGrantInput;
			});
		}
	}
	return grants;
};
