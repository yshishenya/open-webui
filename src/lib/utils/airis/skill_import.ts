import type { SkillForm } from '$lib/apis/skills';
import { parseImportAccessGrants } from './function_import';

export const parseSkillImport = (text: string): SkillForm[] => {
	const parsed: unknown = JSON.parse(text);
	const entries: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
	if (!entries.length) throw new Error('Select a non-empty JSON file of skills.');
	const ids = new Set<string>();
	return entries.map((entry): SkillForm => {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry))
			throw new Error('Invalid skill import.');
		const value = entry as Record<string, unknown>;
		if (
			typeof value.id !== 'string' ||
			!value.id.length ||
			typeof value.name !== 'string' ||
			typeof value.content !== 'string' ||
			(value.description !== undefined &&
				value.description !== null &&
				typeof value.description !== 'string') ||
			(value.is_active !== undefined && typeof value.is_active !== 'boolean')
		)
			throw new Error('Invalid skill import.');
		const id = value.id.toLowerCase().replaceAll(' ', '-');
		if (ids.has(id)) throw new Error('Duplicate skill id.');
		ids.add(id);
		let meta: SkillForm['meta'];
		if (value.meta !== undefined) {
			if (!value.meta || typeof value.meta !== 'object' || Array.isArray(value.meta))
				throw new Error('Invalid skill metadata.');
			const tags = (value.meta as Record<string, unknown>).tags;
			if (
				tags !== undefined &&
				tags !== null &&
				(!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string'))
			)
				throw new Error('Invalid skill metadata.');
			meta = value.meta as SkillForm['meta'];
		}
		const grants = parseImportAccessGrants(value.access_grants, 'skill');
		return {
			id: value.id,
			name: value.name,
			content: value.content,
			...(value.description === undefined
				? {}
				: { description: value.description as string | null }),
			...(value.is_active === undefined ? {} : { is_active: value.is_active as boolean }),
			...(meta === undefined ? {} : { meta }),
			...(grants === undefined ? {} : { access_grants: grants })
		};
	});
};
