// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false, dev: false }));
import { normalizeNote } from '$lib/utils/airis/notes';
import { requestJSON } from '$lib/utils/airis/request_json';
import { parseChatImport } from '$lib/utils/airis/chat_import';

const note = () => ({
	id: 'note', user_id: 'owner', title: 'Notebook', created_at: 1, updated_at: 2,
	data: { content: { md: 'old content', html: '<p>old content</p>', json: null } }
});
const page = () => ({
	id: 'page', parent_id: null, title: 'Page', content: { md: 'private draft' },
	versions: [{ md: 'previous draft' }], revision: 4, generation: 2
});

afterEach(() => { vi.unstubAllGlobals(); });

it('preserves legacy content and versions when adapting a note to pages', () => {
	const result = normalizeNote({ ...note(), data: { ...note().data, versions: [{ md: 'previous' }] } });
	expect(result.data.pages).toEqual([{
		id: 'main', title: 'Notebook', inherit_note_title: true,
		content: { md: 'old content', html: '<p>old content</p>', json: null },
		versions: [{ md: 'previous', html: '', json: null }], revision: 0, generation: 0
	}]);
});

it('retains page identities, revisions and data when normalizing a multipage response', () => {
	const result = normalizeNote({ ...note(), data: { pages: [page()], pages_revision: 7 } });
	expect(result.data.pages_revision).toBe(7);
	expect(result.data.pages[0]).toEqual({ ...page(),
		content: { md: 'private draft', html: '', json: null },
		versions: [{ md: 'previous draft', html: '', json: null }]
	});
});

it.each([
	{ ...page(), content: { md: 3 } },
	{ ...page(), parent_id: {} },
	{ ...page(), inherit_note_title: 'true' },
	{ ...page(), revision: -1 },
	{ ...page(), generation: 0.5 }
])('rejects malformed page data rather than replacing user content', (invalid) => {
	expect(() => normalizeNote({ ...note(), data: { pages: [invalid] } })).toThrow('Invalid note pages');
});

it('rejects duplicate page ids and malformed structural revision', () => {
	expect(() => normalizeNote({ ...note(), data: { pages: [page(), page()] } })).toThrow('Invalid note pages');
	expect(() => normalizeNote({ ...note(), data: { pages: [page()], pages_revision: -1 } })).toThrow('Invalid note pages revision');
});

it('retains the version conflict code so editors can offer recovery after HTTP409', async () => {
	vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
		detail: { code: 'version_conflict', message: 'This resource changed.' }
	}), { status: 409 })));
	await expect(requestJSON('/tools/edit', 'synthetic', { content: 'draft' })).rejects.toMatchObject({
		code: 'version_conflict'
	});
});

it('preserves variables and archive/pin state in a wrapped AIRIS export', () => {
	const row = { chat: { title: 'Imported', history: {} }, variables: { customer: 'test' },
		pinned: true, archived: true, folder_id: 'folder', meta: { icon: 'star' }, created_at: 1, updated_at: 2 };
	expect(parseChatImport(JSON.stringify([row]))).toEqual([row]);
});

it.each([{ variables: [] }, { pinned: 'true' }, { archived: 1 }])('rejects malformed import metadata', (bad) => {
	expect(() => parseChatImport(JSON.stringify([{ chat: { title: 'Imported' }, ...bad }]))).toThrow('Invalid file format');
});
