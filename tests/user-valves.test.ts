import { afterEach, describe, expect, it, vi } from 'vitest';
import * as tools from '../src/lib/apis/tools';
import * as functions from '../src/lib/apis/functions';
import {
	convertValveArrays,
	readValveSpec,
	type ValveSpec
} from '../src/lib/utils/airis/userValves';

vi.mock('$lib/constants', () => ({ WEBUI_API_BASE_URL: 'http://fixture/api/v1' }));

const calls = [
	tools.getUserValvesById,
	tools.getUserValvesSpecById,
	(token: string, id: string) => tools.updateUserValvesById(token, id, {}),
	functions.getUserValvesById,
	functions.getUserValvesSpecById,
	(token: string, id: string) => functions.updateUserValvesById(token, id, {})
];

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('user valve API failure distinction', () => {
	it.each(calls.map((call, index) => ({ call, index })))(
		'rejects HTTP failures for API $index',
		async ({ call }) => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response('{"detail":"private"}', { status: 403 }))
			);
			await expect(call('fixture', 'fixture')).rejects.toThrow('403');
		}
	);
	it.each(calls.map((call, index) => ({ call, index })))(
		'rejects network failures for API $index',
		async ({ call }) => {
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fixture network failure')));
			await expect(call('fixture', 'fixture')).rejects.toBeDefined();
		}
	);
	it.each(calls.map((call, index) => ({ call, index })))(
		'rejects invalid JSON for API $index',
		async ({ call }) => {
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('broken', { status: 200 })));
			await expect(call('fixture', 'fixture')).rejects.toBeDefined();
		}
	);
	it.each(calls.map((call, index) => ({ call, index })))(
		'preserves successful null for API $index',
		async ({ call }) => {
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', { status: 200 })));
			await expect(call('fixture', 'fixture')).resolves.toBeNull();
		}
	);
});

describe('user valve editor roundtrip', () => {
	const spec: ValveSpec = {
		properties: {
			tags: { type: 'array' },
			defaults: { type: 'array' },
			unset: { type: 'array' },
			choices: { type: 'array', input: { type: 'multiselect' } }
		}
	};
	it('preserves defaults, absent keys, empty arrays and multiselects without mutation', () => {
		const values = { tags: [], defaults: null, choices: ['one'] };
		const editor = convertValveArrays(values, spec, true);
		expect(editor).toEqual({ tags: '', defaults: null, choices: ['one'] });
		expect(convertValveArrays(editor, spec, false)).toEqual(values);
		expect(values).toEqual({ tags: [], defaults: null, choices: ['one'] });
		expect(editor.tags).toBe('');
	});
	it('keeps repeated saves editable and handles null initial values', () => {
		expect(convertValveArrays(null, spec, true)).toEqual({});
		const editor = { tags: 'one, two', choices: ['one'] };
		for (let i = 0; i < 2; i += 1) {
			const payload = convertValveArrays(editor, spec, false);
			expect(payload.tags).toEqual(['one', 'two']);
			expect(convertValveArrays(payload, spec, true).tags).toBe('one,two');
			expect(editor.tags).toBe('one, two');
		}
	});
	it('rejects malformed schema/array values before save', () => {
		expect(() => readValveSpec({ properties: [] })).toThrow();
		expect(() => readValveSpec({ properties: { tags: null } })).toThrow();
		expect(() => convertValveArrays({ tags: 42 }, spec, true)).toThrow();
		expect(readValveSpec(null)).toBeNull();
		expect(readValveSpec({ properties: { tags: { type: 'array', input: null } } })).toEqual({
			properties: { tags: { type: 'array', input: null } }
		});
	});
});
