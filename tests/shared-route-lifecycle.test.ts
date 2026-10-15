// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import type { SavedChat } from '$lib/utils/airis/frontend-contracts';
import type { ChatHistory } from '$lib/utils/airis/chat_history';
import type { Settings } from '$lib/stores';

const saved = (id: string): SavedChat => ({
	id,
	user_id: 'owner',
	title: id,
	created_at: 1,
	updated_at: 2,
	archived: false,
	chat: {
		title: id,
		models: ['free', 'free'],
		messages: [],
		history: { messages: {}, currentId: null }
	}
});
const code = (body: string): string =>
	ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const utils = ts.createSourceFile(
	'utils.ts',
	readFileSync('src/lib/utils/index.ts', 'utf8'),
	ts.ScriptTarget.Latest,
	true
);
const helper = (name: string): string => {
	for (const node of utils.statements) {
		if (!ts.isVariableStatement(node)) continue;
		const item = node.declarationList.declarations.find((n) => n.name.getText(utils) === name);
		if (item?.initializer) return item.initializer.getText(utils);
	}
	throw new Error(`Missing ${name}`);
};
const load = (token = '') => {
	const source = readFileSync('src/routes/s/[id]/+page.svelte', 'utf8');
	const instance = parse(source).instance;
	if (!instance) throw new Error('Missing route script');
	const ast = ts.createSourceFile(
		'route.ts',
		source.slice(instance.content.start, instance.content.end),
		ts.ScriptTarget.Latest,
		true
	);
	const script = ast.statements
		.filter((node) => !ts.isImportDeclaration(node) && !ts.isLabeledStatement(node))
		.map((node) => node.getText(ast))
		.join('\n');
	const requests: {
		resolve: (value: SavedChat | null) => void;
		reject: (value: unknown) => void;
	}[] = [];
	const fetchChat = vi.fn<unknown[], Promise<SavedChat | null>>(
		() =>
			new Promise((resolve, reject) => {
				requests.push({ resolve, reject });
			})
	);
	const goto = vi.fn(async () => {});
	const userSettings = vi.fn(async () => ({
		ui: {
			widescreenMode: true,
			directConnections: { BASE_URLS: ['http://local'], API_KEYS: ['test'], CONFIGS: {} }
		}
	}));
	const getModels = vi.fn(async () => [{ id: 'free', name: 'Free' }]);
	const owner = vi.fn(async () => ({ id: 'owner', name: 'Автор' }));
	const setSettings = vi.fn(),
		setModels = vi.fn(),
		setId = vi.fn(),
		clone = vi.fn(async () => ({ id: 'copy' }));
	const destroys: (() => void)[] = [];
	const context = {
		$page: { params: { id: 'old' } },
		$config: { features: { enable_direct_connections: false } },
		$settings: {} as Settings,
		getContext: () => ({}),
		onMount: () => {},
		onDestroy: (cb: () => void) => destroys.push(cb),
		dayjs: { extend: () => {} },
		localizedFormat: {},
		localStorage: { token, getItem: () => null },
		settings: { set: setSettings },
		models: { set: setModels },
		chatId: { set: setId },
		getChatByShareId: fetchChat,
		getUserSettings: userSettings,
		getModels,
		getUserInfoById: owner,
		cloneSharedChatById: clone,
		goto,
		toast: { error: vi.fn() },
		$i18n: { t: (s: string) => s },
		console: { error: vi.fn(), log: vi.fn() },
		uuidv4: () => 'generated'
	};
	setSettings.mockImplementation((value: Settings) => {
		context.$settings = value;
	});
	const route = runInNewContext(
		code(`(() => {
	const convertMessagesToHistory=${helper('convertMessagesToHistory')}; const createMessagesList=${helper('createMessagesList')};
	const tick=async()=>{messages=createMessagesList(history,history.currentId)};
	let canClone=true; ${script};
	return {load:loadSharedChat,clone:cloneSharedChat,state:()=>({chat,user,title,history,selectedModels,loaded}),
	allowClone:value=>canClone=value}; })()`),
		context
	) as {
		load: (id?: string) => Promise<unknown>;
		clone: () => Promise<void>;
		state: () => {
			chat: SavedChat | null;
			user: { id: string; name: string } | null;
			title: string;
			history: ChatHistory;
			selectedModels: string[];
			loaded: boolean;
		};
		allowClone: (value: boolean) => void;
	};
	return {
		route,
		requests,
		fetchChat,
		goto,
		userSettings,
		getModels,
		owner,
		setSettings,
		setModels,
		setId,
		clone,
		directConnections: () => {
			context.$config.features.enable_direct_connections = true;
		},
		select: (id: string) => {
			context.$page.params.id = id;
		},
		destroy: () => destroys.forEach((cb) => cb())
	};
};
const settle = async (): Promise<void> => {
	for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

it('keeps the new share when an older reply completes later', async () => {
	const { route, requests, select } = load();
	const old = route.load();
	await settle();
	select('new');
	const current = route.load();
	await settle();
	requests[1].resolve(saved('new'));
	await current;
	expect(route.state().title).toBe('new');
	requests[0].resolve(saved('old'));
	await old;
	expect(route.state().title).toBe('new');
});
it('does not redirect a current share because an older fetch failed', async () => {
	const { route, requests, select, goto } = load();
	const old = route.load();
	await settle();
	select('new');
	const current = route.load();
	await settle();
	requests[1].resolve(saved('new'));
	await current;
	requests[0].reject(new Error('expired'));
	await old;
	expect(goto).not.toHaveBeenCalled();
});
it('ignores a late share after the page has been destroyed', async () => {
	const { route, requests, destroy } = load();
	const pending = route.load();
	await settle();
	destroy();
	requests[0].resolve(saved('late'));
	await pending;
	expect(route.state().title).toBe('');
});

it.each(['failed', 'missing'] as const)(
	'redirects a current %s share exactly once',
	async (result) => {
		const { route, requests, goto } = load();
		const pending = route.load();
		await settle();
		if (result === 'failed') requests[0].reject(new Error('expired'));
		else requests[0].resolve(null);
		await pending;
		expect(goto).toHaveBeenCalledTimes(1);
		expect(goto).toHaveBeenCalledWith('/');
		expect(route.state().loaded).toBe(false);
	}
);
it('loads anonymously without settings, models or owner requests and preserves duplicate model slots', async () => {
	const { route, requests, userSettings, getModels, owner, setModels, setId } = load();
	const pending = route.load();
	await settle();
	requests[0].resolve(saved('public'));
	await pending;
	expect(userSettings).not.toHaveBeenCalled();
	expect(getModels).not.toHaveBeenCalled();
	expect(owner).not.toHaveBeenCalled();
	expect(setModels).toHaveBeenCalledWith([]);
	expect(setId).toHaveBeenCalledWith('old');
	expect(route.state()).toMatchObject({
		loaded: true,
		title: 'public',
		user: null,
		selectedModels: ['free', 'free']
	});
});
it('loads existing settings, direct connections and display owner without inventing session permissions', async () => {
	const { route, requests, userSettings, getModels, owner, directConnections, setSettings } =
		load('test-token');
	directConnections();
	const pending = route.load();
	await settle();
	requests[0].resolve(saved('stored'));
	await pending;
	expect(userSettings).toHaveBeenCalledWith('test-token');
	expect(setSettings).toHaveBeenCalledWith(expect.objectContaining({ widescreenMode: true }));
	expect(getModels).toHaveBeenCalledWith('test-token', {
		BASE_URLS: ['http://local'],
		API_KEYS: ['test'],
		CONFIGS: {}
	});
	expect(owner).toHaveBeenCalledWith('test-token', 'owner');
	expect(route.state().user).toEqual({ id: 'owner', name: 'Автор' });
});
it('keeps legacy messages and the last completed message when stored history is absent', async () => {
	const { route, requests } = load();
	const pending = route.load();
	await settle();
	const record = saved('legacy');
	record.chat.models = null;
	record.chat.history = null;
	record.chat.messages = [
		{ id: 'question', role: 'user', parentId: null, childrenIds: [], content: 'Вопрос' },
		{ id: 'answer', role: 'assistant', parentId: 'question', childrenIds: [], content: 'Ответ' }
	];
	requests[0].resolve(record);
	await pending;
	expect(route.state().selectedModels).toEqual(['']);
	expect(route.state().history.currentId).toBe('answer');
	expect(route.state().history.messages.question.childrenIds).toEqual(['answer']);
	expect(route.state().history.messages.answer.done).toBe(true);
});
it('does not write settings or continue fetching when destruction occurs during the settings read', async () => {
	const { route, userSettings, setSettings, getModels, fetchChat, destroy } = load('test-token');
	let resolveSettings: (value: Awaited<ReturnType<typeof userSettings>>) => void = () => {};
	userSettings.mockReturnValueOnce(
		new Promise((resolve) => {
			resolveSettings = resolve;
		})
	);
	const pending = route.load();
	destroy();
	resolveSettings({
		ui: { widescreenMode: true, directConnections: { BASE_URLS: [], API_KEYS: [], CONFIGS: {} } }
	});
	await pending;
	expect(setSettings).not.toHaveBeenCalled();
	expect(getModels).not.toHaveBeenCalled();
	expect(fetchChat).not.toHaveBeenCalled();
});
it('does not show a loaded share after destruction during the owner read', async () => {
	const { route, requests, owner, destroy } = load('test-token');
	let resolveOwner: (value: Awaited<ReturnType<typeof owner>>) => void = () => {};
	owner.mockReturnValueOnce(
		new Promise((resolve) => {
			resolveOwner = resolve;
		})
	);
	const pending = route.load();
	await settle();
	requests[0].resolve(saved('closed'));
	await settle();
	destroy();
	resolveOwner({ id: 'owner', name: 'Автор' });
	await pending;
	expect(route.state().loaded).toBe(false);
	expect(route.state().chat).toBeNull();
});
it('retains the clone permission guard and existing successful copy navigation', async () => {
	const { route, requests, clone, goto } = load();
	const pending = route.load();
	await settle();
	requests[0].resolve(saved('source'));
	await pending;
	route.allowClone(false);
	await route.clone();
	expect(clone).not.toHaveBeenCalled();
	route.allowClone(true);
	await route.clone();
	expect(clone).toHaveBeenCalledWith('', 'source');
	expect(goto).toHaveBeenCalledWith('/c/copy');
});
