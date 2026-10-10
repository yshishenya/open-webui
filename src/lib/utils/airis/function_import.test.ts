import { expect, it } from 'vitest';
import { parseFunctionImport } from './function_import';
const item = {
	id: 'sample',
	name: 'Sample',
	content: 'code',
	meta: { description: null, manifest: null, extra: 1 }
};
it('accepts exports and Community envelopes without copying runtime fields', () => {
	expect(parseFunctionImport(JSON.stringify([{ ...item, is_active: true }]))).toEqual([item]);
	expect(parseFunctionImport(JSON.stringify([{ function: item }]))).toEqual([item]);
});
it.each([
	null,
	{},
	[],
	[null],
	[{ ...item, meta: [] }],
	[{ ...item, content: 7 }],
	[{ ...item, meta: { description: 2 } }],
	[{ ...item, meta: { manifest: [] } }],
	[item, { ...item, id: 'SAMPLE' }],
	[{ ...item, id: 'bad-id' }],
	[{ ...item, id: 'ͺ' }]
])('rejects an invalid import before persistence: %j', (value) => {
	expect(() => parseFunctionImport(JSON.stringify(value))).toThrow();
});
it('supports Unicode identifiers used by Python rather than restricting to ASCII', () => {
	expect(parseFunctionImport(JSON.stringify([{ ...item, id: 'функция_1' }]))[0].id).toBe(
		'функция_1'
	);
});
