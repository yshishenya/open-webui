// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => (resolve = done));
	return { promise, resolve };
};
const chat = (id: string) => ({
	id,
	title: id,
	chat: { models: ['model'], history: { currentId: id, messages: {} }, messages: [] }
});
type Chat = ReturnType<typeof chat>;

const setup = () => {
	const text = readFileSync('src/lib/components/layout/SearchModal.svelte', 'utf8');
	const script = parse(text).instance;
	if (!script) throw new Error('Missing actual search script');
	const parsed = ts.createSourceFile(
		'search.ts',
		text.slice(script.content.start, script.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const body = parsed.statements
		.filter((s) => !ts.isImportDeclaration(s) && !ts.isLabeledStatement(s))
		.map((s) => s.getText(parsed).replace(/^export /, ''))
		.join('\n');
	const getChatById = vi.fn<[token: string, id: string], Promise<Chat | null>>();
	const generateTitle = vi.fn<[], Promise<string | null>>();
	const updateChatById = vi.fn<[], Promise<unknown>>().mockResolvedValue({});
	const error = vi.fn();
	let destroy = () => {};
	const code = ts.transpileModule(
		body +
			`
		show = true;
		chatList = [{id:'a',title:'a'}, {id:'b',title:'b'}];
		return {
			preview: loadChatPreview, rename: renameHandler, confirm: confirmRename,
			generate: generateTitleHandler, cancel: cancelRename, search: searchHandler,
			close: () => {show = false; cancelSearch(); cancelRename();},
			select: (index) => {selectedIdx = index; return loadChatPreview(index);},
			setTitle: (value) => {editingChatTitle = value;},
			state: () => ({selectedChat, history, messages, selectedModels, editingChatId, editingChatTitle, generating, chatList})
		};`,
		{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
	).outputText;
	const api = runInNewContext(`(function(){${code}})()`, {
		HTMLInputElement: class {},
		getContext: () => ({ t: (s: string) => s }),
		$i18n: { t: (s: string) => s },
		toast: { error },
		onMount: () => {},
		onDestroy: (callback: () => void) => {
			destroy = callback;
		},
		tick: async () => {},
		document: { getElementById: () => null, removeEventListener: () => {} },
		requestAnimationFrame: () => {},
		setTimeout: () => 1,
		clearTimeout: () => {},
		dayjs: { extend: () => {} },
		calendar: {},
		localizedFormat: {},
		EditPencilIcon: {},
		localStorage: { token: 'fixture' },
		getChatById,
		generateTitle,
		updateChatById,
		refreshChatList: async () => {},
		getChatList: async () => [],
		createMessagesList: () => [],
		getOutputText: () => ''
	}) as {
		preview: (index: number | null) => Promise<void>;
		select: (index: number | null) => Promise<void>;
		rename: (id: string) => Promise<void>;
		confirm: () => Promise<void>;
		generate: () => Promise<void>;
		cancel: () => void;
		search: () => Promise<void>;
		close: () => void;
		setTitle: (value: string) => void;
		state: () => {
			selectedChat: Chat | null;
			history: object | null;
			messages: unknown[] | null;
			selectedModels: string[];
			editingChatId: string | null;
			editingChatTitle: string;
			generating: boolean;
			chatList: { id: string; title: string }[] | null;
		};
	};
	return { api, getChatById, generateTitle, updateChatById, error, destroy: () => destroy() };
};

it('an older preview cannot replace the currently selected conversation', async () => {
	const { api, getChatById } = setup();
	const old = deferred<Chat>();
	getChatById.mockReturnValueOnce(old.promise).mockResolvedValueOnce(chat('b'));
	const pending = api.select(1);
	await api.select(2);
	old.resolve(chat('a'));
	await pending;
	expect(api.state().selectedChat?.id).toBe('b');
});

it.each(['action', 'close', 'search', 'destroy'] as const)(
	'%s invalidates a pending preview',
	async (kind) => {
		const { api, getChatById, destroy, error } = setup();
		const old = deferred<Chat | null>();
		getChatById.mockReturnValueOnce(old.promise);
		const pending = api.select(1);
		if (kind === 'action') await api.select(0);
		if (kind === 'close') api.close();
		if (kind === 'search') await api.search();
		if (kind === 'destroy') destroy();
		old.resolve(kind === 'destroy' ? null : chat('a'));
		await pending;
		expect(api.state().selectedChat).toBeNull();
		expect(error).not.toHaveBeenCalled();
	}
);

it('legacy preview clears the previous history instead of showing another chat', async () => {
	const { api, getChatById } = setup();
	getChatById.mockResolvedValueOnce(chat('a')).mockResolvedValueOnce({
		...chat('b'),
		chat: { models: ['model'], messages: [], history: null }
	} as unknown as Chat);
	await api.select(1);
	await api.select(2);
	expect(api.state().history).toBeNull();
});

it('changing the renamed chat while generating never sends its title to the new chat', async () => {
	const { api, getChatById, generateTitle, updateChatById } = setup();
	const old = deferred<string>();
	getChatById.mockResolvedValue(chat('a'));
	generateTitle.mockReturnValueOnce(old.promise);
	await api.rename('a');
	const pending = api.generate();
	await vi.waitFor(() => expect(generateTitle).toHaveBeenCalledOnce());
	await api.rename('b');
	old.resolve('generated for a');
	await pending;
	expect(api.state().editingChatId).toBe('b');
	expect(api.state().editingChatTitle).toBe('b');
	expect(api.state().generating).toBe(false);
	expect(updateChatById).not.toHaveBeenCalled();
});

it('canceling generation before the chat loads skips the provider request', async () => {
	const { api, getChatById, generateTitle } = setup();
	const old = deferred<Chat>();
	getChatById.mockReturnValueOnce(old.promise);
	await api.rename('a');
	const pending = api.generate();
	api.cancel();
	old.resolve(chat('a'));
	await pending;
	expect(generateTitle).not.toHaveBeenCalled();
	expect(api.state().generating).toBe(false);
});

it('rename response updates its captured row and preserves a newer edit', async () => {
	const { api, updateChatById } = setup();
	const old = deferred<unknown>();
	updateChatById.mockReturnValueOnce(old.promise);
	await api.rename('a');
	api.setTitle('a edited');
	const pending = api.confirm();
	await api.rename('b');
	api.setTitle('b edited');
	old.resolve({});
	await pending;
	expect(api.state().chatList?.map((row) => row.title)).toEqual(['a edited', 'b']);
	expect(api.state().editingChatId).toBe('b');
	expect(api.state().editingChatTitle).toBe('b edited');
});

it('accepted generation saves exactly once to its own chat', async () => {
	const { api, getChatById, generateTitle, updateChatById } = setup();
	getChatById.mockResolvedValue(chat('a'));
	generateTitle.mockResolvedValue('generated');
	await api.rename('a');
	await api.generate();
	expect(updateChatById.mock.calls).toEqual([['fixture', 'a', { title: 'generated' }]]);
	expect(api.state().generating).toBe(false);
});

it.each(['empty', 'rejected'] as const)(
	'a %s generation preserves the original entered title',
	async (kind) => {
		const { api, getChatById, generateTitle, updateChatById } = setup();
		getChatById.mockResolvedValue(chat('a'));
		if (kind === 'empty') generateTitle.mockResolvedValue(null);
		else generateTitle.mockRejectedValue(new Error('Provider unavailable'));
		await api.rename('a');
		api.setTitle('my entered title');
		await api.generate();
		expect(api.state().editingChatTitle).toBe('my entered title');
		expect(api.state().generating).toBe(false);
		expect(updateChatById).not.toHaveBeenCalled();
	}
);

it('rename failure leaves the edit available for an explicit retry', async () => {
	const { api, updateChatById, error } = setup();
	updateChatById.mockRejectedValueOnce(new Error('Save unavailable')).mockResolvedValueOnce({});
	await api.rename('a');
	api.setTitle('keep this');
	await api.confirm();
	expect(api.state().editingChatTitle).toBe('keep this');
	expect(error).toHaveBeenCalledOnce();
	await api.confirm();
	expect(api.state().chatList?.[0].title).toBe('keep this');
	expect(api.state().editingChatId).toBeNull();
});

it('the save response preserves newer text entered in the same chat', async () => {
	const { api, updateChatById } = setup();
	const old = deferred<unknown>();
	updateChatById.mockReturnValueOnce(old.promise);
	await api.rename('a');
	api.setTitle('first');
	const pending = api.confirm();
	api.setTitle('second');
	old.resolve({});
	await pending;
	expect(api.state().chatList?.[0].title).toBe('first');
	expect(api.state().editingChatTitle).toBe('second');
	expect(api.state().editingChatId).toBe('a');
});
