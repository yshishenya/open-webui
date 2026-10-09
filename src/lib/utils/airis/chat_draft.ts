import equal from 'fast-deep-equal';
import type { ModelParams } from '$lib/apis';
import type { ChatAttachment } from './chat_history';

export type ComposerDraft = {
	prompt: string;
	files: ChatAttachment[];
	selectedModels?: string[];
	atSelectedModelId?: string;
	selectedToolIds?: string[];
	selectedSkillIds?: string[];
	selectedFilterIds?: string[];
	webSearchEnabled?: boolean;
	imageGenerationEnabled?: boolean;
	codeInterpreterEnabled?: boolean;
	selectedText?: string;
	params?: ModelParams;
	chatVariables?: Record<string, unknown>;
};
export type ComposerSnapshot = { actor: string; scope: string; draft: ComposerDraft };
const record = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);
export const hasCredential = (value: unknown): boolean => {
	if (Array.isArray(value)) return value.some(hasCredential);
	return (
		record(value) &&
		Object.entries(value).some(
			([name, child]) =>
				/^(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|token)$/i.test(
					name
				) || hasCredential(child)
		)
	);
};
export const validComposerDraft = (value: unknown): value is ComposerDraft =>
	record(value) &&
	typeof value.prompt === 'string' &&
	Array.isArray(value.files) &&
	value.files.every(
		(file: unknown) =>
			record(file) &&
			['type', 'content_type', 'name', 'status', 'itemId'].every(
				(name) => file[name] === undefined || typeof file[name] === 'string'
			) &&
			['id', 'url'].every((name) => file[name] == null || typeof file[name] === 'string')
	) &&
	['selectedModels', 'selectedToolIds', 'selectedSkillIds', 'selectedFilterIds'].every(
		(name) =>
			value[name] === undefined ||
			(Array.isArray(value[name]) && value[name].every((id: unknown) => typeof id === 'string'))
	) &&
	['webSearchEnabled', 'imageGenerationEnabled', 'codeInterpreterEnabled'].every(
		(name) => value[name] === undefined || typeof value[name] === 'boolean'
	) &&
	(value.selectedText === undefined || typeof value.selectedText === 'string') &&
	(value.atSelectedModelId === undefined || typeof value.atSelectedModelId === 'string') &&
	['params', 'chatVariables'].every((name) => value[name] === undefined || record(value[name])) &&
	!hasCredential(value);

const key = (actor: string, scope: string): string => {
	if (!actor || !scope) throw new Error('Account and scope are required to save a draft');
	return `airis-chat-draft:${JSON.stringify([actor, scope])}`;
};
export const readComposerDraft = (
	storage: Storage,
	actor: string,
	scope: string,
	legacyKey?: string
): ComposerDraft | null => {
	const current = storage.getItem(key(actor, scope));
	const legacy = legacyKey ? storage.getItem(legacyKey) : null;
	const raw = current ?? legacy;
	if (raw === null) return null;
	const draft: unknown = JSON.parse(raw);
	if (!validComposerDraft(draft)) throw new Error('Invalid saved draft');
	if (legacyKey && legacy !== null) {
		if (current === null) writeComposerDraft(storage, { actor, scope, draft });
		else if (legacy !== current) {
			// Preserve an older distinct question without restoring it after a new request is consumed.
			const archive = `airis-legacy-chat-draft:${JSON.stringify([actor, scope])}`;
			const previous = storage.getItem(archive);
			if (previous !== null && previous !== legacy)
				throw new Error('An older draft is already retained');
			storage.setItem(archive, legacy);
			if (storage.getItem(archive) !== legacy) throw new Error('Older draft could not be retained');
		}
		storage.removeItem(legacyKey);
		if (storage.getItem(legacyKey) !== null) throw new Error('Legacy draft cleanup failed');
	}
	return draft;
};
export const writeComposerDraft = (storage: Storage, snapshot: ComposerSnapshot): void => {
	if (!validComposerDraft(snapshot.draft)) throw new Error('Draft cannot be saved safely');
	readComposerDraft(storage, snapshot.actor, snapshot.scope);
	const name = key(snapshot.actor, snapshot.scope),
		encoded = JSON.stringify(snapshot.draft);
	storage.setItem(name, encoded);
	if (storage.getItem(name) !== encoded) throw new Error('Draft could not be saved');
};
export const consumeComposerDraft = (storage: Storage, snapshot: ComposerSnapshot): void => {
	if (equal(readComposerDraft(storage, snapshot.actor, snapshot.scope), snapshot.draft)) {
		const name = key(snapshot.actor, snapshot.scope);
		storage.removeItem(name);
		if (storage.getItem(name) !== null) throw new Error('Draft cleanup failed');
	}
};
// Copy before consuming: refusal keeps the original draft and creation intent recoverable.
export const transferComposerDraft = (
	storage: Storage,
	actor: string,
	from: string,
	to: string
): void => {
	const draft = readComposerDraft(storage, actor, from);
	if (!draft) throw new Error('Note draft is required before creating its chat');
	const previous = readComposerDraft(storage, actor, to);
	if (previous && !equal(previous, draft)) throw new Error('The chat has a newer draft');
	writeComposerDraft(storage, { actor, scope: to, draft });
};
