import { expect, it } from 'vitest';
import { parseFunctionImport, parseCodeImport } from './function_import';
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

it('retains tool metadata and exact absent/null/empty/populated grants', () => {
	for (const grants of [
		undefined,
		null,
		[],
		[
			{
				id: 'grant',
				principal_type: 'user',
				principal_id: 'user',
				permission: 'write',
				resource_id: 'sample'
			}
		]
	]) {
		const original = {
			...item,
			...(grants === undefined ? {} : { access_grants: grants }),
			runtime: 'excluded'
		};
		expect(parseCodeImport(JSON.stringify([{ tool: original }]), 'tool')).toEqual([
			{ ...item, ...(grants === undefined ? {} : { access_grants: grants }) }
		]);
	}
});
it.each([
	{},
	[null],
	[{ principal_type: ['user'], principal_id: 'user', permission: 'read' }],
	[{ principal_type: 'user', principal_id: 7, permission: 'read' }],
	[{ principal_type: 'group', principal_id: 'group', permission: 'owner' }]
])('rejects invalid tool grants before a write: %j', (grants) => {
	expect(() =>
		parseCodeImport(JSON.stringify([{ ...item, access_grants: grants }]), 'tool')
	).toThrow();
});
