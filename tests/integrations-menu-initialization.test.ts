import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTools as fetchTools } from '$lib/apis/tools';
import { getSkills as fetchSkills } from '$lib/apis/skills';
import { deleteOAuthSession } from '$lib/apis/auths';
vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: '/api/v1' }));
afterEach(() => {
	vi.unstubAllGlobals();
});
import { transpileModule, ScriptTarget } from 'typescript';

type Item = {
	id: string;
	name: string;
	meta: { description?: string | null; tags?: string[] | null };
	description?: string | null;
	is_active?: boolean;
	authenticated?: boolean;
	has_user_valves?: boolean;
};
type Menu = Record<string, { name: string; enabled: boolean; authenticated?: boolean }>;
type State = {
	toolList: Item[] | null;
	skillList: Item[] | null;
	servers: { url: string; info?: { title?: string; description?: string } }[];
	selectedTools: string[];
	selectedSkills: string[];
	tools: Menu | null;
	skills: Menu | null;
};
type FetchList = () => Promise<Item[] | null>;
type InitFactory = (
	state: State,
	getTools: () => Promise<Item[]>,
	getSkills: () => Promise<Item[]>,
	toast: { error: (message: string) => void }
) => () => Promise<void>;

// Exercise the actual component initializer, with its stores and API outcomes.
const source = readFileSync('src/lib/components/chat/MessageInput/IntegrationsMenu.svelte', 'utf8');
const initializer = source.slice(source.indexOf('const init = async'), source.indexOf('</script>'));
const compiled = transpileModule(initializer, { compilerOptions: { target: ScriptTarget.ES2022 } });
const initializerFactory = new Function(
	'state',
	'getTools',
	'getSkills',
	'toast',
	`let $_tools = state.toolList, $_skills = state.skillList;
	 const _tools = { set: value => { $_tools = value; } };
	 const _skills = { set: value => { $_skills = value; } };
	 const localStorage = { token: 'fixture' }, $i18n = { t: value => value };
	 let tools = state.tools, skills = state.skills, tab = '';
	 let selectedToolIds = state.selectedTools, selectedSkillIds = state.selectedSkills;
	 let $toolServers = state.servers;
	 ${compiled.outputText}
	 return async () => {
		$_tools = state.toolList; $_skills = state.skillList; $toolServers = state.servers;
		await init();
		Object.assign(state, { toolList: $_tools, skillList: $_skills, tools, skills,
			selectedTools: selectedToolIds, selectedSkills: selectedSkillIds });
	 };`
);
const createInit: InitFactory = (state, getTools, getSkills, toast) =>
	initializerFactory(state, getTools, getSkills, toast);
const item = (id: string): Item => ({ id, name: id, meta: { description: null } });
const state = (): State => ({
	toolList: null,
	skillList: [],
	servers: [{ url: 'https://fixture.invalid', info: { title: 'Direct' } }],
	selectedTools: ['saved', 'direct_server:0'],
	selectedSkills: ['saved-skill'],
	tools: null,
	skills: null
});
const fetched = async (): Promise<Item[]> => [];
const toolsResponse = (
	result: FetchList,
	kind: 'tools' | 'skills' = 'tools'
): (() => Promise<Item[]>) => {
	vi.stubGlobal('fetch', async () => new Response(JSON.stringify(await result())));
	return () => (kind === 'tools' ? fetchTools('fixture') : fetchSkills('fixture'));
};

describe('integration menu list recovery', () => {
	it.each(['reject', 'null'] as const)(
		'preserves selection and direct server after %s',
		async (mode) => {
			const value = state();
			const errors: string[] = [];
			const failed: FetchList = async () => {
				if (mode === 'reject') throw new Error('temporarily unavailable');
				return null;
			};
			const init = createInit(value, toolsResponse(failed), fetched, {
				error: (message) => errors.push(message)
			});
			await init();
			expect(value.tools).toMatchObject({ 'direct_server:0': { name: 'Direct', enabled: true } });
			expect(value.selectedTools).toEqual(['saved', 'direct_server:0']);
			expect(errors).toHaveLength(1);
			value.toolList = [item('saved')];
			await init();
			expect(value.tools?.saved.enabled).toBe(true);
		}
	);

	it('preserves selected skills through failure and recovers on retry', async () => {
		const value = state();
		value.toolList = [];
		value.skillList = null;
		const init = createInit(
			value,
			fetched,
			toolsResponse(async () => null, 'skills'),
			{ error: () => {} }
		);
		await init();
		expect(value.skills).toEqual({});
		expect(value.selectedSkills).toEqual(['saved-skill']);
		value.skillList = [{ ...item('saved-skill'), is_active: true }];
		await init();
		expect(value.skills?.['saved-skill'].enabled).toBe(true);
	});

	it('does not retain stale records when reopened after a failed list', async () => {
		const value = state();
		value.toolList = [item('removed')];
		value.skillList = [{ ...item('removed-skill'), is_active: true }];
		const init = createInit(
			value,
			toolsResponse(async () => null),
			toolsResponse(async () => null, 'skills'),
			{ error: () => {} }
		);
		await init();
		value.toolList = null;
		value.skillList = null;
		value.servers = [];
		await init();
		expect(value.tools).toEqual({});
		expect(value.skills).toEqual({});
	});

	it('filters unavailable IDs only for successful authoritative lists', async () => {
		const value = state();
		value.toolList = [];
		value.skillList = [];
		value.servers = [];
		await createInit(value, fetched, fetched, { error: () => {} })();
		expect(value.tools).toEqual({});
		expect(value.skills).toEqual({});
		expect(value.selectedTools).toEqual([]);
		expect(value.selectedSkills).toEqual([]);
	});

	it('preserves OAuth and valves flags, active skills and direct server indices', async () => {
		const value = state();
		value.toolList = [{ ...item('server:mcp:one'), authenticated: false, has_user_valves: true }];
		value.skillList = [
			{ ...item('active'), is_active: true },
			{ ...item('inactive'), is_active: false }
		];
		value.servers = [{ url: 'missing-info' }, { url: 'fallback', info: {} }];
		value.selectedTools = ['server:mcp:one', 'direct_server:1', 'missing'];
		value.selectedSkills = ['active', 'inactive'];
		await createInit(value, fetched, fetched, { error: () => {} })();
		expect(value.tools).toMatchObject({
			'server:mcp:one': { authenticated: false, has_user_valves: true, enabled: true },
			'direct_server:1': { name: 'fallback', enabled: true }
		});
		expect(value.selectedTools).toEqual(['server:mcp:one', 'direct_server:1']);
		expect(value.selectedSkills).toEqual(['active']);
	});
});

// Run the actual disconnect handler and native API adapter, controlling only fetch/store boundaries.
const disconnectStart = source.lastIndexOf(
	'on:click={async (e) => {',
	source.indexOf('await deleteOAuthSession')
);
const disconnectCode = source.slice(
	disconnectStart + 'on:click={'.length,
	source.indexOf('}}', source.indexOf('await deleteOAuthSession')) + 1
);
type DisconnectState = {
	selected: string[];
	items: Item[];
	success: string[];
	errors: string[];
	refreshes: number;
};
const disconnectFactory = new Function(
	'state',
	'deleteOAuthSession',
	'getTools',
	`
 const localStorage = { token: 'fixture' }, $i18n = { t: value => value }, toolId = 'server:mcp:one';
 let selectedToolIds = state.selected;
 const _tools = { update: fn => state.items = fn(state.items), set: value => state.items = value };
 const toast = { success: value => state.success.push(value), error: value => state.errors.push(value) };
 const init = async () => { state.refreshes++; };
 const callback = ${disconnectCode};
 return async () => { await callback({ stopPropagation() {}, preventDefault() {} }); state.selected = selectedToolIds; };
`
) as (
	state: DisconnectState,
	remove: typeof deleteOAuthSession,
	list: () => Promise<Item[]>
) => () => Promise<void>;
const disconnectState = (): DisconnectState => ({
	selected: ['server:mcp:one', 'sibling'],
	items: [{ ...item('server:mcp:one'), authenticated: true }],
	success: [],
	errors: [],
	refreshes: 0
});
it.each(['network', 'json', 'null', 'false'] as const)(
	'does not report a disconnect after %s refusal',
	async (mode) => {
		const state = disconnectState();
		const fetch = vi.fn(async () => {
			if (mode === 'network') throw new TypeError('network unavailable');
			return new Response(mode === 'json' ? '{' : JSON.stringify(mode === 'null' ? null : false));
		});
		vi.stubGlobal('fetch', fetch);
		await disconnectFactory(state, deleteOAuthSession, fetched)();
		expect(state.success).toEqual([]);
		expect(state.errors).toEqual(['Failed to disconnect']);
		expect(state.selected).toEqual(['server:mcp:one', 'sibling']);
		expect(state.items[0].authenticated).toBe(true);
		expect(state.refreshes).toBe(0);
		expect(fetch).toHaveBeenCalledTimes(1);
	}
);
it.each([false, true])(
	'preserves a confirmed disconnect when refresh refuses=%s',
	async (refused) => {
		const state = disconnectState();
		const fetch = vi.fn(async () => new Response('true'));
		vi.stubGlobal('fetch', fetch);
		await disconnectFactory(state, deleteOAuthSession, async () => {
			if (refused) throw new Error('catalog refused');
			return [{ ...item('server:mcp:one'), authenticated: false }];
		})();
		expect(state.success).toEqual(['OAuth session disconnected']);
		expect(state.errors).toHaveLength(refused ? 1 : 0);
		expect(state.selected).toEqual(['sibling']);
		expect(state.items[0].authenticated).toBe(false);
		expect(state.refreshes).toBe(1);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch.mock.calls[0]).toMatchObject([
			'/api/v1/auths/oauth/sessions/mcp%3Aone',
			{ method: 'DELETE', headers: { Authorization: 'Bearer fixture' } }
		]);
	}
);
