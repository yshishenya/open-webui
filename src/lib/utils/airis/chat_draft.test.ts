// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import {
	readComposerDraft,
	writeComposerDraft,
	consumeComposerDraft,
	transferComposerDraft
} from './chat_draft';

it('native tab storage preserves long text, image, settings and selected note text across reload', () => {
	const draft = {
		prompt: 'x'.repeat(6001),
		files: [{ type: 'image', url: 'data:image/png;base64,fixture' }],
		selectedModels: ['model'],
		selectedToolIds: ['tool'],
		selectedText: 'note selection',
		params: { temperature: 0.2 },
		chatVariables: { topic: 'test' }
	};
	const snapshot = { actor: 'user', scope: 'note:operation', draft };
	writeComposerDraft(sessionStorage, snapshot);
	expect(readComposerDraft(sessionStorage, 'user', 'note:operation')).toEqual(draft);
	expect(readComposerDraft(sessionStorage, 'other', 'note:operation')).toBe(null);
	expect(readComposerDraft(sessionStorage, 'user', 'note:other')).toBe(null);
	transferComposerDraft(sessionStorage, 'user', 'note:operation', 'chat');
	expect(readComposerDraft(sessionStorage, 'user', 'chat')).toEqual(draft);
	consumeComposerDraft(sessionStorage, { ...snapshot, scope: 'chat' });
	expect(readComposerDraft(sessionStorage, 'user', 'chat')).toBe(null);
});

it('copy refusal leaves the source draft and selective cleanup preserves new settings', () => {
	const snapshot = {
		actor: 'user2',
		scope: 'note:op',
		draft: { prompt: 'raw', files: [], selectedToolIds: ['first'] }
	};
	writeComposerDraft(sessionStorage, snapshot);
	const setter = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
		throw new Error('quota exceeded');
	});
	expect(() => transferComposerDraft(sessionStorage, 'user2', 'note:op', 'chat')).toThrow(
		'quota exceeded'
	);
	setter.mockRestore();
	expect(readComposerDraft(sessionStorage, 'user2', 'note:op')).toEqual(snapshot.draft);
	const next = { ...snapshot.draft, selectedToolIds: ['new'] };
	writeComposerDraft(sessionStorage, { ...snapshot, draft: next });
	consumeComposerDraft(sessionStorage, snapshot);
	expect(readComposerDraft(sessionStorage, 'user2', 'note:op')).toEqual(next);
});

it('corrupt data, explicit credentials and a silent storage refusal are not accepted', () => {
	sessionStorage.setItem('airis-chat-draft:["corrupt","home"]', '{');
	expect(() => readComposerDraft(sessionStorage, 'corrupt', 'home')).toThrow();
	expect(() =>
		writeComposerDraft(sessionStorage, {
			actor: 'safe',
			scope: 'home',
			draft: { prompt: 'text', files: [{ token: 'secret' }] }
		})
	).toThrow('safely');
	const setter = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
	expect(() =>
		writeComposerDraft(sessionStorage, {
			actor: 'silent',
			scope: 'home',
			draft: { prompt: 'text', files: [] }
		})
	).toThrow('could not be saved');
	setter.mockRestore();
});

it('verified legacy chat draft migrates without resurrecting a consumed question', () => {
	const legacy = 'chat-input-legacy-chat';
	const draft = { prompt: 'old question', files: [] };
	sessionStorage.setItem(legacy, JSON.stringify(draft));
	expect(readComposerDraft(sessionStorage, 'legacy-user', 'legacy-chat')).toBe(null);
	expect(sessionStorage.getItem(legacy)).not.toBe(null);
	expect(readComposerDraft(sessionStorage, 'legacy-user', 'legacy-chat', legacy)).toEqual(draft);
	expect(sessionStorage.getItem(legacy)).toBe(null);
	consumeComposerDraft(sessionStorage, { actor: 'legacy-user', scope: 'legacy-chat', draft });
	expect(readComposerDraft(sessionStorage, 'legacy-user', 'legacy-chat', legacy)).toBe(null);
});

it('a distinct older legacy question is retained without replacing or resurrecting the new draft', () => {
	const legacy = 'chat-input-distinct';
	const draft = { prompt: 'new question', files: [] };
	const older = JSON.stringify({ prompt: 'old question', files: [] });
	sessionStorage.setItem(legacy, older);
	writeComposerDraft(sessionStorage, { actor: 'distinct-user', scope: 'distinct', draft });
	expect(readComposerDraft(sessionStorage, 'distinct-user', 'distinct', legacy)).toEqual(draft);
	expect(sessionStorage.getItem('airis-legacy-chat-draft:["distinct-user","distinct"]')).toBe(
		older
	);
	consumeComposerDraft(sessionStorage, { actor: 'distinct-user', scope: 'distinct', draft });
	expect(readComposerDraft(sessionStorage, 'distinct-user', 'distinct', legacy)).toBe(null);
});
