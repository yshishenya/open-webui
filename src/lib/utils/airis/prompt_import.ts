import type { PromptForm } from '$lib/apis/prompts';
import { parseImportAccessGrants } from './function_import';

export const parsePromptImport = (text: string): PromptForm[] => {
	const parsed: unknown = JSON.parse(text);
	const entries: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
	if (!entries.length) throw new Error('Select a non-empty JSON file of prompts.');
	const commands = new Set<string>();
	return entries.map((entry): PromptForm => {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry))
			throw new Error('Invalid prompt import.');
		const value = entry as Record<string, unknown>;
		const name = value.name ?? value.title;
		if (
			typeof name !== 'string' ||
			typeof value.command !== 'string' ||
			!value.command.length ||
			typeof value.content !== 'string'
		)
			throw new Error('Invalid prompt import.');
		const command = value.command.startsWith('/') ? value.command.slice(1) : value.command;
		if (!command.length || commands.has(command))
			throw new Error('Invalid or duplicate prompt command.');
		commands.add(command);
		for (const field of ['data', 'meta']) {
			if (
				value[field] !== undefined &&
				value[field] !== null &&
				(typeof value[field] !== 'object' || Array.isArray(value[field]))
			)
				throw new Error('Invalid prompt metadata.');
		}
		if (
			value.tags !== undefined &&
			value.tags !== null &&
			(!Array.isArray(value.tags) ||
				!value.tags.every((tag) => tag === null || typeof tag === 'string'))
		)
			throw new Error('Invalid prompt tags.');
		const grants = parseImportAccessGrants(value.access_grants, 'prompt');
		return {
			name,
			command: value.command,
			content: value.content,
			...(value.data === undefined ? {} : { data: value.data as PromptForm['data'] }),
			...(value.meta === undefined ? {} : { meta: value.meta as PromptForm['meta'] }),
			...(value.tags === undefined ? {} : { tags: value.tags as PromptForm['tags'] }),
			...(grants === undefined ? {} : { access_grants: grants })
		};
	});
};
