import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { ScriptTarget, transpileModule } from 'typescript';
import {
	convertValveArrays,
	type ValveSpec,
	type ValveValues
} from '../src/lib/utils/airis/userValves';

type FetchValues = (token: string, id: string) => Promise<ValveValues | null>;
type FetchSpec = (token: string, id: string) => Promise<ValveSpec | null>;
type SaveValues = (token: string, id: string, values: ValveValues) => Promise<ValveValues | null>;
type Control = {
	select: (id: string) => Promise<void>;
	close: () => void;
	submit: () => Promise<void>;
	debounce: () => void;
	edit: (values: ValveValues) => void;
	state: () => {
		valves: ValveValues;
		valvesSpec: ValveSpec | null;
		detailLoading: boolean;
		loadFailed: boolean;
		saving: boolean;
	};
};
type Factory = (
	values: FetchValues,
	spec: FetchSpec,
	save: SaveValues,
	convert: typeof convertValveArrays
) => Control;

const source = readFileSync('src/lib/components/chat/Controls/Valves.svelte', 'utf8');
const methods = source.slice(
	source.indexOf('const clearSubmitTimer'),
	source.indexOf('onDestroy(resetValves)')
);
const compiled = transpileModule(methods, { compilerOptions: { target: ScriptTarget.ES2022 } });
// Execute the actual component methods; API, notifications and lifecycle boundaries are controlled.
const factory = new Function(
	'getValues',
	'getSpec',
	'save',
	'convertValveArrays',
	`
	let show=true, selectedId='', tab='tools', detailRequest=0, debounceTimer;
	let valves={}, valvesSpec=null, detailLoading=false, loadFailed=false, saving=false;
	const localStorage={token:'fixture'}, $i18n={t:key=>key};
	const toast={error:()=>{},success:()=>{}}, dispatch=()=>{};
	const getToolUserValvesById=getValues, getFunctionUserValvesById=getValues;
	const getToolUserValvesSpecById=getSpec, getFunctionUserValvesSpecById=getSpec;
	const updateToolUserValvesById=save, updateFunctionUserValvesById=save;
	${compiled.outputText}
	return {select: id=>{selectedId=id;return getUserValves(tab,id)},
	close:()=>{show=false;resetValves()},submit:submitHandler,debounce:debounceSubmitHandler,
	edit:value=>{valves=value},state:()=>({valves,valvesSpec,detailLoading,loadFailed,saving})};
`
) as Factory;
const schema: ValveSpec = { properties: { tags: { type: 'array' } } };
const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
afterEach(() => {
	vi.useRealTimers();
});

it.each(['values', 'spec'] as const)(
	'finishes failed %s loading without saving and permits retry',
	async (part) => {
		let failed = true;
		const getValues: FetchValues = async () => {
			if (failed && part === 'values') throw new Error('fixture');
			return null;
		};
		const getSpec: FetchSpec = async () => {
			if (failed && part === 'spec') throw new Error('fixture');
			return schema;
		};
		const save = vi.fn<Parameters<SaveValues>, ReturnType<SaveValues>>().mockResolvedValue({});
		const control = factory(getValues, getSpec, save, convertValveArrays);
		await control.select('a');
		expect(control.state()).toMatchObject({
			detailLoading: false,
			loadFailed: true,
			valvesSpec: null
		});
		await control.submit();
		expect(save).not.toHaveBeenCalled();
		failed = false;
		await control.select('a');
		expect(control.state()).toMatchObject({
			detailLoading: false,
			loadFailed: false,
			valves: {},
			valvesSpec: schema
		});
	}
);

it('ignores a late value response after a different selection', async () => {
	const old = deferred<ValveValues | null>();
	const control = factory(
		async (_, id) => (id === 'a' ? old.promise : { tags: ['current'] }),
		async () => schema,
		async () => ({}),
		convertValveArrays
	);
	const pending = control.select('a');
	await control.select('z');
	old.resolve({ tags: ['old'] });
	await pending;
	expect(control.state().valves.tags).toBe('current');
});

it('cancels pending debounce on selection/close and suppresses changes during save', async () => {
	vi.useFakeTimers();
	const response = deferred<ValveValues | null>();
	const save = vi
		.fn<Parameters<SaveValues>, ReturnType<SaveValues>>()
		.mockReturnValue(response.promise);
	const control = factory(
		async () => ({ tags: [] }),
		async () => schema,
		save,
		convertValveArrays
	);
	await control.select('a');
	control.edit({ tags: 'one,two' });
	control.debounce();
	await control.select('z');
	await vi.advanceTimersByTimeAsync(600);
	expect(save).not.toHaveBeenCalled();
	control.edit({ tags: 'one,two' });
	control.debounce();
	const pending = control.submit();
	control.debounce();
	expect(save).toHaveBeenCalledTimes(1);
	expect(control.state().valves.tags).toBe('one,two');
	response.resolve({ tags: ['one', 'two'] });
	await pending;
	await vi.advanceTimersByTimeAsync(600);
	expect(save).toHaveBeenCalledTimes(1);
	control.debounce();
	control.close();
	await vi.advanceTimersByTimeAsync(600);
	expect(save).toHaveBeenCalledTimes(1);
});
