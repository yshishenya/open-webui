import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { transpileModule, ScriptTarget } from 'typescript';

type Item = {
	id: string;
	name: string;
	meta: { description: string | null };
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
	getTools: FetchList,
	getSkills: FetchList,
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
const fetched: FetchList = async () => [];

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
			const init = createInit(value, failed, fetched, { error: (message) => errors.push(message) });
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
		const init = createInit(value, fetched, async () => null, { error: () => {} });
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
			async () => null,
			async () => null,
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
