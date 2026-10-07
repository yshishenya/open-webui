import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { transpileModule, ScriptTarget } from 'typescript';

type Item = { id: string; name: string };
type State = { functions: Item[] | null; tools: Item[] | null; loading: boolean };
type FetchList = () => Promise<Item[] | null>;
type Factory = (
	state: State,
	getFunctions: FetchList,
	getTools: FetchList,
	toast: { error: (message: string) => void }
) => () => Promise<void>;

const source = readFileSync('src/lib/components/chat/Controls/Valves.svelte', 'utf8');
const initializer = source.slice(source.indexOf('const init = async'), source.indexOf('</script>'));
const compiled = transpileModule(initializer, { compilerOptions: { target: ScriptTarget.ES2022 } });
// Run the component's real initializer; only API/store boundaries are controlled.
const factory: Factory = new Function(
	'state',
	'getFunctions',
	'getTools',
	'toast',
	`let $functions = state.functions, $tools = state.tools, loading = state.loading;
	 const functions = { set: value => { $functions = value; } };
	 const tools = { set: value => { $tools = value; } };
	 const localStorage = { token: 'fixture' }, $i18n = { t: value => value };
	 ${compiled.outputText}
	 return async () => {
		try { await init(); }
		finally { Object.assign(state, { functions: $functions, tools: $tools, loading }); }
	 };`
) as Factory;

describe('valves list load recovery', () => {
	it.each([
		['functions', 'reject'],
		['functions', 'null'],
		['tools', 'reject'],
		['tools', 'null']
	] as const)('recovers %s after %s', async (list, mode) => {
		const state: State = { functions: null, tools: null, loading: false };
		const errors: string[] = [];
		let failed = true;
		const fetchList: FetchList = async () => {
			if (!failed) return [{ id: 'recovered', name: 'Recovered' }];
			if (mode === 'reject') throw new Error('private provider error');
			return null;
		};
		const sibling: FetchList = async () => [{ id: 'sibling', name: 'Sibling' }];
		const init = factory(
			state,
			list === 'functions' ? fetchList : sibling,
			list === 'tools' ? fetchList : sibling,
			{ error: (message) => errors.push(message) }
		);
		await init();
		expect(state.loading).toBe(false);
		expect(state[list]).toBeNull();
		expect(state[list === 'functions' ? 'tools' : 'functions']?.[0].id).toBe('sibling');
		expect(errors).toHaveLength(1);
		expect(errors[0]).not.toContain('private provider error');
		failed = false;
		await init();
		expect(state[list]?.[0].id).toBe('recovered');
		expect(state.loading).toBe(false);
	});

	it('keeps successful empty lists cached without new requests or errors', async () => {
		const state: State = { functions: [], tools: [], loading: false };
		const forbidden: FetchList = async () => {
			throw new Error('cached lists must not refetch');
		};
		const errors: string[] = [];
		await factory(state, forbidden, forbidden, { error: (message) => errors.push(message) })();
		expect(state).toEqual({ functions: [], tools: [], loading: false });
		expect(errors).toEqual([]);
	});
});
